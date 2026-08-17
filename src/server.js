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
  return `${UPLOADS_BASE}/covers/${mangaId}/${fileName}.${size}.jpg`;
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

app.get('/api/home', async (req, res) => {
  try {
    const popularUrl = `${MD_BASE}/manga?limit=18&includes[]=cover_art&includes[]=author&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
    const latestUrl = `${MD_BASE}/manga?limit=18&includes[]=cover_art&includes[]=author&order[latestUploadedChapter]=desc&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=${LANG}`;
    const [popular, latest] = await Promise.all([
      cachedFetchJson(popularUrl),
      cachedFetchJson(latestUrl),
    ]);
    res.json({
      popular: popular.data.map(mapManga),
      latest: latest.data.map(mapManga),
    });
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
    res.json({ results: data.data.map(mapManga) });
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
});
