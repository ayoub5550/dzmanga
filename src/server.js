const express = require('express');
const zlib = require('zlib');
const path = require('path');
const asq = require('./sources/asq');
const tx = require('./sources/teamx');
const sharp = require('sharp');
sharp.concurrency(1); // انظر IMG_CONCURRENCY أدناه

// حدود ضغط الصور في بروكسي /img (انظر التعليق هناك)
const IMG_MAX_WIDTH = parseInt(process.env.IMG_MAX_WIDTH, 10) || 1080;
const IMG_WEBP_QUALITY = parseInt(process.env.IMG_WEBP_QUALITY, 10) || 78;

// حد تحويلات sharp المتوازية (2026-08-27): فصل واحد = 30+ تحويلة WebP، ومع
// عدة قرّاء في نفس الوقت الـCPU يُشبع والسيرفر كله يصير بطيئاً. sharp نفسه
// يستعمل عدة threads لكل صورة، لذا: thread واحد لكل صورة + طابور بعدد محدود.
const IMG_CONCURRENCY = parseInt(process.env.IMG_CONCURRENCY, 10) || 3;
let imgActive = 0;
const imgQueue = [];
async function withImgSlot(fn) {
  if (imgActive >= IMG_CONCURRENCY) await new Promise((r) => imgQueue.push(r));
  imgActive++;
  try {
    return await fn();
  } finally {
    imgActive--;
    const next = imgQueue.shift();
    if (next) next();
  }
}

const app = express();
const PORT = process.env.PORT || 3090;
const MD_BASE = 'https://api.mangadex.org';
const UPLOADS_BASE = 'https://uploads.mangadex.org';
const LANG = 'ar'; // dzmanga is an Arabic-first reader: only Arabic scanlations are shown

// Curated genre rows shown on the homepage, beyond "popular"/"latest".
// MangaDex tag UUIDs (from GET /manga/tag) — do not rename keys without also
// updating src/public/app.js, which reads GENRES to build the section list.
const GENRES = [
  { key: 'action', label: 'أكشن', tagId: '391b0423-d847-456f-aff0-8b0cfc03066b' },
  { key: 'romance', label: 'رومانسي', tagId: '423e2eae-a7a2-4a8b-ac03-a8351462d71d' },
  { key: 'isekai', label: 'إيسيكاي', tagId: 'ace04997-f6bd-436e-b261-779182193d3d' },
  { key: 'fantasy', label: 'خيال', tagId: 'cdc58593-87dd-415e-bbc0-2ec27bf404cc' },
  { key: 'comedy', label: 'كوميدي', tagId: '4d32cc48-9f00-4cca-9b5a-a839f0764984' },
  { key: 'horror', label: 'رعب', tagId: 'cdad7e68-1419-41dd-bdce-27753074a640' },
];

// ---------------------------------------------------------------------------
// ضغط gzip يدوي (بدون حزم إضافية — راجع AGENTS.md: نبقى خفيفين).
// يضغط ردود JSON/JS/CSS/HTML فقط، والصور تُترك كما هي (مضغوطة أصلاً).
// ---------------------------------------------------------------------------
const COMPRESSIBLE = /json|javascript|text\/|svg/;
app.use((req, res, next) => {
  const accepts = String(req.headers['accept-encoding'] || '').includes('gzip');
  if (!accepts) return next();
  const send = res.send.bind(res);
  res.send = (body) => {
    try {
      const type = String(res.get('Content-Type') || '');
      const buf = Buffer.isBuffer(body) ? body : typeof body === 'string' ? Buffer.from(body) : null;
      if (!buf || buf.length < 1024 || !COMPRESSIBLE.test(type) || res.get('Content-Encoding')) return send(body);
      const gz = zlib.gzipSync(buf, { level: 6 });
      res.set('Content-Encoding', 'gzip');
      res.set('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');
      return send(gz);
    } catch (e) {
      return send(body);
    }
  };
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true, index: false }));
app.use(express.json());

// simple in-memory cache to keep things fast + light on MangaDex rate limits
// سقف للحجم (2026-08-27): كانت المداخل المنتهية لا تُحذف أبداً، فالذاكرة تكبر
// مع كل بناء كتالوغ (مئات الطلبات كل 3 ساعات). Map في JS يحفظ ترتيب الإدخال،
// فحذف أول مفتاح = إخراج الأقدم (FIFO بسيط).
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES, 10) || 1500;
function cacheSet(url, data) {
  cache.set(url, { t: Date.now(), data });
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MangaDex (Cloudflare) can silently drop *all* connections from a given VPS
// IP for a while — e.g. after a burst of requests during catalog rebuilds.
// The TLS handshake succeeds but no HTTP response ever comes back
// ("fetch failed" / socket reset). Retrying the same IP does not help in
// that case. As a last resort we relay the single request through
// r.jina.ai (a free, keyless read-only fetch proxy) which reaches
// MangaDex from a different IP. Only used after direct attempts are
// exhausted — keeps normal traffic going straight to MangaDex.
async function fetchViaJinaProxy(url) {
  const proxyUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(proxyUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'dzmanga/1.0' },
  });
  if (!res.ok) throw new Error(`jina proxy ${res.status} for ${url}`);
  const wrapper = await res.json();
  const content = wrapper?.data?.content;
  if (!content) throw new Error(`jina proxy: no content for ${url}`);
  return JSON.parse(content);
}

async function cachedFetchJson(url, retries = 4) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.data;
  // Network-level failures (full IP block) don't get better with more
  // retries against the same IP — only one quick retry before falling back
  // to the jina proxy, so a blocked-IP request resolves in ~2-5s instead of
  // ~20s of pointless backoff. 429/5xx (handled below) keep the full
  // `retries` budget since those genuinely can clear with a short wait.
  const NETWORK_RETRY_LIMIT = 1;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': 'dzmanga/1.0' } });
    } catch (networkErr) {
      if (attempt < NETWORK_RETRY_LIMIT) {
        await sleep(1000);
        continue;
      }
      // Direct connection is exhausted — this VPS IP may be temporarily
      // blocked at the network level. Try once via the jina.ai relay
      // before giving up.
      try {
        const data = await fetchViaJinaProxy(url);
        cacheSet(url, data);
        return data;
      } catch (proxyErr) {
        throw networkErr;
      }
    }
    if (res.status === 429 && attempt < retries) {
      // MangaDex rate limit — back off and retry rather than failing the
      // whole request (this matters a lot for the full-catalog build, which
      // makes hundreds of requests in a short window).
      const retryAfter = parseInt(res.headers.get('retry-after'), 10);
      await sleep((Number.isFinite(retryAfter) ? retryAfter : 2 + attempt * 2) * 1000);
      continue;
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(1500 + attempt * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`MangaDex ${res.status} for ${url}`);
    const data = await res.json();
    cacheSet(url, data);
    return data;
  }
}

function coverUrl(mangaId, fileName, size = 256) {
  if (!fileName) return null;
  const real = `${UPLOADS_BASE}/covers/${mangaId}/${fileName}.${size}.jpg`;
  // Route through our own /img proxy: some ISPs (e.g. in Algeria) have slow/
  // flaky direct routes to MangaDex's CDN, so fetching from our VPS (usually
  // better connected) and letting the browser cache our response is both
  // faster and more reliable than a direct cross-origin <img src>.
  return `/img?u=${encodeURIComponent(real)}`;
}

function pickTitle(attrs) {
  // Prefer Arabic title, then English, then whatever is available
  return (
    attrs.title?.ar ||
    attrs.altTitles?.map((t) => t.ar).find(Boolean) ||
    attrs.title?.en ||
    Object.values(attrs.title || {})[0] ||
    'بدون عنوان'
  );
}

function mapManga(m) {
  const attrs = m.attributes || {};
  const coverRel = (m.relationships || []).find((r) => r.type === 'cover_art');
  const authorRel = (m.relationships || []).find((r) => r.type === 'author');
  const desc = attrs.description?.ar || attrs.description?.en || Object.values(attrs.description || {})[0] || '';
  return {
    id: m.id,
    title: pickTitle(attrs),
    description: desc,
    descriptionIsArabic: Boolean(attrs.description?.ar),
    status: attrs.status,
    year: attrs.year,
    tags: (attrs.tags || []).map((t) => t.attributes?.name?.en).filter(Boolean),
    cover: coverUrl(m.id, coverRel?.attributes?.fileName),
    author: authorRel?.attributes?.name || null,
    source: 'md',
    // نفس المفتاح الذي يرجعه محوّلا asq وTeam-X — بدونه كانت شارة المصدر
    // تطلع فارغة لعناوين MangaDex في أي عميل يعتمد على الـAPI مباشرة.
    sourceLabel: 'MangaDex',
  };
}

