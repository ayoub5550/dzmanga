const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3090;
const MD_BASE = 'https://api.mangadex.org';
const UPLOADS_BASE = 'https://uploads.mangadex.org';
const LANG = 'ar'; // dzmanga is an Arabic-first reader: only Arabic scanlations are shown

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use(express.json());

// simple in-memory cache to keep things fast + light on MangaDex rate limits
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function cachedFetchJson(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.data;
  const res = await fetch(url, { headers: { 'User-Agent': 'dzmanga/1.0' } });
  if (!res.ok) throw new Error(`MangaDex ${res.status} for ${url}`);
  const data = await res.json();
  cache.set(url, { t: Date.now(), data });
  return data;
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
    status: attrs.status,
    year: attrs.year,
    tags: (attrs.tags || []).map((t) => t.attributes?.name?.en).filter(Boolean),
    cover: coverUrl(m.id, coverRel?.attributes?.fileName),
    author: authorRel?.attributes?.name || null,
  };
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
  const flags = await mapWithConcurrency(mangaList, 10, (m) => hasReadableArabicChapter(m.id));
  return mangaList.filter((_, i) => flags[i]).slice(0, wanted);
}

// /api/home is the slowest endpoint (it has to verify ~2x18 candidate manga
// against MangaDex before it can answer), so its result is cached server-side
// and refreshed in the background — users almost always get an instant
// response from cache instead of paying the verification cost per request.
const HOME_CACHE_TTL_MS = 15 * 60 * 1000;
let homeCache = { data: null, t: 0, inflight: null };

async function buildHomePayload() {
  const WANTED = 18;
  const CANDIDATES = 30; // over-fetch since some will fail the readable-chapter check
  const popularUrl = `${MD_BASE}/manga?limit=${CANDIDATES}&includes[]=cover_art&includes[]=author&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
  const latestUrl = `${MD_BASE}/manga?limit=${CANDIDATES}&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
  const [popular, latest] = await Promise.all([
    cachedFetchJson(popularUrl),
    cachedFetchJson(latestUrl),
  ]);
  const [popularOk, latestOk] = await Promise.all([
    filterReadable(popular.data.map(mapManga), WANTED),
    filterReadable(latest.data.map(mapManga), WANTED),
  ]);
  return { popular: popularOk, latest: latestOk };
}

app.get('/api/home', async (req, res) => {
  try {
    const fresh = homeCache.data && Date.now() - homeCache.t < HOME_CACHE_TTL_MS;
    if (fresh) return res.json(homeCache.data);
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
    const data = await homeCache.inflight;
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to reach MangaDex' });
  }
});

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  try {
    const url = `${MD_BASE}/manga?title=${encodeURIComponent(q)}&limit=24&includes[]=cover_art&includes[]=author&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=${LANG}`;
    const data = await cachedFetchJson(url);
    const results = await filterReadable(data.data.map(mapManga), 24);
    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'search failed' });
  }
});

app.get('/api/manga/:id', async (req, res) => {
  try {
    const url = `${MD_BASE}/manga/${req.params.id}?includes[]=cover_art&includes[]=author`;
    const data = await cachedFetchJson(url);
    res.json(mapManga(data.data));
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to load manga' });
  }
});

app.get('/api/manga/:id/chapters', async (req, res) => {
  try {
    let offset = 0;
    let all = [];
    for (let i = 0; i < 15; i++) {
      const url = `${MD_BASE}/manga/${req.params.id}/feed?translatedLanguage[]=${LANG}&order[chapter]=asc&limit=500&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
      const data = await cachedFetchJson(url);
      all = all.concat(data.data);
      offset += 500;
      if (offset >= data.total || data.data.length === 0) break;
    }
    const chapters = all
      .filter((c) => c.attributes.pages > 0) // drop external-only/licensed chapters we can't render
      .map((c) => ({
        id: c.id,
        chapter: c.attributes.chapter,
        title: c.attributes.title,
        pages: c.attributes.pages,
        publishAt: c.attributes.publishAt,
      }));
    res.json({ chapters });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: 'failed to load chapters' });
  }
});

app.get('/api/chapter/:id/pages', async (req, res) => {
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
  if (!u || !(u.startsWith('https://') && u.includes('mangadex'))) {
    return res.status(400).send('bad url');
  }
  try {
    const upstream = await fetch(u, { headers: { 'User-Agent': 'dzmanga/1.0' } });
    if (!upstream.ok) return res.status(upstream.status).end();
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(502).end();
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
});
