// ---------------------------------------------------------------------------
// مصدر "Team-X" (olympustaff.com) — مانهوا كورية ومانها صينية مترجمة عربياً.
//
// لماذا هذا المصدر؟ 3asq قوي في المانجا اليابانية، وMangaDex عربيّه محدود
// (~735 عملاً)، أما المانهوا/المانها فأغلبها على مواقع الفرق العربية.
// جرّبنا (2026-08-22): mangalik.net و like-manga.net (قالب Madara) تُرجع
// صفحاتُ /manga/* منها 403 من Cloudflare — أي لا فصول ولا صور. azorafly.com
// (أزورا مون) يعطي 504 على /series/. Team-X يعمل بشكل كامل بـHTML عادي:
//   /series?page=N&genre=&type=&state=  → قائمة العناوين (10 بطاقات/صفحة)
//   /series/<slug>?page=N               → التفاصيل + 40 فصلاً لكل صفحة
//   /series/<slug>/<num>                → صور الفصل (class="manga-chapter-img")
//   /ajax/search?keyword=...            → بحث مباشر يُرجع HTML
//
// لا API رسمية → تحليل بـregex فقط (بدون cheerio؛ قاعدة المشروع: بلا
// اعتماديات ثقيلة) وكل شيء مخزّن مؤقتاً في الذاكرة.
// ---------------------------------------------------------------------------

const BASE = 'https://olympustaff.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const cache = new Map();
const TTL = {
  list: 10 * 60 * 1000,
  detail: 60 * 60 * 1000,
  chapters: 15 * 60 * 1000,
  pages: 6 * 60 * 60 * 1000,
};

async function fetchText(url, { ttl = TTL.list } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.body;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'ar,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      Referer: `${BASE}/`,
      'X-Requested-With': 'XMLHttpRequest',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`teamx ${res.status} for ${url}`);
  const body = await res.text();
  cache.set(url, { t: Date.now(), body });
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return body;
}

// ---- helpers -------------------------------------------------------------

const decodeEntities = (s = '') =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&laquo;|&raquo;|&lsaquo;|&rsaquo;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));

const stripTags = (html = '') =>
  decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const proxied = (url) => (url ? `/img?u=${encodeURIComponent(url)}` : null);