// dzmanga positions itself as a fully-Arabic reader, but MangaDex only has
// Arabic *descriptions* for a minority of titles (most only have an English
// synopsis even when their chapters are translated to Arabic). We machine-
// translate the English synopsis via MyMemory's free API (no key, but a
// hard 500-char-per-request limit and a modest daily quota) as a fallback —
// this is a translation, not editorial content, so quality is "good enough
// to understand the premise", not publication-grade. Only called for the
// single manga a user actually opens (never for list/browse endpoints),
// and cached indefinitely per manga id to stay within the free quota.
// تخزين دائم على القرص (2026-08-26): كان الكاش في الذاكرة فقط، فكل إعادة
// تشغيل للسيرفر (بعد كل نشر) كانت تمسح كل الترجمات المُنجزة وتُجبر إعادة
// طلبها من MyMemory — هذا كان يستهلك حصة MyMemory المجانية اليومية (منخفضة
// جداً لعناوين IP بدون تسجيل) بسرعة، فيفشل التحويل لمعظم اليوم وتظهر أوصاف
// إنجليزية خام لأغلب صفحات MangaDex بدل العربية. الحل: كاش على ملف JSON
// يُحمَّل عند الإقلاع ويُحفَظ بعد كل ترجمة ناجحة، فلا تُفقد الترجمات بين
// عمليات إعادة التشغيل/النشر.
const TRANSLATION_CACHE_FILE = path.join(__dirname, '..', 'data', 'translation-cache.json');
const translationCache = new Map(); // mangaId -> arabic text
(function loadTranslationCache() {
  try {
    const raw = require('fs').readFileSync(TRANSLATION_CACHE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) translationCache.set(k, v);
    console.log(`translation cache: loaded ${translationCache.size} entries from disk`);
  } catch (e) {
    console.log('translation cache: no existing file, starting fresh');
  }
})();
let saveTimer = null;
function persistTranslationCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      require('fs').mkdirSync(path.dirname(TRANSLATION_CACHE_FILE), { recursive: true });
      require('fs').writeFileSync(TRANSLATION_CACHE_FILE, JSON.stringify(Object.fromEntries(translationCache)));
    } catch (e) {
      console.error('failed to persist translation cache:', e.message);
    }
  }, 2000); // debounce — لا نكتب الملف عند كل ترجمة منفردة
}

// إن أعلن MyMemory أن الحصة اليومية انتهت (429/quotaFinished)، نتوقف عن
// الطلب لبقية عملية التشغيل بدل تكرار محاولات فاشلة على كل صفحة يفتحها
// الزوار (كل محاولة فاشلة كانت ترفع زمن استجابة صفحة المانجا بلا فائدة).
let quotaExhaustedUntilRestart = false;

function splitIntoChunks(text, maxLen = 480) {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).trim().length > maxLen) {
      if (cur) chunks.push(cur.trim());
      cur = s.length > maxLen ? s.slice(0, maxLen) : s;
    } else {
      cur = (cur ? cur + ' ' : '') + s;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

async function translateChunk(text) {
  const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : '';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar${email}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'dzmanga/1.0' } });
  if (res.status === 429) { quotaExhaustedUntilRestart = true; throw new Error('translate 429 (quota)'); }
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = await res.json();
  if (data.responseStatus === 429 || /USED ALL AVAILABLE FREE/i.test(data.responseDetails || '')) {
    quotaExhaustedUntilRestart = true;
    throw new Error('translate quota exhausted for today');
  }
  if (data.responseStatus && data.responseStatus !== 200) throw new Error('translate quota/error');
  return data.responseData?.translatedText || text;
}

async function translateDescriptionToArabic(mangaId, englishText) {
  if (!englishText) return englishText;
  if (translationCache.has(mangaId)) return translationCache.get(mangaId);
  if (quotaExhaustedUntilRestart) return englishText; // تجنّب طلبات فاشلة مؤكدة
  try {
    const chunks = splitIntoChunks(englishText);
    const translated = [];
    for (const chunk of chunks) {
      translated.push(await translateChunk(chunk));
    }
    const full = translated.join(' ');
    translationCache.set(mangaId, full);
    persistTranslationCache();
    return full;
  } catch (e) {
    console.error('translation failed, falling back to English:', e.message);
    return englishText; // graceful fallback — never break the page over a translation hiccup
  }
}

// ---- API routes ----
// NOTE for future agents: dzmanga only shows manga that have at least one
// Arabic (translatedLanguage=ar) chapter on MangaDex. This is enforced via
// `availableTranslatedLanguage[]=ar` on discovery endpoints (home/search) and
// `translatedLanguage[]=ar` on the chapter feed. Do not silently widen this
// to other languages without checking with the product owner — the whole
// app's positioning is "Arabic manga reader".
//
// IMPORTANT gotcha discovered 2026-08-17: MangaDex's `availableTranslatedLanguage`
// facet is unreliable for less-common languages like `ar` — it returns manga
// that historically had an Arabic chapter registered even if it has since been
// taken down (common for officially-licensed titles, e.g. Solo Leveling: the
// filter includes it, but its `ar` feed has `total: 0`, and MangaDex serves a
// "read at mangadex.org" placeholder as the cover for such titles). So for
// `/api/home` we over-fetch candidates and verify each one actually has a
// readable (pages > 0) Arabic chapter via `hasReadableArabicChapter()` before
// including it — do not remove this check or "popular" will show broken entries.

const readableCache = new Map(); // mangaId -> { t, ok }
const READABLE_TTL_MS = 30 * 60 * 1000;

