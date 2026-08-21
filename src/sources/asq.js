// ---------------------------------------------------------------------------
// مصدر "مانجا العاشق" (3asq) — محتوى عربي أصلي مترجم من فرق عربية.
//
// لماذا هذا المصدر؟ MangaDex لا يحوي إلا ~735 عملاً بفصول عربية قابلة للقراءة،
// وأغلب الترجمات العربية الحديثة (ون بيس، ناروتو، المانهوا الكورية...) تُنشر على
// مواقع الفرق العربية مباشرة. جرّبنا Comick (api.comick.dev) أولاً: يعرض آلاف
// العناوين بلغة `ar` لكنه مجرد مرآة لبيانات MangaDex ولا يستضيف الصور
// (`md_images: []` في كل الفصول العربية التي اختبرناها، 2026-08-21) — أي لا
// قيمة إضافية للقراءة. لذلك المصدر الثاني هو 3asq مباشرة.
//
// لا توجد API رسمية، لذا نقرأ صفحات عامة ونحلّلها بـregex فقط (بدون cheerio
// أو أي حزمة جديدة — قاعدة المشروع: خفيف بلا اعتماديات ثقيلة). كل الطلبات
// مخزّنة مؤقتاً في الذاكرة لتخفيف الحمل على الموقع.
// ---------------------------------------------------------------------------

const BASE = 'https://3asq.online';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const cache = new Map();
const TTL = {
  list: 10 * 60 * 1000, // قوائم التصفح تتغير عدة مرات يومياً
  detail: 60 * 60 * 1000,
  chapters: 10 * 60 * 1000,
  pages: 6 * 60 * 60 * 1000, // صور فصل منشور لا تتغير عملياً
};

