const express = require('express');
const zlib = require('zlib');
const path = require('path');
const asq = require('./sources/asq');

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

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.use(express.json());

// simple in-memory cache to keep things fast + light on MangaDex rate limits
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

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
        cache.set(url, { t: Date.now(), data });
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
    cache.set(url, { t: Date.now(), data });
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
const translationCache = new Map(); // mangaId -> arabic text

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
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`;
  const res = await fetch(url, { headers: { 'User-Agent': 'dzmanga/1.0' } });
  if (!res.ok) throw new Error(`translate ${res.status}`);
  const data = await res.json();
  if (data.responseStatus && data.responseStatus !== 200) throw new Error('translate quota/error');
  return data.responseData?.translatedText || text;
}

async function translateDescriptionToArabic(mangaId, englishText) {
  if (!englishText) return englishText;
  if (translationCache.has(mangaId)) return translationCache.get(mangaId);
  try {
    const chunks = splitIntoChunks(englishText);
    const translated = [];
    for (const chunk of chunks) {
      translated.push(await translateChunk(chunk));
    }
    const full = translated.join(' ');
    translationCache.set(mangaId, full);
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

// /api/home يجمع المصدرين. أي مصدر يفشل يُرجع فارغاً بدل إسقاط الصفحة كلها
// (3asq و MangaDex ينقطعان أحياناً بشكل مستقل).
app.get('/api/home', async (req, res) => {
  const [asqHome, mdHome] = await Promise.all([
    cachedAsqHome().catch((e) => {
      console.error('3asq home failed:', e.message);
      return null;
    }),
    cachedMdHome().catch((e) => {
      console.error('mangadex home failed:', e.message);
      return null;
    }),
  ]);
  if (!asqHome && !mdHome) return res.status(502).json({ error: 'both sources unreachable' });
  const hero = (asqHome?.popular || []).slice(0, 6);
  res.json({
    hero: hero.length ? hero : mdHome?.hero || [],
    asq: asqHome || { latest: [], popular: [], genres: [] },
    md: mdHome || { popular: [], latest: [], genres: [] },
    // مفاتيح قديمة للتوافق مع أي عميل لم يُحدَّث بعد
    popular: mdHome?.popular || [],
    latest: mdHome?.latest || [],
    genres: mdHome?.genres || [],
  });
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
      mapped.forEach((m, i) => flags[i] && items.push(m));
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
  const [asqResults, mdResults] = await Promise.all([
    asq.search(q).catch((e) => {
      console.error('3asq search failed:', e.message);
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
  res.json({ results: [...asqResults, ...mdResults], asq: asqResults, md: mdResults });
});

app.get('/api/manga/:id', async (req, res) => {
  if (req.params.id.startsWith('asq:')) {
    try {
      return res.json(await asq.detail(req.params.id.slice(4)));
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'failed to load manga' });
    }
  }
  try {
    const url = `${MD_BASE}/manga/${req.params.id}?includes[]=cover_art&includes[]=author`;
    const data = await cachedFetchJson(url);
    const manga = mapManga(data.data);
    if (!manga.descriptionIsArabic && manga.description) {
      manga.description = await translateDescriptionToArabic(manga.id, manga.description);
    }
    delete manga.descriptionIsArabic;
    res.json(manga);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to load manga' });
  }
});

app.get('/api/manga/:id/chapters', async (req, res) => {
  if (req.params.id.startsWith('asq:')) {
    try {
      const chapters = await asq.chapters(req.params.id.slice(4));
      return res.json({ chapters });
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: 'failed to load chapters' });
    }
  }
  try {
    let offset = 0;
    let all = [];
    for (let i = 0; i < 15; i++) {
      const url = `${MD_BASE}/manga/${req.params.id}/feed?translatedLanguage[]=${LANG}&order[chapter]=asc&limit=500&offset=${offset}&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
      const data = await cachedFetchJson(url);
      all = all.concat(data.data);
      offset += 500;
      if (offset >= data.total || data.data.length === 0) break;
    }
    // Grouped by volume (like MangaDex's own chapter table) so long-running
    // series don't dump hundreds of flat rows on the reader.
    const chapters = all
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
    res.json({ chapters });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to load chapters' });
  }
});

app.get('/api/chapter/:id/pages', async (req, res) => {
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
app.get('/img', async (req, res) => {
  const u = req.query.u;
  const allowed = u && u.startsWith('https://') && (u.includes('mangadex') || asq.isAsqImage(u));
  if (!allowed) {
    return res.status(400).send('bad url');
  }
  try {
    // Short timeout: during a network-level IP block the TLS handshake can
    // succeed but the response never arrives, which would otherwise hang
    // this request for a long time before falling back to the redirect.
    const isAsq = asq.isAsqImage(u);
    const upstream = await fetch(u, {
      headers: isAsq
        ? {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            Referer: `${asq.BASE}/`,
          }
        : { 'User-Agent': 'dzmanga/1.0' },
      signal: AbortSignal.timeout(isAsq ? 15000 : 6000),
    });
    if (!upstream.ok) return res.status(upstream.status).end();
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=604800, immutable');
    const buf = Buffer.from(await upstream.arrayBuffer());
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
});