async function hasReadableArabicChapter(mangaId) {
  const hit = readableCache.get(mangaId);
  if (hit && Date.now() - hit.t < READABLE_TTL_MS) return hit.ok;
  let ok = false;
  try {
    const url = `${MD_BASE}/manga/${mangaId}/feed?translatedLanguage[]=${LANG}&limit=20&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
    const data = await cachedFetchJson(url);
    ok = (data.data || []).some((c) => c.attributes.pages > 0);
  } catch (e) {
    ok = false;
  }
  readableCache.set(mangaId, { t: Date.now(), ok });
  return ok;
}

// Runs `fn` over `items` with at most `limit` in flight at once (keeps us
// well under MangaDex's informal rate-limit guidance).
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function filterReadable(mangaList, wanted) {
  const flags = await mapWithConcurrency(mangaList, 6, (m) => hasReadableArabicChapter(m.id));
  return mangaList.filter((_, i) => flags[i]).slice(0, wanted);
}

// /api/home is the slowest endpoint (it has to verify ~2x18 candidate manga
// against MangaDex before it can answer), so its result is cached server-side
// and refreshed in the background — users almost always get an instant
// response from cache instead of paying the verification cost per request.
const HOME_CACHE_TTL_MS = 15 * 60 * 1000;
let homeCache = { data: null, t: 0, inflight: null };

async function fetchGenreRow(tagId, wanted = 12, candidates = 22) {
  const url = `${MD_BASE}/manga?limit=${candidates}&includes[]=cover_art&includes[]=author&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}&includedTags[]=${tagId}`;
  const data = await cachedFetchJson(url);
  return filterReadable(data.data.map(mapManga), wanted);
}

async function buildHomePayload() {
  const WANTED = 18;
  const CANDIDATES = 30; // over-fetch since some will fail the readable-chapter check
  const popularUrl = `${MD_BASE}/manga?limit=${CANDIDATES}&includes[]=cover_art&includes[]=author&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
  const latestUrl = `${MD_BASE}/manga?limit=${CANDIDATES}&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
  const [popular, latest] = await Promise.all([
    cachedFetchJson(popularUrl),
    cachedFetchJson(latestUrl),
  ]);
  const [popularOk, latestOk, genreRows] = await Promise.all([
    filterReadable(popular.data.map(mapManga), WANTED),
    filterReadable(latest.data.map(mapManga), WANTED),
    Promise.all(GENRES.map((g) => fetchGenreRow(g.tagId))),
  ]);
  const genres = GENRES.map((g, i) => ({ key: g.key, label: g.label, items: genreRows[i] })).filter(
    (g) => g.items.length > 0
  );
  // Hero banner: a handful of eye-catching picks from the popular list, with
  // a cover we already know is readable (used for the rotating home banner).
  const hero = popularOk.slice(0, 6);
  return { hero, popular: popularOk, latest: latestOk, genres };
}

// الصفحة الرئيسية الآن ثنائية المصدر: صفوف "مانجا العاشق" (3asq) أولاً لأنها
// ترجمات عربية أصلية وأسرع تحديثاً، ثم صفوف MangaDex. فشل أحد المصدرين لا
// يُسقط الصفحة كلها — نُرجع ما نجح فقط.
async function buildAsqHome() {
  const [latest, popular, genreRows] = await Promise.all([
    asq.list({ order: 'latest', page: 1 }).catch(() => ({ items: [] })),
    asq.list({ order: 'popular', page: 1 }).catch(() => ({ items: [] })),
    Promise.all(
      asq.GENRES.slice(0, 4).map((g) =>
        asq.list({ genre: g.slug, page: 1 }).then((r) => r.items).catch(() => [])
      )
    ),
  ]);
  return {
    latest: latest.items.slice(0, 18),
    popular: popular.items.slice(0, 18),
    genres: asq.GENRES.slice(0, 4)
      .map((g, i) => ({ key: g.key, label: g.label, items: genreRows[i].slice(0, 18) }))
      .filter((g) => g.items.length),
  };
}

let asqHomeCache = { data: null, t: 0, inflight: null };
const ASQ_HOME_TTL_MS = 10 * 60 * 1000;

function cachedAsqHome() {
  const fresh = asqHomeCache.data && Date.now() - asqHomeCache.t < ASQ_HOME_TTL_MS;
  if (fresh) return Promise.resolve(asqHomeCache.data);
  if (!asqHomeCache.inflight) {
    asqHomeCache.inflight = buildAsqHome()
      .then((data) => {
        asqHomeCache = { data, t: Date.now(), inflight: null };
        return data;
      })
      .catch((e) => {
        asqHomeCache.inflight = null;
        throw e;
      });
  }
  return asqHomeCache.inflight;
}

function cachedMdHome() {
  const fresh = homeCache.data && Date.now() - homeCache.t < HOME_CACHE_TTL_MS;
  if (fresh) return Promise.resolve(homeCache.data);
  if (!homeCache.inflight) {
    homeCache.inflight = buildHomePayload()
      .then((data) => {
        homeCache = { data, t: Date.now(), inflight: null };
        return data;
      })
      .catch((e) => {
        homeCache.inflight = null;
        throw e;
      });
  }
  return homeCache.inflight;
}

// Team-X home rows (manhwa + manhua, first page of each) — cheap, so 30 min TTL.
const TX_HOME_TTL_MS = 30 * 60 * 1000;
let txHomeCache = { data: null, t: 0, inflight: null };
async function buildTxHome() {
  const [manhwa, manhua] = await Promise.all([
    tx.list({ type: 'manhwa' }),
    tx.list({ type: 'manhua' }),
  ]);
  return { manhwa: manhwa.items, manhua: manhua.items };
}
function cachedTxHome() {
  const fresh = txHomeCache.data && Date.now() - txHomeCache.t < TX_HOME_TTL_MS;
  if (fresh) return Promise.resolve(txHomeCache.data);
  if (!txHomeCache.inflight) {
    txHomeCache.inflight = buildTxHome()
      .then((data) => {
        txHomeCache = { data, t: Date.now(), inflight: null };
        return data;
      })
      .catch((e) => {
        txHomeCache.inflight = null;
        throw e;
      });
  }
  return txHomeCache.inflight;
}

// /api/home يجمع المصادر الثلاثة. أي مصدر يفشل يُرجع فارغاً بدل إسقاط الصفحة كلها
// (3asq و MangaDex ينقطعان أحياناً بشكل مستقل).
app.get('/api/home', async (req, res) => {
  const [asqHome, mdHome, txHome] = await Promise.all([
    cachedAsqHome().catch((e) => {
      console.error('3asq home failed:', e.message);
      return null;
    }),
    cachedMdHome().catch((e) => {
      console.error('mangadex home failed:', e.message);
      return null;
    }),
    cachedTxHome().catch((e) => {
      console.error('teamx home failed:', e.message);
      return null;
    }),
  ]);
  if (!asqHome && !mdHome) return res.status(502).json({ error: 'both sources unreachable' });
  const hero = (asqHome?.popular || []).slice(0, 6);
  // كاش على مستوى المتصفح/nginx: الرئيسية تُبنى من كاشات داخلية أصلاً،
  // فلا داعي أن يضرب كل زائر السيرفر — 3 دقائق توازن جيد بين الطزاجة والحمل.
  res.set('Cache-Control', 'public, max-age=180');
  res.json({
    hero: hero.length ? hero : mdHome?.hero || [],
    asq: asqHome || { latest: [], popular: [], genres: [] },
    tx: txHome || { manhwa: [], manhua: [] },
    md: mdHome || { popular: [], latest: [], genres: [] },
    // مفاتيح قديمة للتوافق مع أي عميل لم يُحدَّث بعد
    popular: mdHome?.popular || [],
    latest: mdHome?.latest || [],
    genres: mdHome?.genres || [],
  });
});


// /api/feed — خلاصة الرئيسية الموحّدة: صفحات «آخر التحديثات» من المصادر الثلاثة
// (العاشق + Team-X + MangaDex) مدموجة بالتناوب في قائمة واحدة للتمرير اللانهائي.
// كل صفحة تُخزَّن مؤقتاً حتى لا نعيد ضرب المصادر مع كل زائر.
const FEED_TTL_MS = 10 * 60 * 1000;
const feedPageCache = new Map(); // page -> { t, data }

async function mdLatestPage(page) {
  const limit = 18;
  const offset = (page - 1) * limit;
  const url = `${MD_BASE}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
  const data = await cachedFetchJson(url);
  const mapped = data.data.map(mapManga);
  // نفس فلترة الرئيسية: استبعاد العناوين بلا فصل عربي قابل للقراءة فعلاً
  const items = await filterReadable(mapped, limit);
  return { items, hasNext: offset + limit < Math.min(data.total, 9000) };
}

app.get('/api/feed', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  res.set('Cache-Control', 'public, max-age=300'); // نفس منطق /api/home — كاش داخلي 10 دقائق أصلاً
  const hit = feedPageCache.get(page);
  if (hit && Date.now() - hit.t < FEED_TTL_MS) return res.json(hit.data);
  const [a, t, m] = await Promise.all([
    asq.list({ order: 'latest', page }).catch((e) => {
      console.error('feed 3asq failed:', e.message);
      return { items: [], hasNext: false };
    }),
    tx.list({ page }).catch((e) => {
      console.error('feed teamx failed:', e.message);
      return { items: [], hasNext: false };
    }),
    mdLatestPage(page).catch((e) => {
      console.error('feed mangadex failed:', e.message);
      return { items: [], hasNext: false };
    }),
  ]);
  const lists = [a.items || [], t.items || [], m.items || []];
  if (!lists.some((l) => l.length)) return res.status(502).json({ error: 'all sources unreachable' });
  // دمج بالتناوب واستبعاد التكرارات (نفس العنوان قد يظهر من مصدرين بنفس المعرّف فقط)
  const items = [];
  const seen = new Set();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const it = l[i];
      if (it && !seen.has(it.id)) {
        seen.add(it.id);
        items.push(it);
      }
    }
  }
  const data = { items, page, hasNext: !!(a.hasNext || t.hasNext || m.hasNext) };
  feedPageCache.set(page, { t: Date.now(), data });
  if (feedPageCache.size > 60) feedPageCache.delete(feedPageCache.keys().next().value);
  res.json(data);
});

// Full-catalog index: dzmanga's "الكل" tab is meant to show literally every
// MangaDex title that has a readable Arabic chapter — measured 2026-08-17 at
// ~733 out of 978 ar-tagged titles. Checking that live on every page request
// is too slow (N+1 calls per candidate), so we build the whole filtered list
// once in the background and cache it, then serve real numbered pages
// (like MangaDex's own "Titles" browse, which is the org scheme this was
// modeled on) by slicing the in-memory array — instant + shows a true total
// count instead of an open-ended "load more" that never visibly finishes.
const CATALOG_REBUILD_MS = 3 * 60 * 60 * 1000; // MangaDex catalog changes slowly; 3h is plenty fresh
const RAW_PAGE = 100;
let fullCatalog = { items: [], builtAt: 0, building: false, lastAttempt: 0 };
const BUILD_RETRY_COOLDOWN_MS = 60 * 1000; // don't hammer MangaDex again right after a failed build

async function buildFullCatalog() {
  if (fullCatalog.building) return;
  if (!fullCatalog.items.length && Date.now() - fullCatalog.lastAttempt < BUILD_RETRY_COOLDOWN_MS) return;
  fullCatalog.building = true;
  fullCatalog.lastAttempt = Date.now();
  console.log('building full catalog index...');
  try {
    let offset = 0;
    let total = Infinity;
    const items = [];
    while (offset < total) {
      const url = `${MD_BASE}/manga?limit=${RAW_PAGE}&offset=${offset}&includes[]=cover_art&includes[]=author&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=${LANG}`;
      const data = await cachedFetchJson(url);
      total = data.total;
      const mapped = data.data.map(mapManga);
      const flags = await mapWithConcurrency(mapped, 5, (m) => hasReadableArabicChapter(m.id));
      // فلترة دفاعية: عناصر بلا id فعلي (استجابة MangaDex ناقصة/عطلانة نادراً)
      // ما تدخلش الفهرس — لتفادي روابط <a href="/manga/null"> تتولّد لاحقاً.
      mapped.forEach((m, i) => flags[i] && m.id && items.push(m));
      offset += RAW_PAGE;
      await sleep(600); // spread load across MangaDex pages instead of bursting
    }
    fullCatalog = { items, builtAt: Date.now(), building: false };
    console.log(`full catalog index built: ${items.length} readable titles`);
  } catch (e) {
    console.error('full catalog build failed:', e.message);
    fullCatalog.building = false;
  }
}