const slugFromUrl = (url = '') => {
  const m = url.match(/\/series\/([^/?#"]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

// ---- parsers -------------------------------------------------------------

// بطاقات القائمة: <div class="bs"><div class="bsx"><a href=…><div class="limit">
function parseCards(html) {
  const items = [];
  const seen = new Set();
  for (const block of html.split('class="bs"').slice(1)) {
    const href = (block.match(/href="([^"]*\/series\/[^"]+)"/) || [])[1];
    const slug = slugFromUrl(href || '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const img = (block.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    const title =
      stripTags((block.match(/class="tt[^"]*">([\s\S]*?)<\/div>/) || [])[1] || '') ||
      stripTags((block.match(/title="([^"]*)"/) || [])[1] || slug);
    items.push({
      id: `tx:${slug}`,
      source: 'tx',
      title,
      cover: proxied(img || null),
      latestChapter: stripTags((block.match(/class="epxs">([\s\S]*?)<\/div>/) || [])[1] || '') || null,
      type: stripTags((block.match(/class="type">([\s\S]*?)<\/span>/) || [])[1] || '') || null,
      status: stripTags((block.match(/class="status">([\s\S]*?)<\/span>/) || [])[1] || '') || null,
      rating: null,
    });
  }
  return items;
}

// نتائج /ajax/search — قائمة روابط مبسّطة
function parseSearchResults(html) {
  const items = [];
  const seen = new Set();
  for (const m of html.matchAll(/<a[^>]+href="([^"]*\/series\/[^"]+)"[\s\S]*?(?=<a[^>]+href="|$)/g)) {
    const slug = slugFromUrl(m[1]);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const block = m[0];
    const img = (block.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    const alt = (block.match(/<img[^>]+alt="([^"]*)"/) || [])[1];
    const text = stripTags(block.replace(/<img[^>]*>/g, ''));
    items.push({
      id: `tx:${slug}`,
      source: 'tx',
      title: decodeEntities(alt || '') || text.split(/\s{2,}/)[0] || slug,
      cover: proxied(img || null),
      latestChapter: null,
      rating: null,
    });
  }
  return items;
}

function parseDetail(html, slug) {
  const title =
    stripTags((html.match(/class="author-info-title[^"]*"[\s\S]*?<h1>([\s\S]*?)<\/h1>/) || [])[1] || '') ||
    stripTags((html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1] || '') ||
    slug;
  const cover =
    (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] ||
    (html.match(/class="thumbook"[\s\S]*?<img[^>]+src="([^"]+)"/) || [])[1] ||
    null;
  const genres = [...html.matchAll(/series\?genre=[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
  const info = (label) => {
    const re = new RegExp(`${label}[\\s\\S]{0,200}?<(?:span|div|small|h6)[^>]*>([^<]{1,60})<`, '');
    const m = html.match(re);
    return m ? stripTags(m[1]) : null;
  };
  const description =
    stripTags((html.match(/class="review-content"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '') ||
    stripTags((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  return {
    id: `tx:${slug}`,
    source: 'tx',
    sourceLabel: 'Team-X',
    sourceUrl: `${BASE}/series/${slug}`,
    title,
    description,
    cover: proxied(cover),
    tags: [...new Set(genres)],
    status: info('الحالة'),
    author: null,
    artist: info('الرسام'),
    type: info('النوع'),
    team: 'Team-X',
    year: null,
    rating: parseFloat((html.match(/التقييم[\s\S]{0,200}?([\d](?:\.\d)?)\s*<\/(?:span|div|b)/) || [])[1]) || null,
  };
}

function parseChapterCards(html, slug) {
  const out = [];
  for (const block of html.split('class="chapter-card"').slice(1)) {
    const href = (block.match(/href="([^"]*\/series\/[^"]+\/[^"]+)"/) || [])[1];
    const num =
      (block.match(/data-number="([\d.]+)"/) || [])[1] ||
      (href ? (href.match(/\/([\d.]+)(?:[?#].*)?$/) || [])[1] : null);
    if (!num) continue;
    const label = stripTags((block.match(/class="chapter-number">([\s\S]*?)<\/div>/) || [])[1] || '');
    const t = stripTags((block.match(/class="chapter-title">([\s\S]*?)<\/div>/) || [])[1] || '');
    out.push({
      id: `tx:${slug}:${num}`,
      chapter: num,
      // "الفصل رقم 150" لا يضيف شيئاً فوق رقم الفصل — نتجاهله
      title: t && !/^الفصل\s*(رقم\s*)?[\d.]+$/.test(t) && t !== label ? t : null,
      dateText: stripTags((block.match(/class="chapter-date">([\s\S]*?)<\/div>/) || [])[1] || '') || null,
      locked: false,
    });
  }
  return out;
}

function parsePages(html) {
  return [...html.matchAll(/<img[^>]+class="[^"]*manga-chapter-img[^"]*"[^>]*>/g)]
    .map((m) => (m[0].match(/\ssrc="\s*([^"]+?)\s*"/) || [])[1])
    .filter(Boolean)
    .map(proxied);
}

// ---- public API ----------------------------------------------------------

// أنواع Team-X كما تظهر في مُرشِّح الموقع
const TYPES = {
  manhwa: 'مانهوا كورية',
  manhua: 'مانها صيني',
  manga: 'مانجا ياباني',
  webtoon: 'ويب تون انجليزية',
  arabic: 'عربي',
};

async function list({ page = 1, genre = null, type = null } = {}) {
  const qs = new URLSearchParams({ page: String(page) });
  if (genre) qs.set('genre', genre);
  if (type) qs.set('type', TYPES[type] || type);
  const html = await fetchText(`${BASE}/series?${qs}`);
  const items = parseCards(html);
  const pages = [...html.matchAll(/series\?[^"]*page=(\d+)/g)].map((m) => Number(m[1]));
  const hasNext = pages.some((p) => p > page) || items.length >= 10;
  return { items, page, hasNext: hasNext && items.length > 0 };
}

async function search(q) {
  const html = await fetchText(`${BASE}/ajax/search?keyword=${encodeURIComponent(q)}`, {
    ttl: 5 * 60 * 1000,
  });
  return parseSearchResults(html);
}

async function detail(slug) {
  const html = await fetchText(`${BASE}/series/${encodeURIComponent(slug)}`, { ttl: TTL.detail });
  return parseDetail(html, slug);
}

// الفصول موزّعة 40 لكل صفحة، وعدد الصفحات يظهر في شريط الترقيم.
async function chapters(slug) {
  const first = await fetchText(`${BASE}/series/${encodeURIComponent(slug)}`, { ttl: TTL.chapters });
  const all = parseChapterCards(first, slug);
  const last = Math.max(
    1,
    ...[...first.matchAll(/\/series\/[^"]+\?page=(\d+)/g)].map((m) => Number(m[1]))
  );
  const MAX_PAGES = 25; // حتى ~1000 فصل — أكثر من أي عمل على الموقع
  const rest = await Promise.all(
    Array.from({ length: Math.min(last, MAX_PAGES) - 1 }, (_, i) =>
      fetchText(`${BASE}/series/${encodeURIComponent(slug)}?page=${i + 2}`, { ttl: TTL.chapters })
        .then((h) => parseChapterCards(h, slug))
        .catch(() => [])
    )
  );
  for (const chunk of rest) all.push(...chunk);
  const seen = new Set();
  const unique = all.filter((c) => (seen.has(c.id) ? false : seen.add(c.id)));
  // الموقع يعرض الأحدث أولاً؛ باقي التطبيق يتوقع ترتيباً تصاعدياً
  unique.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));
  return unique;
}

async function pages(slug, num) {
  const html = await fetchText(
    `${BASE}/series/${encodeURIComponent(slug)}/${encodeURIComponent(num)}`,
    { ttl: TTL.pages }
  );
  return parsePages(html);
}

// تصنيفات مختارة بأسماء Team-X العربية (قيمة المُرشِّح = نفس النص)
const GENRES = [
  { key: 'action', label: 'أكشن', slug: 'أكشن' },
  { key: 'romance', label: 'رومانسي', slug: 'رومانسي' },
  { key: 'fantasy', label: 'فانتازيا', slug: 'فانتازيا' },
  { key: 'isekai', label: 'إيسيكاي', slug: 'إيسيكاي' },
  { key: 'martial', label: 'فنون قتال', slug: 'فنون قتال' },
  { key: 'drama', label: 'دراما', slug: 'دراما' },
  { key: 'comedy', label: 'كوميدي', slug: 'كوميدي' },
  { key: 'mystery', label: 'غموض', slug: 'غموض' },
];

module.exports = {
  BASE,
  GENRES,
  TYPES,
  list,
  search,
  detail,
  chapters,
  pages,
  isTxImage: (u) => u.startsWith('https://olympustaff.com/'),
};