async function fetchText(url, { method = 'GET', ttl = TTL.list } = {}) {
  const key = `${method} ${url}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.body;
  const res = await fetch(url, {
    method,
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'ar,en;q=0.8',
      Referer: `${BASE}/`,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`3asq ${res.status} for ${url}`);
  const body = await res.text();
  cache.set(key, { t: Date.now(), body });
  return body;
}

// ---- helpers -------------------------------------------------------------

const decodeEntities = (s = '') =>
  s
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));

const stripTags = (html = '') => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Madara يقدّم صوراً بأحجام مصغّرة (…-175x238.jpg). نطلب النسخة الأصلية
// للأغلفة الكبيرة في صفحة التفاصيل، والمصغّرة تكفي في الشبكات.
const fullSize = (url = '') => url.replace(/-\d+x\d+(\.(jpg|jpeg|png|webp))$/i, '$1');

const slugFromUrl = (url = '') => {
  const m = url.match(/\/manga\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

function proxied(url) {
  if (!url) return null;
  return `/img?u=${encodeURIComponent(url)}`;
}

// ---- parsers -------------------------------------------------------------

// بطاقات المانجا في صفحات الأرشيف/البحث (قالب Madara: .page-item-detail)
function parseCards(html) {
  const items = [];
  const seen = new Set();
  const blocks = html.split('page-item-detail').slice(1);
  for (const block of blocks) {
    const linkMatch = block.match(/href="(https?:\/\/[^"]*\/manga\/[^"]+)"[^>]*title="([^"]*)"/);
    const href = linkMatch ? linkMatch[1] : (block.match(/href="(https?:\/\/[^"]*\/manga\/[^"]+)"/) || [])[1];
    const slug = slugFromUrl(href || '');
    if (!slug || seen.has(slug)) continue;
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/);
    const titleMatch =
      block.match(/<h3[^>]*>\s*(?:<span[^>]*>.*?<\/span>\s*)?<a[^>]*>([^<]+)<\/a>/s) ||
      block.match(/title="([^"]+)"/);
    const chapterMatch = block.match(/chapter-item[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
    const ratingMatch = block.match(/total_votes">\s*([\d.]+)/);
    seen.add(slug);
    items.push({
      id: `asq:${slug}`,
      source: 'asq',
      title: stripTags(titleMatch ? titleMatch[1] : slug),
      cover: proxied(imgMatch ? imgMatch[1] : null),
      latestChapter: chapterMatch ? stripTags(chapterMatch[1]) : null,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
    });
  }
  return items;
}

// صفحة البحث في Madara تستعمل قالباً مختلفاً (row c-tabs-item__content)
function parseSearchCards(html) {
  const items = [];
  const seen = new Set();
  const blocks = html.split('class="row c-tabs-item__content"').slice(1);
  for (const block of blocks) {
    const href = (block.match(/href="(https?:\/\/[^"]*\/manga\/[^"]+)"/) || [])[1];
    const slug = slugFromUrl(href || '');
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const img = (block.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    const title = stripTags((block.match(/<h3[^>]*><a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || slug);
    const latest = stripTags((block.match(/latest-chap[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '');
    items.push({
      id: `asq:${slug}`,
      source: 'asq',
      title,
      cover: proxied(img || null),
      latestChapter: latest || null,
      rating: parseFloat((block.match(/total_votes">\s*([\d.]+)/) || [])[1]) || null,
    });
  }
  return items;
}

function parseDetail(html, slug) {
  const title =
    stripTags((html.match(/<div class="post-title">[\s\S]*?<h1>([\s\S]*?)<\/h1>/) || [])[1] || '') || slug;
  const cover =
    (html.match(/<div class="summary_image">[\s\S]*?<img[^>]+src="([^"]+)"/) || [])[1] ||
    (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] ||
    null;
  const descBlock =
    (html.match(/<div class="description-summary">([\s\S]*?)<\/div>\s*<\/div>/) || [])[1] ||
    (html.match(/<div class="summary__content[^"]*">([\s\S]*?)<\/div>/) || [])[1] ||
    '';
  let description = stripTags(descBlock).replace(/^عرض المزيد/, '').trim();
  if (!description) {
    description = stripTags((html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || '');
  }
  const genres = [...html.matchAll(/manga-genre\/[^"]*"[^>]*>([^<]+)<\/a>/g)]
    .map((m) => stripTags(m[1]))
    .filter((g) => g && !/^(100%|3asq)$/i.test(g));
  const infoText = (label) => {
    const re = new RegExp(`<h5>\\s*${label}\\s*</h5>([\\s\\S]*?)</div>\\s*</div>`);
    const m = html.match(re);
    return m ? stripTags(m[1]) : null;
  };
  const status = infoText('الحالة') || null;
  const author = infoText('الكاتب') || null;
  const artist = infoText('الرسام') || null;
  const type = infoText('النوع') || null;
  const team = infoText('فرق الترجمة') || null;
  const year = (html.match(/manga-release\/(\d{4})/) || [])[1] || null;
  const rating = parseFloat((html.match(/total_votes">\s*([\d.]+)/) || [])[1]) || null;
  return {
    id: `asq:${slug}`,
    source: 'asq',
    sourceLabel: 'مانجا العاشق',
    sourceUrl: `${BASE}/manga/${slug}/`,
    title,
    description: description || '',
    cover: proxied(cover ? fullSize(cover) : null),
    tags: genres,
    status,
    author: author && author !== 'Updating' ? author : null,
    artist,
    type,
    team,
    year: year ? Number(year) : null,
    rating,
  };
}

function parseChapters(html, slug) {
  const out = [];
  const blocks = [...html.matchAll(/<li class="wp-manga-chapter[^"]*">([\s\S]*?)<\/li>/g)];
  for (const [, block] of blocks) {
    const href = (block.match(/href="([^"]+)"/) || [])[1];
    if (!href) continue;
    const chSlug = (href.match(/\/manga\/[^/]+\/([^/?#]+)/) || [])[1];
    if (!chSlug) continue;
    const label = stripTags((block.match(/<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || '');
    const date = stripTags((block.match(/chapter-release-date[\s\S]*?<i>([\s\S]*?)<\/i>/) || [])[1] || '');
    const num = (label.match(/^\s*([\d.]+)/) || [])[1] || null;
    const title = label.replace(/^\s*[\d.]+\s*[-–—]\s*/, '').trim();
    out.push({
      id: `asq:${slug}:${chSlug}`,
      chapter: num,
      title: num && title && title !== label.trim() ? title : num ? null : label,
      dateText: date || null,
      locked: /premium|مدفوع/i.test(block),
    });
  }
  // الموقع يعرض الأحدث أولاً؛ نُرجعها تصاعدياً لتطابق ترتيب باقي التطبيق
  return out.reverse();
}

function parsePages(html) {
  const imgs = [...html.matchAll(/<img[^>]+class="wp-manga-chapter-img"[^>]*>/g)].map((m) => m[0]);
  const urls = imgs
    .map((tag) => {
      const src =
        (tag.match(/data-src="\s*([^"]+?)\s*"/) || [])[1] || (tag.match(/\ssrc="\s*([^"]+?)\s*"/) || [])[1];
      return src ? src.trim() : null;
    })
    .filter(Boolean);
  return urls.map(proxied);
}

// ---- public API ----------------------------------------------------------

const ORDER = {
  latest: 'latest', // آخر التحديثات
  popular: 'views', // الأكثر مشاهدة
  trending: 'trending', // رائج
  new: 'new-manga',
  rating: 'rating',
};

async function list({ order = 'latest', page = 1, genre = null } = {}) {
  const path = genre ? `/manga-genre/${encodeURIComponent(genre)}/` : '/manga/';
  const pagePart = page > 1 ? `page/${page}/` : '';
  const url = `${BASE}${path}${pagePart}?m_orderby=${ORDER[order] || 'latest'}`;
  const html = await fetchText(url);
  const items = parseCards(html);
  // Madara لا يطبع العدد الكلي للصفحات في هذا القالب (زر "التالي" فقط)، لذا
  // نكتفي بمعرفة هل توجد صفحة تالية — الواجهة تعرض ترقيماً بلا رقم نهائي.
  const hasNext = new RegExp(`/page/${page + 1}/`).test(html);
  return { items, page, hasNext };
}

async function search(q) {
  const url = `${BASE}/?s=${encodeURIComponent(q)}&post_type=wp-manga`;
  const html = await fetchText(url);
  const results = parseSearchCards(html);
  return results.length ? results : parseCards(html);
}

async function detail(slug) {
  const html = await fetchText(`${BASE}/manga/${encodeURIComponent(slug)}/`, { ttl: TTL.detail });
  return parseDetail(html, slug);
}

async function chapters(slug) {
  // نقطة AJAX الخاصة بقالب Madara: تُرجع قائمة الفصول كاملة (وليس أول 10 فقط)
  const html = await fetchText(`${BASE}/manga/${encodeURIComponent(slug)}/ajax/chapters/`, {
    method: 'POST',
    ttl: TTL.chapters,
  });
  return parseChapters(html, slug);
}

async function pages(slug, chapterSlug) {
  const html = await fetchText(
    `${BASE}/manga/${encodeURIComponent(slug)}/${encodeURIComponent(chapterSlug)}/`,
    { ttl: TTL.pages }
  );
  return parsePages(html);
}

// تصنيفات مختارة (روابط manga-genre الفعلية على الموقع)
const GENRES = [
  { key: 'action', label: 'أكشن', slug: 'action' },
  { key: 'romance', label: 'رومانسي', slug: 'romance' },
  { key: 'fantasy', label: 'خيال', slug: 'fantasy' },
  { key: 'comedy', label: 'كوميدي', slug: 'comedy' },
  { key: 'drama', label: 'دراما', slug: 'drama' },
  { key: 'adventure', label: 'مغامرة', slug: 'adventure' },
  { key: 'horror', label: 'رعب', slug: 'horror' },
  { key: 'school', label: 'مدرسي', slug: 'school-life' },
];

module.exports = {
  BASE,
  GENRES,
  list,
  search,
  detail,
  chapters,
  pages,
  isAsqImage: (u) => u.startsWith('https://3asq.online/') || u.startsWith('https://3asq.org/'),
};