app.get('/api/browse', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 24;
  // مصدر التصفح: `asq` (مانجا العاشق، افتراضي — ترجمة عربية أصلية وتصفح فوري)
  // أو `md` (فهرس MangaDex العربي الكامل المبني في الخلفية).
  if ((req.query.source || 'asq') === 'asq') {
    try {
      const order = ['latest', 'popular', 'trending', 'rating'].includes(req.query.order)
        ? req.query.order
        : 'latest';
      const genre = req.query.genre || null;
      const data = await asq.list({ order, page, genre });
      return res.json({ items: data.items, page: data.page, hasNext: data.hasNext, source: 'asq' });
    } catch (e) {
      console.error('3asq browse failed:', e.message);
      return res.status(502).json({ error: 'failed to load 3asq' });
    }
  }
  if ((req.query.source || '') === 'tx') {
    // Team-X: مانهوا كورية / مانها صينية. `view` يحدّد النوع أو التصنيف.
    try {
      const view = req.query.view || 'manhwa';
      const genreDef = tx.GENRES.find((g) => g.key === view);
      const type = tx.TYPES[view] ? view : genreDef ? null : 'manhwa';
      const data = await tx.list({ page, type, genre: genreDef ? genreDef.slug : null });
      return res.json({ items: data.items, page: data.page, hasNext: data.hasNext, source: 'tx' });
    } catch (e) {
      console.error('teamx browse failed:', e.message);
      return res.status(502).json({ error: 'failed to load teamx' });
    }
  }
  if (!fullCatalog.items.length) {
    // Index not ready yet (first ~30s after a restart) — kick off the build
    // and tell the client to retry shortly instead of blocking the request.
    buildFullCatalog();
    return res.json({ items: [], total: 0, page: 1, totalPages: 0, indexing: true });
  }
  const start = (page - 1) * pageSize;
  const items = fullCatalog.items.slice(start, start + pageSize);
  res.json({
    items,
    total: fullCatalog.items.length,
    page,
    totalPages: Math.ceil(fullCatalog.items.length / pageSize),
  });
});

app.get('/api/genre/:key', async (req, res) => {
  if ((req.query.source || 'md') === 'asq') {
    const g = asq.GENRES.find((x) => x.key === req.params.key);
    if (!g) return res.status(404).json({ error: 'unknown genre' });
    try {
      const data = await asq.list({ genre: g.slug, page: Math.max(1, parseInt(req.query.page, 10) || 1) });
      return res.json({ label: g.label, items: data.items, hasNext: data.hasNext });
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'failed to load genre' });
    }
  }
  const genre = GENRES.find((g) => g.key === req.params.key);
  if (!genre) return res.status(404).json({ error: 'unknown genre' });
  try {
    const items = await fetchGenreRow(genre.tagId, 36, 60);
    res.json({ label: genre.label, items });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to load genre' });
  }
});

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  // بحث موحّد في المصدرين: نتائج "مانجا العاشق" أولاً (عربية أصلية) ثم MangaDex.
  const [asqResults, txResults, mdResults] = await Promise.all([
    asq.search(q).catch((e) => {
      console.error('3asq search failed:', e.message);
      return [];
    }),
    tx.search(q).catch((e) => {
      console.error('teamx search failed:', e.message);
      return [];
    }),
    (async () => {
      const url = `${MD_BASE}/manga?title=${encodeURIComponent(q)}&limit=24&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=${LANG}`;
      const data = await cachedFetchJson(url);
      return filterReadable(data.data.map(mapManga), 24);
    })().catch((e) => {
      console.error('mangadex search failed:', e.message);
      return [];
    }),
  ]);
  res.json({
    results: [...asqResults, ...txResults, ...mdResults],
    asq: asqResults,
    tx: txResults,
    md: mdResults,
  });
});

// Shared by /api/manga/:id (JSON for the SPA) and /manga/:id (SEO HTML for
// crawlers) — keep the two in sync by loading through this single helper.
// حماية: 'null'/'undefined'/فارغ يمكن أن تصل هنا كـid حرفي (مثلاً رابط
// <a href="/manga/${m.id}"> تولّد من عنصر فقد id فعلياً) — بدون هذا الفحص
// كنا نرسل طلب حقيقي إلى MangaDex بمعرّف "null" فيفشل بـ404، ونكرّر هذا
// لكل زائر/بوت يفتح الرابط الفاسد. (اكتُشف 2026-08-26 عبر journalctl: نفس
// الخطأ يتكرر كل 15-40 دقيقة من زحف meta-externalagent على /manga/null.)
const INVALID_ID = /^(null|undefined)?$/i;
// معرّف MangaDex هو UUID دائماً. التحقق منه (2026-08-27) يمنع حقن مسار في
// رابط الـAPI (مثل `..%2F..%2F`) ويوقف الطلبات العابثة عندنا بدل تمريرها.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function badId() {
  const e = new Error('invalid manga id');
  e.status = 404;
  return e;
}
async function loadMangaDetail(id) {
  if (INVALID_ID.test(id)) throw badId();
  if (id.startsWith('asq:')) return asq.detail(id.slice(4));
  if (id.startsWith('tx:')) return tx.detail(id.slice(3));
  if (!UUID_RE.test(id)) throw badId();
  const url = `${MD_BASE}/manga/${id}?includes[]=cover_art&includes[]=author`;
  const data = await cachedFetchJson(url);
  const manga = mapManga(data.data);
  if (!manga.descriptionIsArabic && manga.description) {
    manga.description = await translateDescriptionToArabic(manga.id, manga.description);
  }
  delete manga.descriptionIsArabic;
  return manga;
}

app.get('/api/manga/:id', async (req, res) => {
  try {
    res.json(await loadMangaDetail(req.params.id));
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: 'manga not found' });
    console.error(e);
    res.status(502).json({ error: 'failed to load manga' });
  }
});

// قائمة الفصول — استُخرجت من مسار /api/manga/:id/chapters (2026-08-27) لأن
// صفحات الفصول الجديدة القابلة للفهرسة (/read/...) تحتاج نفس القائمة على
// السيرفر. لا تُكرّر منطق الجلب في مكان ثالث: استعمل loadChapters().
async function loadChapters(id) {
  if (id.startsWith('tx:')) return await tx.chapters(id.slice(3));
  if (id.startsWith('asq:')) return await asq.chapters(id.slice(4));
  if (!UUID_RE.test(id)) {
    const err = new Error('manga not found');
    err.status = 404;
    throw err;
  }
  let offset = 0;
  let all = [];
  for (let i = 0; i < 15; i++) {
    const url = `${MD_BASE}/manga/${id}/feed?translatedLanguage[]=${LANG}&order[chapter]=asc&limit=500&offset=${offset}&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
    const data = await cachedFetchJson(url);
    all = all.concat(data.data);
    offset += 500;
    if (offset >= data.total || data.data.length === 0) break;
  }
  // Grouped by volume (like MangaDex's own chapter table) so long-running
  // series don't dump hundreds of flat rows on the reader.
  return all
    .filter((c) => c.attributes.pages > 0) // drop external-only/licensed chapters we can't render
    .map((c) => {
      const group = (c.relationships || []).find((r) => r.type === 'scanlation_group');
      return {
        id: c.id,
        chapter: c.attributes.chapter,
        title: c.attributes.title,
        pages: c.attributes.pages,
        publishAt: c.attributes.publishAt,
        volume: c.attributes.volume,
        group: group?.attributes?.name || null,
      };
    });
}

// نسخة مُكاشة (10 دقائق) لاستعمال طبقة الـSEO فقط — صفحات /read و/manga
// وبناء الـsitemap تُطلب كثيراً من الزواحف، وما نبغيش كل طلب يضرب المصدر.
const chaptersCache = new Map(); // id -> { t, chapters }
const CHAPTERS_TTL_MS = 10 * 60 * 1000;
async function cachedChapters(id) {
  const hit = chaptersCache.get(id);
  if (hit && Date.now() - hit.t < CHAPTERS_TTL_MS) return hit.chapters;
  const chapters = await loadChapters(id);
  chaptersCache.set(id, { t: Date.now(), chapters });
  if (chaptersCache.size > 400) chaptersCache.delete(chaptersCache.keys().next().value);
  return chapters;
}

app.get('/api/manga/:id/chapters', async (req, res) => {
  try {
    res.json({ chapters: await loadChapters(req.params.id) });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: 'manga not found' });
    console.error('chapters failed:', e.message);
    res.status(502).json({ error: 'failed to load chapters' });
  }
});

app.get('/api/chapter/:id/pages', async (req, res) => {
  if (req.params.id.startsWith('tx:')) {
    // شكل المعرّف: tx:<series-slug>:<chapter-number>
    const [, slug, num] = req.params.id.split(':');
    try {
      return res.json({ pages: await tx.pages(slug, num) });
    } catch (e) {
      console.error('teamx pages failed:', e.message);
      return res.status(502).json({ error: 'failed to load pages' });
    }
  }
  if (req.params.id.startsWith('asq:')) {
    // شكل المعرّف: asq:<manga-slug>:<chapter-slug>
    const [, slug, chapterSlug] = req.params.id.split(':');
    try {
      const pages = await asq.pages(slug, chapterSlug);
      // بعض الفصول القديمة على المصدر روابط صورها معطوبة (404) — نتحقق من أول
      // صفحة فقط ونُعلم الواجهة، حتى تعرض رسالة واضحة بدل شاشة بيضاء.
      let broken = false;
      if (pages.length) {
        try {
          const first = decodeURIComponent(pages[0].split('u=')[1] || '');
          const head = await fetch(first, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 Chrome/126', Referer: `${asq.BASE}/` },
            signal: AbortSignal.timeout(6000),
          });
          broken = !head.ok;
        } catch (e) { /* الشبكة تتعثر أحياناً — لا نعتبره فصلاً معطوباً */ }
      }
      return res.json({ pages, broken });
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'failed to load chapter pages' });
    }
  }
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'chapter not found' });
  try {
    const data = await cachedFetchJson(`${MD_BASE}/at-home/server/${req.params.id}`);
    const { baseUrl, chapter } = data;
    const pages = chapter.data.map(
      (fileName) => `/img?u=${encodeURIComponent(`${baseUrl}/data/${chapter.hash}/${fileName}`)}`
    );
    res.json({ pages });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to load chapter pages' });
  }
});

// Image proxy: avoids client-side CORS/hotlink issues, keeps requests light via caching
//
// أمان (2026-08-27): الفحص القديم كان `u.includes('mangadex')` — أي رابط تحته
// الكلمة في أي موضع كان يمرّ (مثال مؤكَّد: /img?u=https://example.com/?x=mangadex
// كان يُرجع صفحة example.com بـ200). هذا كان يعني: (1) open proxy/SSRF — أي أحد
// يستعمل هذا السيرفر لتحميل محتوى خارجي، (2) أخطر: الرد يخرج بـContent-Type
// نصي/HTML من دوميننا، فيمكن تشغيل JS مهاجم في سياق dzmanga وقراءة localStorage
// (تقدّم القراءة/المفضلة). القاعدة الآن: allow-list على hostname مُحلَّل فعلياً
// (لا includes على السلسلة أبداً) + رفض أي رد ليس صورة.
const IMG_HOSTS = new Set(['uploads.mangadex.org', 'api.mangadex.org', 'mangadex.org']);
function isAllowedImageUrl(u) {
  if (typeof u !== 'string' || !u) return false;
  let parsed;
  try {
    parsed = new URL(u);
  } catch (e) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  const mdHost =
    IMG_HOSTS.has(host) || host.endsWith('.mangadex.org') || host.endsWith('.mangadex.network');
  // صور فصول MangaDex تُخدَم من عُقد MangaDex@Home بأسماء مضيف متغيرة
  // (*.mangadex.network) — لذلك النطاق مسموح كامل، لا رابط بعينه.
  return mdHost || asq.isAsqImage(u) || tx.isTxImage(u);
}

app.get('/img', async (req, res) => {
  const u = req.query.u;
  if (!isAllowedImageUrl(u)) {
    return res.status(400).send('bad url');
  }
  try {
    // Short timeout: during a network-level IP block the TLS handshake can
    // succeed but the response never arrives, which would otherwise hang
    // this request for a long time before falling back to the redirect.
    const isAsq = asq.isAsqImage(u);
    const isTx = tx.isTxImage(u);
    const upstream = await fetch(u, {
      headers: isTx
        ? {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Referer: `${tx.BASE}/`,
          }
        : isAsq
        ? {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            Referer: `${asq.BASE}/`,
          }
        : { 'User-Agent': 'dzmanga/1.0' },
      signal: AbortSignal.timeout(isAsq || isTx ? 15000 : 6000),
    });
    if (!upstream.ok) return res.status(upstream.status).end();
    // دفاع ثانٍ (2026-08-27): لا نُعيد أبداً رداً ليس صورة. حتى لو صار خطأ في
    // الـallow-list يوماً، لا يمكن تحويل هذا المسار إلى تقديم HTML/JS من دوميننا.
    const upstreamType = String(upstream.headers.get('content-type') || '').toLowerCase();
    if (!upstreamType.startsWith('image/')) return res.status(415).send('not an image');
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
    // ضغط الصور (2026-08-22): صفحات الفصول من المصادر تصل بأحجام ضخمة
    // (قيست صفحات 2-6MB — فصل واحد ~40-50MB!). قاتل للزوار على داتا موبايل
    // في الجزائر ويأكل bandwidth السيرفر. نحوّل لـWebP بعرض أقصى 1080px
    // (أعرض من أي شاشة موبايل، والقارئ لا يعرض أعرض من ذلك أصلاً).
    // ?raw=1 يتجاوز الضغط إن احتجنا الأصل يوماً. إذا فشل sharp (صورة
    // معطوبة/صيغة غريبة) نرجع الأصل كما كان — لا شاشة بيضاء أبداً.
    if (req.query.raw !== '1') {
      try {
        const out = await withImgSlot(() =>
          sharp(buf, { failOn: 'none' })
            .resize({ width: IMG_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: IMG_WEBP_QUALITY })
            .toBuffer()
        );
        // نادراً يكون الأصل أصغر (أيقونات صغيرة مثلاً) — نرسل الأصغر دائماً
        if (out.length < buf.length) {
          res.set('Content-Type', 'image/webp');
          return res.send(out);
        }
      } catch (e) {
        console.error('img resize failed (serving original):', e.message);
      }
    }
    res.set('Content-Type', upstreamType || 'image/jpeg');
    res.send(buf);
  } catch (e) {
    // Server-side fetch failed — most likely the same network-level IP
    // block that hits the JSON API (see cachedFetchJson). No good binary
    // proxy exists for images (jina.ai reader only handles text, and
    // image proxy services like weserv.nl block the mangadex domain by
    // policy), so fall back to sending the browser straight to the
    // original MangaDex CDN URL. The end-user's own IP isn't blocked, so
    // this recovers the image; it just skips the ISP-friendliness this
    // proxy normally provides.
    //
    // IMPORTANT: MangaDex's cover CDN has Referer-based hotlink protection
    // — a request whose Referer is our own domain gets served a generic
    // "you can read this at mangadex.org" placeholder instead of the real
    // cover (confirmed by testing headers directly: identical request with
    // no Referer returns the real image, with our Referer returns the
    // placeholder). `Referrer-Policy: no-referrer` on this redirect makes
    // the browser drop the Referer on the follow-up request it makes to
    // the redirect target, so the real cover loads.
    res.set('Referrer-Policy', 'no-referrer');
    res.redirect(302, u);
  }
});

// ---------------------------------------------------------------------------
// SEO layer (added 2026-08-21). The SPA is hash-routed (#/manga/...), which
// search engines cannot index. So we expose crawlable "pretty" URLs:
//   /manga/<id>  → serves index.html with that manga's real <title>/meta/OG
//                  tags injected between the <!--SEO:START/END--> markers,
//                  plus a tiny inline script that sets location.hash so the
//                  SPA opens the right page for human visitors.
//   /sitemap.xml → built from the in-memory fullCatalog + 3asq home lists.
//   /robots.txt  → allows everything, points to the sitemap.
// PUBLIC_ORIGIN can be overridden via env when the domain changes.
// ---------------------------------------------------------------------------
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://www.dzmanga.dpdns.org';
const INDEX_HTML = () => require('fs').readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const escHtml = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escXml = escHtml;

// ---------------------------------------------------------------------------
// روابط زحف حقيقية (crawl links) — أُضيفت 2026-08-26 بعد تقرير GSC: الروابط
// الداخلية كانت كلها #/hash (JS-only)، فجوجل يعرف صفحات /manga/:id فقط من
// sitemap.xml (بطيء الاكتشاف). الحل: نحقن <a href="/manga/ID"> **حقيقية** في
// الـHTML الخام القادم من السيرفر (نفس الروابط اللي التطبيق نفسه يقدّمها
// للمستخدم عبر الكروت، فقط مصدرها هنا HTML ثابت لا JS) — مخفية بصرياً بتقنية
// sr-only القياسية (لا display:none، نفس أسلوب روابط "تجاوز إلى المحتوى")
// وليست محتوى مختلفاً عن الذي يراه المستخدم، فهي ليست cloaking.
// لا تحذف هذه الدوال ولا العلامة <!--CRAWL_LINKS--> في index.html.
const SR_ONLY_STYLE =
  'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';

function crawlLinksNav(items, label) {
  if (!items || !items.length) return '';
  const links = items
    .filter((m) => m && m.id) // دفاعي: عنصر بلا id يولّد رابط /manga/null فاسد
    .map((m) => `<a href="/manga/${encodeURIComponent(m.id)}">${escHtml(m.title || m.id)}</a>`)
    .join('');
  return `<nav class="crawl-links" aria-label="${escHtml(label)}" style="${SR_ONLY_STYLE}">${links}</nav>`;
}

// روابط زحف لصفحات الفصول (2026-08-27). صفحة المانجا كانت تعرض الفصول عبر JS
// فقط (#/read/..)، فجوجل ما كانش يوصل لأي فصل. هنا نحقن روابط <a> حقيقية إلى
// المسار القابل للفهرسة /read/<manga>/<chapter> (نفس ما يفتحه الزائر بالضغط).
const CHAPTER_CRAWL_LIMIT = 400;

function chapterCrawlNav(mangaId, chapters, mangaTitle) {
  if (!chapters || !chapters.length) return '';
  const links = chapters
    .slice(-CHAPTER_CRAWL_LIMIT)
    .filter((c) => c && c.id)
    .map(
      (c) =>
        `<a href="/read/${encodeURIComponent(mangaId)}/${encodeURIComponent(c.id)}">${escHtml(
          `${mangaTitle || ''} الفصل ${c.chapter ?? ''}`.trim()
        )}</a>`
    )
    .join('');
  return `<nav class="crawl-links" aria-label="كل الفصول" style="${SR_ONLY_STYLE}">${links}</nav>`;
}

function shufflePick(arr, n) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Combined, deduped pool: 3asq home lists (always available immediately) +
// the MangaDex fullCatalog (empty for ~1min right after a restart — see
// AGENTS.md). Both crawl-links routes below draw from this same pool.
async function crawlCandidatePool() {
  const seen = new Set();
  const out = [];
  const asqHome = await cachedAsqHome().catch(() => null);
  for (const list of [asqHome?.popular, asqHome?.latest]) {
    for (const m of list || []) {
      if (!m.id || seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  for (const m of fullCatalog.items) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

async function topCrawlItems(limit) {
  const pool = await crawlCandidatePool();
  return pool.slice(0, limit);
}

// ---------------------------------------------------------------------------
// تطبيق أندرويد (TWA) — أُضيف 2026-08-27
// التطبيق هو نفس هذا الموقع داخل Trusted Web Activity، فالإعلانات والمحتوى
// والتحديثات كلها من هنا مباشرة (لا كود واجهة منفصل يُصان).
//   /.well-known/assetlinks.json → يربط التطبيق بالنطاق. **بدونه** يظهر شريط
//     عنوان المتصفّح داخل التطبيق. بصمة التوقيع في src/assetlinks.json — لو
//     تغيّر مفتاح التوقيع (keystore) لازم تُحدَّث هنا وإلا انكسر الربط.
//   /download            → صفحة التحميل (SEO كامل + JSON-LD).
//   /download/dzmanga.apk → الملف نفسه من dist-app/ (خارج git: ملف ثنائي).
// الحجم/التاريخ/البصمة تُقرأ من الملف الحقيقي وقت الطلب — لا أرقام مكتوبة يدوياً
// تتناقض مع الملف المنشور.
const APK_PATH = path.join(__dirname, '..', 'dist-app', 'dzmanga.apk');
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const DOWNLOAD_TPL = () => require('fs').readFileSync(path.join(__dirname, 'views', 'download.html'), 'utf8');
const ASSETLINKS = () => require('fs').readFileSync(path.join(__dirname, 'assetlinks.json'), 'utf8');

app.get('/.well-known/assetlinks.json', (req, res) => {
  try {
    res.type('application/json').set('Cache-Control', 'public, max-age=3600').send(ASSETLINKS());
  } catch (e) {
    res.status(404).type('text/plain').send('not found');
  }
});

function apkInfo() {
  const st = require('fs').statSync(APK_PATH);
  return { size: st.size, mb: (st.size / 1048576).toFixed(2), mtime: st.mtime };
}

const AR_MONTHS = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const arDate = (d) => `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

app.get('/download', (req, res) => {
  let info;
  try {
    info = apkInfo();
  } catch (e) {
    // الملف غير موجود بعد على السيرفر — لا نعرض صفحة بحجم كاذب
    console.error('apk missing:', e.message);
    return res.status(503).type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>التطبيق غير متاح حالياً</title><body style="font-family:Tahoma;background:#1386c9;color:#fff;text-align:center;padding:60px"><h1>التطبيق غير متاح مؤقتاً</h1><p>نُعدّ إصداراً جديداً — عُد قريباً. <a style="color:#fff" href="/">تصفّح الموقع</a></p></body></html>');
  }
  let fp = '';
  try {
    fp = (JSON.parse(ASSETLINKS())[0].target.sha256_cert_fingerprints || [])[0] || '';
  } catch (e) { /* البصمة تحسين فقط، لا تُسقط الصفحة */ }
  const html = DOWNLOAD_TPL()
    .replace(/\{\{VERSION\}\}/g, escHtml(APP_VERSION))
    .replace(/\{\{SIZE_MB\}\}/g, info.mb)
    .replace(/\{\{UPDATED_AR\}\}/g, arDate(info.mtime))
    .replace(/\{\{UPDATED_ISO\}\}/g, info.mtime.toISOString().slice(0, 10))
    .replace(/\{\{FINGERPRINT\}\}/g, escHtml(fp));
  res.set('Cache-Control', 'public, max-age=900').type('html').send(html);
});

// نسخة قديمة من الرابط قد تُشارك بالخطأ — 301 حتى لا تتكرر الصفحة في الفهرس
app.get(['/download.html', '/app', '/apk'], (req, res) => res.redirect(301, '/download'));

app.get('/download/dzmanga.apk', (req, res) => {
  let info;
  try {
    info = apkInfo();
  } catch (e) {
    return res.status(404).type('text/plain').send('apk not found');
  }
  console.log(`apk download: ua="${String(req.get('user-agent') || '').slice(0, 120)}"`);
  res.set({
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="dzmanga-${APP_VERSION}.apk"`,
    'Content-Length': String(info.size),
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  require('fs').createReadStream(APK_PATH).pipe(res);
});

app.get('/robots.txt', (req, res) => {
  // /img مسموح لزواحف الصور فقط (2026-08-27): أغلفة المانجا مصدر زوّار حقيقي من
  // بحث صور جوجل، وكانت محجوبة كلياً. باقي الزواحف تبقى ممنوعة من /img حتى ما
  // تستهلكش CPU الـresize في زحف بلا فائدة. /api/ ممنوع للجميع (JSON، لا قيمة SEO).
  res
    .type('text/plain')
    .set('Cache-Control', 'public, max-age=3600')
    .send(
      `User-agent: Googlebot-Image\nAllow: /img\nAllow: /\nDisallow: /api/\n\n` +
        `User-agent: Bingbot\nAllow: /img\nAllow: /\nDisallow: /api/\n\n` +
        `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /img\n\n` +
        `Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml\n`
    );
});

// ---------------------------------------------------------------------------
// خرائط الموقع (أُعيدت هندستها 2026-08-27)
//   /sitemap.xml            → **فهرس** خرائط (sitemap index)
//   /sitemap-pages.xml      → الرئيسية + /download + كل صفحات /manga/:id
//   /sitemap-chapters-N.xml → صفحات الفصول /read/... (آلاف الروابط)
// لماذا: القارئ كان hash-only (#/read/..) فكانت **كل** صفحات الفصول مخفية عن
// جوجل، وهي المحتوى الذي يجلب الزوّار فعلاً ("مانجا X الفصل Y مترجم").
//
// ⚠️ خطأ قديم لا تُعِده: الخريطة كانت تُكاش ساعة كاملة **حتى لو** بُنيت في أول
// دقيقة بعد إعادة التشغيل وقت ما يكون fullCatalog فارغاً — فتُقدَّم خريطة فيها
// 35 رابطاً فقط بدل ~770 لمدة ساعة (وجوجل يسحبها فعلاً في هذه النافذة).
// الحل: ما نكاشيش النتيجة الناقصة إلا دقيقة واحدة.
const SITEMAP_TTL_MS = 60 * 60 * 1000;
const SITEMAP_PARTIAL_TTL_MS = 60 * 1000;
const CHAPTERS_PER_SITEMAP = 5000;
const SITEMAP_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

let pagesSitemap = { xml: '', t: 0, partial: true };

async function buildPagesSitemap() {
  const urls = new Map();
  urls.set(`${PUBLIC_ORIGIN}/`, '1.0');
  urls.set(`${PUBLIC_ORIGIN}/download`, '0.9');
  const asqHome = await cachedAsqHome().catch(() => null);
  for (const list of [asqHome?.popular, asqHome?.latest]) {
    for (const m of list || []) if (m.id) urls.set(`${PUBLIC_ORIGIN}/manga/${encodeURIComponent(m.id)}`, '0.8');
  }
  for (const m of fullCatalog.items) if (m.id) urls.set(`${PUBLIC_ORIGIN}/manga/${encodeURIComponent(m.id)}`, '0.6');
  const body = [...urls.entries()]
    .map(([loc, pr]) => `<url><loc>${escXml(loc)}</loc><priority>${pr}</priority></url>`)
    .join('\n');
  pagesSitemap = {
    xml: `${SITEMAP_HEAD}\n${body}\n</urlset>`,
    t: Date.now(),
    partial: !fullCatalog.items.length,
  };
  return pagesSitemap;
}

async function cachedPagesSitemap() {
  const ttl = pagesSitemap.partial ? SITEMAP_PARTIAL_TTL_MS : SITEMAP_TTL_MS;
  if (!pagesSitemap.xml || Date.now() - pagesSitemap.t > ttl) await buildPagesSitemap();
  return pagesSitemap.xml;
}

// فهرس الفصول: يُبنى في الخلفية (كل 6 ساعات) من مانجات 3asq في الرئيسية.
// طلب واحد لكل مانجا، فما يثقّلش المصدر، والنتيجة تُقدّم جاهزة للزواحف.
const CHAPTER_INDEX_REBUILD_MS = 6 * 60 * 60 * 1000;
let chapterIndex = { urls: [], builtAt: 0, building: false, known: new Set() };

function readUrl(mangaId, chapterId) {
  return `${PUBLIC_ORIGIN}/read/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`;
}

async function buildChapterIndex() {
  if (chapterIndex.building) return;
  chapterIndex.building = true;
  try {
    const pool = await crawlCandidatePool().catch(() => []);
    const targets = pool.filter((m) => m.id && m.id.startsWith('asq:')).slice(0, 60);
    const urls = [];
    for (const m of targets) {
      try {
        const chapters = await cachedChapters(m.id);
        for (const ch of chapters) if (ch && ch.id) urls.push(readUrl(m.id, ch.id));
      } catch (e) {
        console.error('chapter index: skipped', m.id, e.message);
      }
    }
    if (!urls.length) return;
    const fresh = urls.filter((u) => !chapterIndex.known.has(u));
    const known = new Set(urls);
    chapterIndex = { urls, builtAt: Date.now(), building: false, known };
    console.log(`chapter index built: ${urls.length} chapter URLs (${fresh.length} new)`);
    // إخطار فوري لمحركات البحث بالفصول الجديدة (Bing/Yandex/Naver عبر IndexNow).
    if (fresh.length && chapterIndex.builtAt) pingIndexNow(fresh).catch(() => {});
  } finally {
    chapterIndex.building = false;
  }
}

function chapterSitemapCount() {
  return Math.max(1, Math.ceil(chapterIndex.urls.length / CHAPTERS_PER_SITEMAP));
}

app.get('/sitemap.xml', async (req, res) => {
  try {
    await cachedPagesSitemap();
    const maps = [`${PUBLIC_ORIGIN}/sitemap-pages.xml`];
    if (chapterIndex.urls.length) {
      for (let i = 1; i <= chapterSitemapCount(); i++) maps.push(`${PUBLIC_ORIGIN}/sitemap-chapters-${i}.xml`);
    }
    const lastmod = new Date().toISOString().slice(0, 10);
    const body = maps.map((loc) => `<sitemap><loc>${escXml(loc)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n');
    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`);
  } catch (e) {
    console.error('sitemap index failed:', e.message);
    res.status(500).type('text/plain').send('sitemap unavailable');
  }
});

app.get('/sitemap-pages.xml', async (req, res) => {
  try {
    res.type('application/xml').send(await cachedPagesSitemap());
  } catch (e) {
    console.error('sitemap pages failed:', e.message);
    res.status(500).type('text/plain').send('sitemap unavailable');
  }
});

app.get('/sitemap-chapters-:n.xml', (req, res) => {
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > chapterSitemapCount() || !chapterIndex.urls.length) {
    return res.status(404).type('text/plain').send('not found');
  }
  const slice = chapterIndex.urls.slice((n - 1) * CHAPTERS_PER_SITEMAP, n * CHAPTERS_PER_SITEMAP);
  const body = slice.map((loc) => `<url><loc>${escXml(loc)}</loc><priority>0.7</priority></url>`).join('\n');
  res.type('application/xml').send(`${SITEMAP_HEAD}\n${body}\n</urlset>`);
});

// ---------------------------------------------------------------------------
// IndexNow (Bing / Yandex / Naver / Seznam) — فهرسة فورية بلا حساب ولا API key
// خارجي: الإثبات هو ملف المفتاح في src/public/<key>.txt (موجود منذ 2026-08-21).
// جوجل لا يدعم IndexNow — عنده Search Console + الـsitemap أعلاه.
// ⚠️ لا تُرسل أكثر من 10 آلاف رابط في الطلب، ولا تُرسل نفس الرابط مراراً بلا
// تغيير (تُعتبر إساءة استعمال). هنا نُرسل الجديد فقط، من بناء فهرس الفصول.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '042d2601047241428a8c8adbbb758525';
const INDEXNOW_MAX_PER_RUN = 2000;

async function pingIndexNow(urlList) {
  const urls = [...new Set(urlList)].slice(0, INDEXNOW_MAX_PER_RUN);
  if (!urls.length) return { skipped: true };
  const host = new URL(PUBLIC_ORIGIN).host;
  const payload = JSON.stringify({
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${PUBLIC_ORIGIN}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: payload,
    });
    console.log(`indexnow: sent ${urls.length} urls → ${r.status}`);
    return { status: r.status, count: urls.length };
  } catch (e) {
    console.error('indexnow failed:', e.message);
    return { error: e.message };
  }
}

app.get('/', async (req, res) => {
  let html = INDEX_HTML();
  try {
    const top = await topCrawlItems(90);
    html = html.replace('<!--CRAWL_LINKS-->', crawlLinksNav(top, 'روابط سريعة لأشهر المانجا'));
  } catch (e) {
    console.error('homepage crawl links failed:', e.message);
    html = html.replace('<!--CRAWL_LINKS-->', '');
  }
  res.set('Cache-Control', 'public, max-age=600').type('html').send(html);
});

// وصف الميتا يُستخدم كـsnippet في نتائج البحث العربية — لازم يكون عربي
// ويمثّل dzmanga نفسه. وصف MangaDex الخام إنجليزي دائماً، ووصف بعض صفحات
// العاشق (عند فشل استخراج القسم المخصص) يرجع فيه نص العاشق التسويقي نفسه
// ("...على موقع العاشق للمانجا") — الاثنان يفسدان الـSEO/العلامة، فنستبدلهما
// بقالب عربي يذكر dzmanga دائماً. (اكتُشف 2026-08-26 في فحص SEO شامل.)
const HAS_ARABIC = /[\u0600-\u06FF]/;
const SOURCE_BRAND_LEAK = /العاشق|3asq|mangadex\.org/i;
function safeMetaDescription(rawDesc, title) {
  const fallback = `اقرأ مانجا ${title} مترجمة للعربية مجاناً على dzmanga — قارئ سريع وخفيف بدون تسجيل.`;
  const d = String(rawDesc || '').trim();
  if (!d || !HAS_ARABIC.test(d) || SOURCE_BRAND_LEAK.test(d)) return fallback;
  return d;
}

app.get('/manga/:id', async (req, res) => {
  const id = req.params.id;
  let html = INDEX_HTML();
  let related = [];
  let chapterNav = '';
  try {
    const m = await loadMangaDetail(id);
    const title = `${m.title} — اقرأ بالعربية مجاناً | dzmanga`;
    const desc = safeMetaDescription(m.description, m.title).slice(0, 300);
    const pageUrl = `${PUBLIC_ORIGIN}/manga/${encodeURIComponent(id)}`;
    const img = m.cover ? (m.cover.startsWith('http') ? m.cover : PUBLIC_ORIGIN + m.cover) : `${PUBLIC_ORIGIN}/icon-512.png`;
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ComicSeries',
      name: m.title,
      url: pageUrl,
      image: img,
      inLanguage: 'ar',
      ...(m.author ? { author: { '@type': 'Person', name: m.author } } : {}),
      ...(m.description ? { description: desc } : {}),
    };
    const head = `
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}" />
<link rel="canonical" href="${escHtml(pageUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="dzmanga" />
<meta property="og:title" content="${escHtml(title)}" />
<meta property="og:description" content="${escHtml(desc)}" />
<meta property="og:url" content="${escHtml(pageUrl)}" />
<meta property="og:image" content="${escHtml(img)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escHtml(title)}" />
<meta name="twitter:description" content="${escHtml(desc)}" />
<meta name="twitter:image" content="${escHtml(img)}" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    html = html.replace(/<!--SEO:START-->[\s\S]*?<!--SEO:END-->/, `<!--SEO:START-->${head}\n<!--SEO:END-->`);
    const pool = await crawlCandidatePool();
    related = shufflePick(pool.filter((x) => x.id !== id), 5);
    chapterNav = chapterCrawlNav(id, await cachedChapters(id).catch(() => []), m.title);
  } catch (e) {
    // معرّف فاسد فعلياً (null/undefined/فارغ) — رابط تالف، ليس عملاً حقيقياً
    // اختفى مؤقتاً. نرجّع 404 حقيقي بدل 200 حتى ما يفهرسه جوجل كصفحة صالحة.
    if (e.status === 404) {
      return res.status(404).type('html').send(INDEX_HTML().replace('<!--CRAWL_LINKS-->', ''));
    }
    console.error('seo page failed for', id, e.message); // fall through: serve default head
  }
  html = html.replace('<!--CRAWL_LINKS-->', chapterNav + crawlLinksNav(related, 'أعمال مشابهة'));
  // open the right SPA view for human visitors (bots just read the meta)
  html = html.replace(
    '</head>',
    `<script>if(!location.hash)location.hash='#/manga/${encodeURIComponent(id).replace(/'/g, '')}';</script></head>`
  );
  res.set('Cache-Control', 'public, max-age=600').type('html').send(html);
});

// ---------------------------------------------------------------------------
// صفحة الفصل القابلة للفهرسة (2026-08-27) — أهم إضافة SEO في المشروع.
//   /read/<mangaId>/<chapterId>
// القارئ نفسه يبقى hash-routed (#/read/<chapterId>/<mangaId>/<idx>) كما هو —
// هذا المسار يقدّم **نفس** المحتوى مع عنوان ووصف عربيين حقيقيين للفصل، ثم
// يفتح القارئ للزائر البشري. بحث القرّاء العرب هو "مانجا X الفصل Y مترجم"،
// وبدون هذه الصفحات كان الموقع غائباً كلياً عن هذا البحث.
// ⚠️ لا تحوّل القارئ نفسه إلى SSR كامل: صور الفصل تُحمَّل عبر /img والقارئ
// يعتمد على JS؛ الهدف هنا الميتا + روابط الزحف، لا إعادة كتابة القارئ.
app.get('/read/:mangaId/:chapterId', async (req, res) => {
  const { mangaId, chapterId } = req.params;
  let html = INDEX_HTML();
  let idx = 0;
  let nav = '';
  try {
    const [m, chapters] = await Promise.all([loadMangaDetail(mangaId), cachedChapters(mangaId)]);
    idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx < 0) {
      // فصل غير موجود في هذه المانجا → 404 حقيقي، لا صفحة فارغة بحالة 200
      return res.status(404).type('html').send(INDEX_HTML().replace('<!--CRAWL_LINKS-->', ''));
    }
    const ch = chapters[idx];
    const num = ch.chapter ?? String(idx + 1);
    const title = `مانجا ${m.title} الفصل ${num} مترجم | dzmanga`;
    const desc =
      `اقرأ الفصل ${num} من مانجا ${m.title} مترجماً للعربية مجاناً وبجودة عالية على dzmanga` +
      `${ch.title ? ` — ${ch.title}` : ''}. قارئ سريع بدون تسجيل، ويعمل على الجوال.`;
    const pageUrl = readUrl(mangaId, chapterId);
    const mangaUrl = `${PUBLIC_ORIGIN}/manga/${encodeURIComponent(mangaId)}`;
    const img = m.cover ? (m.cover.startsWith('http') ? m.cover : PUBLIC_ORIGIN + m.cover) : `${PUBLIC_ORIGIN}/icon-512.png`;
    const ld = [
      {
        '@context': 'https://schema.org',
        '@type': 'ComicIssue',
        name: `${m.title} — الفصل ${num}`,
        issueNumber: String(num),
        url: pageUrl,
        image: img,
        inLanguage: 'ar',
        ...(ch.publishAt ? { datePublished: ch.publishAt } : {}),
        isPartOf: { '@type': 'ComicSeries', name: m.title, url: mangaUrl },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'dzmanga', item: `${PUBLIC_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: m.title, item: mangaUrl },
          { '@type': 'ListItem', position: 3, name: `الفصل ${num}`, item: pageUrl },
        ],
      },
    ];
    const prev = chapters[idx - 1];
    const next = chapters[idx + 1];
    const head = `
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc.slice(0, 300))}" />
<link rel="canonical" href="${escHtml(pageUrl)}" />
${prev ? `<link rel="prev" href="${escHtml(readUrl(mangaId, prev.id))}" />` : ''}
${next ? `<link rel="next" href="${escHtml(readUrl(mangaId, next.id))}" />` : ''}
<meta property="og:type" content="article" />
<meta property="og:site_name" content="dzmanga" />
<meta property="og:title" content="${escHtml(title)}" />
<meta property="og:description" content="${escHtml(desc.slice(0, 300))}" />
<meta property="og:url" content="${escHtml(pageUrl)}" />
<meta property="og:image" content="${escHtml(img)}" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escHtml(title)}" />
<meta name="twitter:description" content="${escHtml(desc.slice(0, 300))}" />
<meta name="twitter:image" content="${escHtml(img)}" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    html = html.replace(/<!--SEO:START-->[\s\S]*?<!--SEO:END-->/, `<!--SEO:START-->${head}\n<!--SEO:END-->`);
    const navLinks = [
      `<a href="${escHtml(mangaUrl)}">${escHtml(`كل فصول ${m.title}`)}</a>`,
      prev ? `<a href="${escHtml(readUrl(mangaId, prev.id))}">${escHtml(`الفصل ${prev.chapter ?? ''}`)}</a>` : '',
      next ? `<a href="${escHtml(readUrl(mangaId, next.id))}">${escHtml(`الفصل ${next.chapter ?? ''}`)}</a>` : '',
    ].join('');
    nav = `<nav class="crawl-links" aria-label="تنقّل الفصول" style="${SR_ONLY_STYLE}">${navLinks}</nav>`;
  } catch (e) {
    if (e.status === 404) {
      return res.status(404).type('html').send(INDEX_HTML().replace('<!--CRAWL_LINKS-->', ''));
    }
    console.error('chapter seo page failed for', mangaId, chapterId, e.message);
  }
  html = html.replace('<!--CRAWL_LINKS-->', nav);
  const hash = `#/read/${encodeURIComponent(chapterId)}/${encodeURIComponent(mangaId)}/${idx}`.replace(/'/g, '');
  html = html.replace('</head>', `<script>if(!location.hash)location.hash='${hash}';</script></head>`);
  res.set('Cache-Control', 'public, max-age=600').type('html').send(html);
});

// أي مسار غير معروف: نعرض واجهة الـSPA للزائر البشري لكن بحالة **404 حقيقية**
// بدل 200 (soft 404). غوغل كان يفهرس روابط غالطة على أنها صفحات صالحة ويضر
// بالـSEO. المسارات الصالحة كلها معالجة فوق هذا السطر (/, static, /api/*,
// /img, /manga/:id, robots, sitemap) — فكل ما يصل هنا هو فعلاً غير موجود.
app.get('*', (req, res) => {
  const html = INDEX_HTML().replace('<!--CRAWL_LINKS-->', '');
  res.status(404).type('html').send(html);
});

app.listen(PORT, () => {
  console.log(`dzmanga listening on :${PORT}`);
  // Warm the home cache immediately so the first real visitor isn't the one
  // who pays for the slow candidate-verification pass.
  buildHomePayload()
    .then((data) => {
      homeCache = { data, t: Date.now(), inflight: null };
      console.log('home cache warmed');
    })
    .catch((e) => console.error('home cache warm-up failed', e));
  // Full catalog index for the /browse "الكل" tab — slow (~30-60s across
  // ~978 candidates), so build it once in the background and refresh
  // periodically rather than per-request.
  buildFullCatalog();
  setInterval(buildFullCatalog, CATALOG_REBUILD_MS);
  // فهرس روابط الفصول لخرائط الموقع + إخطار IndexNow بالفصول الجديدة.
  // يبدأ بعد دقيقة حتى ما يتزاحمش مع تسخين الرئيسية وبناء الكاتالوج.
  setTimeout(buildChapterIndex, 60 * 1000);
  setInterval(buildChapterIndex, CHAPTER_INDEX_REBUILD_MS);
});
