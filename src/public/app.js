// Lightweight inline-SVG line icons (currentColor stroke) — used instead of
// emoji everywhere in the UI for a cleaner, on-brand look. Keep additions
// minimal/consistent: 20x20 viewBox, stroke-width 1.7, round caps/joins.
const ICONS = {
  fire: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1.8c.3 2.4-1 3.6-2.2 4.9-1.3 1.4-2.3 3-2.3 5A4.5 4.5 0 0 0 10 16.2a4.5 4.5 0 0 0 4.5-4.5c0-1.1-.3-1.9-.8-2.7-.2.9-.8 1.6-1.5 1.9.3-2.3-.7-3.6-1.6-4.8-.5-.7-.8-1.5-.6-2.3Z"/></svg>',
  sparkle: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.6 4.6l2 2M13.4 13.4l2 2M15.4 4.6l-2 2M6.6 13.4l-2 2"/><circle cx="10" cy="10" r="2.4"/></svg>',
  sword: '<svg viewBox="0 0 20 20" fill="currentColor" stroke="none"><path d="M9 1.5h2l1 8.5H8l1-8.5Z"/><rect x="4.5" y="10.7" width="11" height="1.8" rx=".6"/><rect x="9" y="13.2" width="2" height="3.6" rx=".5"/><circle cx="10" cy="17.8" r="1.2"/></svg>',
  heart: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16.5S3 12.4 3 7.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 7 1.6c0 4.8-7 8.9-7 8.9Z"/></svg>',
  heartFill: '<svg viewBox="0 0 20 20" fill="currentColor" stroke="none"><path d="M10 16.9S2.6 12.6 2.6 7.5A3.9 3.9 0 0 1 10 5.7a3.9 3.9 0 0 1 7.4 1.8c0 5.1-7.4 9.4-7.4 9.4Z"/></svg>',
  portal: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><ellipse cx="10" cy="10" rx="7" ry="3.2"/><ellipse cx="10" cy="10" rx="3.2" ry="7"/></svg>',
  wand: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 13 7"/><path d="M15 2l.7 1.8L17.5 4.5 15.7 5.2 15 7l-.7-1.8L12.5 4.5l1.8-.7L15 2Z"/><path d="M5.5 12.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z"/></svg>',
  mask: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6c2-1.5 4-2 7-2s5 .5 7 2c0 6-3 10.5-7 10.5S3 12 3 6Z"/><path d="M7 9c.4.6 1 .9 1.7.9M13 9c-.4.6-1 .9-1.7.9M7.5 12.5c1 .8 4 .8 5 0"/></svg>',
  ghost: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17V9a6 6 0 0 1 12 0v8l-2-1.6L12 17l-2-1.6L8 17l-2-1.6L4 17Z"/><circle cx="7.8" cy="8.6" r=".4" fill="currentColor" stroke="none"/><circle cx="12.2" cy="8.6" r=".4" fill="currentColor" stroke="none"/></svg>',
  grid: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2.5" y="2.5" width="6" height="6" rx="1.2"/><rect x="11.5" y="2.5" width="6" height="6" rx="1.2"/><rect x="2.5" y="11.5" width="6" height="6" rx="1.2"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.2"/></svg>',
  book: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5c1.6-.9 3.4-1 5.5-.3v11.6c-2.1-.7-3.9-.6-5.5.3v-11.6ZM17 4.5c-1.6-.9-3.4-1-5.5-.3v11.6c2.1-.7 3.9-.6 5.5.3v-11.6Z"/></svg>',
  home: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1V8.5Z"/></svg>',
  search: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/></svg>',
  clock: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.3"/><path d="M10 5.6V10l2.8 1.8"/></svg>',
  school: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 2.8 6.6 10 10.2l7.2-3.6L10 3Z"/><path d="M5.5 8.6v4c0 1.4 2 2.4 4.5 2.4s4.5-1 4.5-2.4v-4"/></svg>',
  drama: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.5h6v5a3 3 0 0 1-6 0v-5ZM10.5 5.5h6v5a3 3 0 0 1-6 0v-5"/><path d="M5.2 12.4c.9.7 2.2.7 3.1 0M12.2 12.4c.9.7 2.2.7 3.1 0"/></svg>',
  compass: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="10" cy="10" r="7.3"/><path d="m13 7-1.7 4.3L7 13l1.7-4.3L13 7Z"/></svg>',
};

function icon(name, cls = '') {
  return `<span class="micon ${cls}" aria-hidden="true">${ICONS[name] || ''}</span>`;
}

const app = document.getElementById('app');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const liveResults = document.getElementById('liveResults');

// ---------------------------------------------------------------------------
// التخزين المحلي: تقدّم القراءة + المفضلة.
// قرار متعمّد (راجع AGENTS.md): لا حسابات ولا قاعدة بيانات — كل شيء على الجهاز
// عبر localStorage. لو احتجنا لاحقاً مزامنة بين الأجهزة نضيف معرّف جهاز بكوكي
// + SQLite، دون نظام تسجيل دخول كامل.
// ---------------------------------------------------------------------------
const STORE = {
  progress: 'dz_progress_v1', // mangaId -> { chapterId, chapter, idx, title, cover, at }
  read: 'dz_read_v1', // mangaId -> [chapterId, ...]
  favs: 'dz_favs_v1', // [{ id, title, cover, at }]
  mode: 'dz_mode_v1', // 'vert' | 'horiz' — وضع القراءة
  scroll: 'dz_scroll_v1', // chapterId -> scrollY (استئناف داخل الفصل)
};

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* الحصة ممتلئة أو التخزين معطّل — لا نُسقط الواجهة لأجل ذلك */
  }
}

// حفظ موضع التمرير داخل الفصل (مع تحديد الحجم حتى لا ينتفخ التخزين)
let scrollTimer = null;
function saveScroll(chapterId, y) {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    const all = load(STORE.scroll, {});
    all[chapterId] = Math.round(y);
    const keys = Object.keys(all);
    if (keys.length > 80) delete all[keys[0]];
    save(STORE.scroll, all);
  }, 400);
}
const readMode = () => load(STORE.mode, 'vert');
const getScroll = (chapterId) => load(STORE.scroll, {})[chapterId] || 0;

// إشعار صغير عابر
function toast(msg) {
  let el = document.getElementById('dzToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dzToast';
    el.className = 'dz-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.classList.remove('show'), 2200);
}

const getProgress = () => load(STORE.progress, {});
function setProgress(manga, chapter, idx) {
  const all = getProgress();
  all[manga.id] = {
    chapterId: chapter.id,
    chapter: chapter.chapter,
    idx,
    title: manga.title,
    cover: manga.cover,
    at: Date.now(),
  };
  save(STORE.progress, all);
}

const getRead = () => load(STORE.read, {});
function markRead(mangaId, chapterId) {
  const all = getRead();
  const list = new Set(all[mangaId] || []);
  list.add(chapterId);
  all[mangaId] = [...list].slice(-3000);
  save(STORE.read, all);
}

const getFavs = () => load(STORE.favs, []);
const isFav = (id) => getFavs().some((f) => f.id === id);
function toggleFav(manga) {
  const favs = getFavs();
  const i = favs.findIndex((f) => f.id === manga.id);
  if (i >= 0) favs.splice(i, 1);
  else favs.unshift({ id: manga.id, title: manga.title, cover: manga.cover, at: Date.now() });
  save(STORE.favs, favs);
  return i < 0;
}

// ---------------------------------------------------------------------------
// أدوات عامة
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// كاش ذاكرة + إلغاء تكرار الطلبات المتزامنة: الرجوع للخلف أو إعادة فتح صفحة
// يصبح فورياً بدل انتظار الشبكة من جديد.
const JSON_CACHE = new Map(); // url -> { t, data }
const JSON_INFLIGHT = new Map(); // url -> Promise
const JSON_TTL_MS = 5 * 60 * 1000;

async function getJson(url, { fresh = false } = {}) {
  const hit = JSON_CACHE.get(url);
  if (!fresh && hit && Date.now() - hit.t < JSON_TTL_MS) return hit.data;
  if (JSON_INFLIGHT.has(url)) return JSON_INFLIGHT.get(url);
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('request failed');
    const data = await res.json();
    JSON_CACHE.set(url, { t: Date.now(), data });
    if (JSON_CACHE.size > 120) JSON_CACHE.delete(JSON_CACHE.keys().next().value);
    return data;
  })().finally(() => JSON_INFLIGHT.delete(url));
  JSON_INFLIGHT.set(url, p);
  return p;
}

// تحميل مسبق صامت (لا يرمي أخطاء) — يُستعمل لتجهيز الفصل التالي مسبقاً.
function prefetchJson(url) {
  getJson(url).catch(() => {});
}
function preloadImages(urls) {
  urls.forEach((u) => {
    const im = new Image();
    im.referrerPolicy = 'no-referrer';
    im.src = u;
  });
}

const PLACEHOLDER = 'https://placehold.co/260x380/171f1a/8a9a8f?text=dzmanga';

function sourceLabel(src) {
  if (src === 'asq') return 'العاشق';
  if (src === 'tx') return 'Team-X';
  return 'MangaDex';
}

// فئة لون الشارة على البطاقة (لكل مصدر لونه)
function sourceClass(src) {
  return src === 'asq' ? 'asq' : src === 'tx' ? 'tx' : 'md';
}

function loadingHtml(text = 'جارِ التحميل…') {
  return `<div class="loading"><div class="spinner"></div>${text}</div>`;
}

// Generic error state with a retry button — المصادر تتعطل أحياناً، فكل شاشة
// خطأ يجب أن تسمح بإعادة المحاولة بنقرة واحدة.
function errorHtml(message, retryFn) {
  window.__retry = retryFn;
  return `<div class="empty">${message}<div style="margin-top:12px"><button class="btn primary" onclick="window.__retry && window.__retry()">أعد المحاولة</button></div></div>`;
}

function skeletonGrid(n = 12) {
  return `<div class="grid">${Array.from({ length: n })
    .map(() => `<div class="card"><div class="skeleton" style="aspect-ratio:2/3"></div></div>`)
    .join('')}</div>`;
}

// بطاقة على طريقة تطبيقات المانجا العربية (Manga Slayer وغيرها): غلاف + شارة
// آخر فصل + شارة المصدر + العنوان.
function cardHtml(m) {
  const cover = m.cover || PLACEHOLDER;
  const chapterBadge = m.latestChapter
    ? `<span class="card-chip ch">${escapeHtml(String(m.latestChapter).replace(/^الفصل\s*/, ''))}</span>`
    : '';
  const ratingBadge = m.rating ? `<span class="card-chip rate">★ ${m.rating}</span>` : '';
  return `<a class="card" href="#/manga/${encodeURIComponent(m.id)}">
    <div class="card-art">
      <img src="${cover}" loading="lazy" alt="${escapeHtml(m.title)}" referrerpolicy="no-referrer" />
      <span class="card-src ${sourceClass(m.source)}">${sourceLabel(m.source)}</span>
      <div class="card-chips">${chapterBadge}${ratingBadge}</div>
    </div>
    <div class="title">${escapeHtml(m.title)}</div>
  </a>`;
}

function rowHtml(items) {
  return `<div class="row">${items.map(cardHtml).join('')}</div>`;
}

function sectionHtml(iconName, label, items, more) {
  if (!items || !items.length) return '';
  return `<h2 class="section">${icon(iconName)} ${escapeHtml(label)}${
    more ? `<a class="more" href="${more.href}">${escapeHtml(more.label)} ←</a>` : ''
  }</h2>${rowHtml(items)}`;
}

// ---------------------------------------------------------------------------
// البحث الفوري في الشريط العلوي
// ---------------------------------------------------------------------------
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) {
    closeLiveResults();
    location.hash = `#/search/${encodeURIComponent(q)}`;
  }
});

function closeLiveResults() {
  liveResults.classList.remove('open');
  liveResults.innerHTML = '';
}

function liveItemHtml(m) {
  const cover = m.cover || 'https://placehold.co/68x96/171f1a/8a9a8f?text=%20';
  return `<a class="live-item" href="#/manga/${encodeURIComponent(m.id)}">
    <img src="${cover}" loading="lazy" referrerpolicy="no-referrer" />
    <span class="t">${escapeHtml(m.title)}</span>
    <span class="src ${sourceClass(m.source)}">${sourceLabel(m.source)}</span>
  </a>`;
}

let liveSearchTimer = null;
let liveSearchSeq = 0;
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearTimeout(liveSearchTimer);
  if (q.length < 2) {
    closeLiveResults();
    return;
  }
  const seq = ++liveSearchSeq;
  liveSearchTimer = setTimeout(async () => {
    try {
      const { results } = await getJson(`/api/search?q=${encodeURIComponent(q)}`);
      if (seq !== liveSearchSeq) return; // a newer keystroke already superseded this request
      liveResults.innerHTML = results.length
        ? results.slice(0, 8).map(liveItemHtml).join('')
        : '<div class="live-empty">لا توجد نتائج بالعربية.</div>';
      liveResults.classList.add('open');
    } catch (e) {
      /* silently ignore — the user can still press Enter for the full search page */
    }
  }, 350);
});

document.addEventListener('click', (e) => {
  if (!searchForm.contains(e.target)) closeLiveResults();
});
liveResults.addEventListener('click', () => closeLiveResults());
window.addEventListener('hashchange', closeLiveResults);
// قبل أي انتقال: احفظ موضع التمرير في خلاصة التصفّح للعودة إليه لاحقاً
window.addEventListener('hashchange', () => {}, false);
document.addEventListener('click', (e) => {
  if (e.target.closest('a[href^="#/"]')) saveCurrentFeedScroll();
}, true);

// ---------------------------------------------------------------------------
// الصفحة الرئيسية
// ---------------------------------------------------------------------------
function startHeroRotation() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dots span');
  if (!slides.length) return;
  let i = 0;
  clearInterval(window.__heroTimer);
  window.__heroTimer = setInterval(() => {
    slides[i].classList.remove('active');
    dots[i]?.classList.remove('active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('active');
    dots[i]?.classList.add('active');
  }, 4200);
}

function heroHtml(hero) {
  if (!hero || !hero.length) return '';
  const slides = hero
    .map(
      (m, i) => `
    <a class="hero-slide ${i === 0 ? 'active' : ''}" href="#/manga/${encodeURIComponent(m.id)}">
      <div class="bg" style="background-image:url('${m.cover}')"></div>
      <div class="fade"></div>
      <div class="hero-content">
        <span class="hero-badge">${icon('fire')} الأكثر شعبية</span>
        <div class="hero-title">${escapeHtml(m.title)}</div>
        <span class="hero-cta">اقرأ الآن ←</span>
      </div>
    </a>`
    )
    .join('');
  const dots = hero.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('');
  return `<div class="hero">${slides}<div class="hero-dots">${dots}</div></div>`;
}

// "تابع القراءة" — أهم قسم في تطبيقات المانجا: يعيدك مباشرة لآخر فصل فتحته.
function continueHtml() {
  const items = Object.entries(getProgress())
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);
  if (!items.length) return '';
  const cards = items
    .map(
      (p) => `<a class="cont-card" href="#/read/${encodeURIComponent(p.chapterId)}/${encodeURIComponent(p.id)}/${p.idx}">
      <img src="${p.cover || PLACEHOLDER}" loading="lazy" referrerpolicy="no-referrer" alt="${escapeHtml(p.title)}" />
      <div class="cont-info">
        <div class="t">${escapeHtml(p.title)}</div>
        <div class="c">الفصل ${escapeHtml(String(p.chapter ?? '؟'))}</div>
      </div>
    </a>`
    )
    .join('');
  return `<h2 class="section">${icon('clock')} تابع القراءة</h2><div class="row cont-row">${cards}</div>`;
}

async function renderHome() {
  setActiveNav('home');
  app.innerHTML = `
    <div class="hero skeleton" style="height:280px;margin:18px 0 8px"></div>
    <h2 class="section">${icon('sparkle')} آخر التحديثات</h2>${skeletonGrid(6)}
  `;
  try {
    const data = await getJson('/api/home');
    const asqData = data.asq || { latest: [], popular: [], genres: [] };
    const mdData = data.md || { latest: [], popular: [], genres: [] };
    let html = heroHtml(data.hero);
    html += continueHtml();
    html += sectionHtml('sparkle', 'آخر التحديثات — مانجا العاشق', asqData.latest, {
      href: '#/browse/asq/latest',
      label: 'الكل',
    });
    html += sectionHtml('fire', 'الأكثر شعبية — مانجا العاشق', asqData.popular, {
      href: '#/browse/asq/popular',
      label: 'الكل',
    });
    html += '<div class="ad-slot" data-ad="native"></div>';
    const txData = data.tx || { manhwa: [], manhua: [] };
    html += sectionHtml('sword', 'مانهوا كورية — Team-X', txData.manhwa, {
      href: '#/browse/tx/manhwa',
      label: 'الكل',
    });
    html += sectionHtml('portal', 'مانها صينية — Team-X', txData.manhua, {
      href: '#/browse/tx/manhua',
      label: 'الكل',
    });
    for (const g of asqData.genres || []) {
      html += sectionHtml(genreIconName(g.key), g.label, g.items, {
        href: `#/browse/asq/genre-${g.key}`,
        label: 'الكل',
      });
    }
    html += sectionHtml('sparkle', 'آخر التحديثات — MangaDex', mdData.latest, {
      href: '#/browse/md',
      label: 'الكل',
    });
    html += sectionHtml('fire', 'الأكثر شعبية — MangaDex', mdData.popular);
    app.innerHTML = html;
    startHeroRotation();
  } catch (e) {
    app.innerHTML = errorHtml('تعذّر الوصول إلى المصادر. حاول مجدداً بعد قليل.', renderHome);
  }
}

function genreIconName(key) {
  return {
    action: 'sword',
    romance: 'heart',
    isekai: 'portal',
    fantasy: 'wand',
    comedy: 'mask',
    horror: 'ghost',
    drama: 'drama',
    adventure: 'compass',
    school: 'school',
  }[key] || 'book';
}

// ---------------------------------------------------------------------------
// البحث (صفحة كاملة، مقسّمة حسب المصدر)
// ---------------------------------------------------------------------------
async function renderSearch(q) {
  setActiveNav('search');
  searchInput.value = q;
  app.innerHTML = `<h2 class="section">نتائج البحث عن "${escapeHtml(q)}"</h2>${skeletonGrid(12)}`;
  try {
    const data = await getJson(`/api/search?q=${encodeURIComponent(q)}`);
    const asqRes = data.asq || [];
    const txRes = data.tx || [];
    const mdRes = data.md || [];
    if (!asqRes.length && !txRes.length && !mdRes.length) {
      app.innerHTML = `<h2 class="section">نتائج البحث عن "${escapeHtml(q)}"</h2>
        <div class="empty">لا توجد نتائج بالعربية لهذا البحث.</div>`;
      return;
    }
    let html = '';
    if (asqRes.length)
      html += `<h2 class="section">${icon('book')} مانجا العاشق (${asqRes.length})</h2>
        <div class="grid">${asqRes.map(cardHtml).join('')}</div>`;
    if (txRes.length)
      html += `<h2 class="section">${icon('sword')} Team-X (${txRes.length})</h2>
        <div class="grid">${txRes.map(cardHtml).join('')}</div>`;
    if (mdRes.length)
      html += `<h2 class="section">${icon('grid')} MangaDex (${mdRes.length})</h2>
        <div class="grid">${mdRes.map(cardHtml).join('')}</div>`;
    app.innerHTML = html;
  } catch (e) {
    app.innerHTML = errorHtml('فشل البحث. حاول مجدداً.', () => renderSearch(q));
  }
}

// ---------------------------------------------------------------------------
// صفحة المانجا
// ---------------------------------------------------------------------------
// فصول MangaDex تأتي تصاعدياً ومجمّعة بالمجلدات؛ فصول العاشق تأتي تصاعدية بلا
// مجلدات. في الحالتين نحتفظ بالفهرس الأصلي (`idx`) لأن القارئ يعتمد عليه في
// التنقّل بين الفصول.
function groupChaptersByVolume(chapters, descending) {
  // نحفظ الفهرس الأصلي: إن كان موجوداً مسبقاً (قائمة مُصفّاة) لا نعيد ترقيمه
  const withIdx = chapters.map((c, idx) => ({ ...c, idx: c.idx ?? idx }));
  const ordered = descending ? [...withIdx].reverse() : withIdx;
  const groups = [];
  let current = null;
  for (const c of ordered) {
    const key = c.volume || 'no-volume';
    if (!current || current.key !== key) {
      current = { key, label: c.volume ? `المجلد ${c.volume}` : 'بدون مجلد', items: [] };
      groups.push(current);
    }
    current.items.push(c);
  }
  return groups;
}

function chapterRowHtml(c, mangaId, readSet) {
  const isRead = readSet.has(c.id);
  const date = c.dateText || (c.publishAt ? new Date(c.publishAt).toLocaleDateString('ar') : '');
  return `
    <a class="chapter-row ${isRead ? 'read' : ''}" href="#/read/${encodeURIComponent(c.id)}/${encodeURIComponent(mangaId)}/${c.idx}">
      <span>
        <span class="ch-title">الفصل ${c.chapter ?? '؟'}${c.title ? ' — ' + escapeHtml(c.title) : ''}</span>
        ${c.group ? `<span class="ch-group">${escapeHtml(c.group)}</span>` : ''}
      </span>
      <span class="date">${escapeHtml(date)}${isRead ? ' · مقروء' : ''}</span>
    </a>`;
}

function chaptersHtml(chapters, mangaId, descending) {
  if (!chapters.length) return '<div class="empty">لا توجد فصول بالعربية حالياً.</div>';
  const readSet = new Set(getRead()[mangaId] || []);
  const groups = groupChaptersByVolume(chapters, descending);
  return groups
    .map(
      (g) => `
    <div class="volume-group">
      ${g.key !== 'no-volume' || groups.length > 1 ? `<div class="volume-label">${escapeHtml(g.label)}</div>` : ''}
      <div class="chapters">${g.items.map((c) => chapterRowHtml(c, mangaId, readSet)).join('')}</div>
    </div>`
    )
    .join('');
}

async function renderManga(id) {
  setActiveNav(null);
  app.innerHTML = loadingHtml();
  try {
    const [manga, { chapters }] = await Promise.all([
      getJson(`/api/manga/${encodeURIComponent(id)}`),
      getJson(`/api/manga/${encodeURIComponent(id)}/chapters`),
    ]);
    const cover = manga.cover || PLACEHOLDER;
    let descending = true; // newest chapters first by default, like most manga readers
    const progress = getProgress()[manga.id];
    const resumeIdx = progress ? progress.idx : 0;
    const resumeChapter = chapters[resumeIdx] || chapters[0];
    const metaBits = [manga.author, manga.status, manga.year, manga.team].filter(Boolean);
    app.innerHTML = `
      <a class="backlink" href="#/">&rarr; رجوع</a>
      <div class="detail">
        <img src="${cover}" alt="${escapeHtml(manga.title)}" referrerpolicy="no-referrer" />
        <div class="info">
          <h1>${escapeHtml(manga.title)}</h1>
          <div class="meta">
            <span class="card-src ${sourceClass(manga.source)}" style="position:static">${sourceLabel(manga.source)}</span>
            ${manga.rating ? `<span class="dot-sep">★ ${manga.rating}</span>` : ''}
            ${metaBits.map((b) => `<span class="dot-sep">${escapeHtml(String(b))}</span>`).join('')}
          </div>
          <div class="tags">${(manga.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="desc">${escapeHtml(manga.description) || 'لا يوجد وصف.'}</div>
          <div class="detail-actions">
            ${
              resumeChapter
                ? `<a class="btn primary" href="#/read/${encodeURIComponent(resumeChapter.id)}/${encodeURIComponent(manga.id)}/${resumeIdx}">
                     ${progress ? `تابع من الفصل ${escapeHtml(String(resumeChapter.chapter ?? '؟'))}` : 'ابدأ القراءة'} ←
                   </a>`
                : ''
            }
            <button class="btn fav-btn" id="favBtn">${icon(isFav(manga.id) ? 'heartFill' : 'heart')} ${
              isFav(manga.id) ? 'في المفضلة' : 'أضف للمفضلة'
            }</button>
            <button class="btn" id="shareBtn">مشاركة ⤴</button>
          </div>
        </div>
      </div>
      <h2 class="section">
        الفصول (${chapters.length})
        <button class="btn more" id="sortToggle" style="margin-inline-start:auto">تنازلي ⇅</button>
      </h2>
      <div class="ch-tools">
        <input id="chFilter" class="ch-filter" type="search" inputmode="numeric"
               placeholder="اذهب إلى رقم فصل…" aria-label="تصفية الفصول برقم" />
        ${chapters.length > 1 ? `<a class="btn small" href="#/read/${encodeURIComponent(chapters[0].id)}/${encodeURIComponent(manga.id)}/0">الفصل الأول</a>
        <a class="btn small" href="#/read/${encodeURIComponent(chapters[chapters.length - 1].id)}/${encodeURIComponent(manga.id)}/${chapters.length - 1}">الأخير</a>` : ''}
      </div>
      <div id="chapterList">${chaptersHtml(chapters, manga.id, descending)}</div>
      <div class="ad-slot" data-ad="banner"></div>
    `;
    const chFilterEl = document.getElementById('chFilter');
    const paintChapters = () => {
      const q = (chFilterEl?.value || '').trim();
      const indexed = chapters.map((c, i) => ({ ...c, idx: c.idx ?? i }));
      const list = q
        ? indexed.filter((c) =>
            String(c.chapter ?? '').includes(q) || (c.title || '').includes(q)
          )
        : indexed;
      const listEl = document.getElementById('chapterList');
      listEl.innerHTML = list.length
        ? chaptersHtml(list, manga.id, descending)
        : '<div class="empty">لا فصل بهذا الرقم.</div>';
    };
    document.getElementById('sortToggle')?.addEventListener('click', (e) => {
      descending = !descending;
      e.target.textContent = descending ? 'تنازلي ⇅' : 'تصاعدي ⇅';
      paintChapters();
    });
    chFilterEl?.addEventListener('input', paintChapters);
    document.getElementById('favBtn')?.addEventListener('click', (e) => {
      const nowFav = toggleFav(manga);
      e.currentTarget.innerHTML = `${icon(nowFav ? 'heartFill' : 'heart')} ${nowFav ? 'في المفضلة' : 'أضف للمفضلة'}`;
    });
    document.getElementById('shareBtn')?.addEventListener('click', async (e) => {
      // pretty crawlable URL (server renders real OG tags for it) — not the #/hash one
      const shareUrl = `${location.origin}/manga/${encodeURIComponent(manga.id)}`;
      try {
        if (navigator.share) return void (await navigator.share({ title: manga.title, url: shareUrl }));
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // clipboard API needs a secure context — legacy fallback
        const ta = document.createElement('textarea');
        ta.value = shareUrl; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
      }
      e.currentTarget.textContent = 'نُسخ الرابط ✓';
      setTimeout(() => { const b = document.getElementById('shareBtn'); if (b) b.textContent = 'مشاركة ⤴'; }, 1800);
    });
    window.__mangaCache = window.__mangaCache || {};
    window.__mangaCache[manga.id] = manga;
    window.__chapterCache = window.__chapterCache || {};
    window.__chapterCache[manga.id] = chapters;
  } catch (e) {
    app.innerHTML = errorHtml('تعذّر تحميل هذه المانجا.', () => renderManga(id));
  }
}

// ---------------------------------------------------------------------------
// القارئ
// ---------------------------------------------------------------------------
async function renderReader(chapterId, mangaId, idx, forceVert = false) {
  // فصول «الشريط الطويل» (ويب تون/مانهوا) لا تصلح للوضع الأفقي؛ forceVert
  // يتجاوز تفضيل المستخدم لهذا الفصل فقط دون تغيير الإعداد المحفوظ.

  setActiveNav(null);
  app.innerHTML = loadingHtml('جارِ تحميل الفصل…');
  try {
    let chapters = window.__chapterCache?.[mangaId];
    if (!chapters) {
      const data = await getJson(`/api/manga/${encodeURIComponent(mangaId)}/chapters`);
      chapters = data.chapters;
      window.__chapterCache = window.__chapterCache || {};
      window.__chapterCache[mangaId] = chapters;
    }
    let manga = window.__mangaCache?.[mangaId];
    if (!manga) {
      manga = await getJson(`/api/manga/${encodeURIComponent(mangaId)}`).catch(() => ({
        id: mangaId,
        title: 'مانجا',
        cover: null,
      }));
      window.__mangaCache = window.__mangaCache || {};
      window.__mangaCache[mangaId] = manga;
    }
    const { pages, broken } = await getJson(`/api/chapter/${encodeURIComponent(chapterId)}/pages`);
    const mode = forceVert ? 'vert' : readMode();
    const i = parseInt(idx, 10);
    const current = chapters[i];
    const prev = chapters[i - 1];
    const next = chapters[i + 1];
    const goto = (c, at) =>
      c ? `location.hash='#/read/${encodeURIComponent(c.id)}/${encodeURIComponent(mangaId)}/${at}'` : '';

    app.innerHTML = `
      <div class="reader-head">
        <a class="backlink" href="#/manga/${encodeURIComponent(mangaId)}">&rarr; ${escapeHtml(manga.title || '')}</a>
        <button class="mode-toggle" id="modeToggle" type="button">${mode === 'horiz' ? 'وضع أفقي' : 'وضع رأسي'}</button>
        <select class="ch-select" id="chSelect" aria-label="انتقل إلى فصل">
          ${chapters
            .map(
              (c, n) =>
                `<option value="${n}" ${n === parseInt(idx, 10) ? 'selected' : ''}>الفصل ${escapeHtml(
                  String(c.chapter ?? n + 1)
                )}</option>`
            )
            .reverse()
            .join('')}
        </select>
        <span class="reader-chip"><span id="pageNow">1</span>/${pages.length}</span>
      </div>
      ${broken || !pages.length
        ? `<div class="empty" style="margin:14px 0">صور هذا الفصل غير متوفرة على المصدر حالياً (رابط معطوب عندهم).${
            next ? ' جرّب الفصل التالي.' : ''
          }</div>`
        : ''}
      <div class="reader${mode === 'horiz' ? ' horiz' : ''}" id="reader">
        ${pages
          .map(
            (p, n) =>
              `<img src="${p}" loading="${n < 3 ? 'eager' : 'lazy'}" decoding="async" fetchpriority="${n < 2 ? 'high' : 'auto'}" referrerpolicy="no-referrer" alt="صفحة ${n + 1}" />`
          )
          .join('')}
      </div>
      <!-- إعلان نهاية الفصل (2026-08-27): بعد آخر صفحة، أي عند نقطة توقّف
           طبيعية — لا شيء يظهر أثناء القراءة نفسها. أعلى نسبة ظهور (viewability)
           في الموقع لأن كل قارئ يمرّ من هنا. لحذفه: امسح سطر ad-slot التالي. -->
      <div class="ad-slot ad-labeled" data-ad="banner"></div>
      <div class="reader-end">
        ${
          next
            ? `<button class="btn primary big" onclick="${goto(next, i + 1)}">الفصل التالي (${escapeHtml(
                String(next.chapter ?? '')
              )}) &larr;</button>`
            : `<div class="empty" style="padding:20px 0">هذا آخر فصل متوفر حالياً.</div>`
        }
        <a class="btn" href="#/manga/${encodeURIComponent(mangaId)}">كل الفصول</a>
      </div>
      <div class="reader-progress"><span id="readerBar"></span></div>
      <div class="reader-bar">
        <button class="btn primary" ${next ? '' : 'disabled'} onclick="${goto(next, i + 1)}">التالي &larr;</button>
        <a class="btn" href="#/manga/${encodeURIComponent(mangaId)}">الفصول</a>
        <button class="btn" ${prev ? '' : 'disabled'} onclick="${goto(prev, i - 1)}">&rarr; السابق</button>
      </div>
    `;
    window.scrollTo(0, 0);

    if (current) {
      setProgress(manga, current, i);
      markRead(mangaId, current.id);
    }

    // شريط تقدّم القراءة داخل الفصل
    const bar = document.getElementById('readerBar');
    const counter = document.getElementById('pageNow');
    const imgs = Array.from(document.querySelectorAll('#reader img'));
    let prefetched = false;
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      bar.style.width = `${ratio * 100}%`;
      // رقم الصفحة الحالية = أول صورة ما زال أسفلها ظاهراً في الشاشة
      if (mode === 'horiz') return; // العدّاد الأفقي له معالج خاص
      if (counter) {
        const mid = window.scrollY + window.innerHeight * 0.4;
        let n = 1;
        for (let k = 0; k < imgs.length; k++) {
          // نتجاهل الصور التي لم تُحمَّل بعد (ارتفاعها 0 يجعل offsetTop مضلِّلاً)
          if (imgs[k].offsetHeight > 0 && imgs[k].offsetTop <= mid) n = k + 1;
          else if (imgs[k].offsetHeight > 0) break;
        }
        counter.textContent = String(n);
      }
      // حفظ موضع القراءة داخل الفصل (استئناف عند العودة)
      saveScroll(chapterId, window.scrollY);
      // تجهيز الفصل التالي مسبقاً بعد 55% من الفصل الحالي — الانتقال يصبح فورياً
      if (!prefetched && ratio > 0.55 && next) {
        prefetched = true;
        getJson(`/api/chapter/${encodeURIComponent(next.id)}/pages`)
          .then((d) => preloadImages((d.pages || []).slice(0, 3)))
          .catch(() => {});
      }
    };
    window.removeEventListener('scroll', window.__readerScroll || (() => {}));
    window.__readerScroll = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    // استئناف الموضع داخل نفس الفصل إن رجع إليه المستخدم
    const savedY = mode === 'horiz' ? 0 : getScroll(chapterId);
    if (savedY > 100) {
      requestAnimationFrame(() => window.scrollTo(0, savedY));
      toast('استأنفنا من حيث توقّفت');
    }
    onScroll();

    // الانتقال المباشر بين الفصول من داخل القارئ (بدل الرجوع لصفحة المانجا)
    document.getElementById('chSelect')?.addEventListener('change', (e) => {
      const n = parseInt(e.target.value, 10);
      const c = chapters[n];
      if (c) location.hash = `#/read/${encodeURIComponent(c.id)}/${encodeURIComponent(mangaId)}/${n}`;
    });

    // تبديل وضع القراءة (رأسي/أفقي) — يُحفظ ويبقى للفصول القادمة
    // كشف فصول الشريط الطويل: أول صورة نسبتها طول/عرض > 2 تعني ويب تون —
    // الوضع الأفقي يصغّرها لشريط غير مقروء، فنفرض الرأسي ونخفي زر التبديل.
    const modeBtn = document.getElementById('modeToggle');
    const probe = document.querySelector('.reader img');
    const stripCheck = () => {
      if (!probe || !probe.naturalWidth) return;
      if (probe.naturalHeight / probe.naturalWidth > 2) {
        if (mode === 'horiz') {
          toast('هذا الفصل بصيغة شريط طويل — تم التحويل للوضع الرأسي');
          renderReader(chapterId, mangaId, idx, true);
        } else if (modeBtn) {
          modeBtn.style.display = 'none';
        }
      }
    };
    if (probe) {
      if (probe.complete) stripCheck();
      else probe.addEventListener('load', stripCheck, { once: true });
    }
    modeBtn?.addEventListener('click', () => {
      const nextMode = mode === 'horiz' ? 'vert' : 'horiz';
      save(STORE.mode, nextMode);
      renderReader(chapterId, mangaId, idx);
      toast(nextMode === 'horiz' ? 'وضع القراءة: أفقي' : 'وضع القراءة: رأسي');
    });

    // في الوضع الأفقي التقدّم يُقاس بالتمرير الأفقي داخل الحاوية
    if (mode === 'horiz') {
      if (counter) counter.textContent = '1';
      const rd = document.getElementById('reader');
      rd.addEventListener('scroll', () => {
        const max = rd.scrollWidth - rd.clientWidth;
        const done = max > 0 ? Math.min(1, Math.abs(rd.scrollLeft) / max) : 0;
        bar.style.width = `${done * 100}%`;
        if (counter) counter.textContent = String(Math.min(imgs.length, Math.round(done * (imgs.length - 1)) + 1));
      }, { passive: true });
    }

    // تحديث العدّاد بعد اكتمال تحميل كل صورة (المواضع تتغيّر مع الارتفاعات)
    imgs.forEach((im) => im.addEventListener('load', () => onScroll(), { once: true }));

    // إعادة محاولة تلقائية لأي صفحة فشلت صورتها (مصدر 3asq يتعثّر أحياناً)
    imgs.forEach((im) => {
      im.addEventListener('error', () => {
        if (im.dataset.retried) return;
        im.dataset.retried = '1';
        const base = im.src.split('&_r=')[0];
        setTimeout(() => { im.src = `${base}&_r=${Date.now()}`; }, 800);
        im.addEventListener('error', () => {
          im.replaceWith(
            Object.assign(document.createElement('div'), {
              className: 'empty',
              style: 'margin:8px 0',
              textContent: `تعذّر تحميل الصفحة ${im.alt.replace('صفحة ', '')} من المصدر`,
            })
          );
        }, { once: true });
      });
    });

    // مناطق نقر على الحواف: يمين = السابق، يسار = التالي (اتجاه عربي)
    const reader = document.getElementById('reader');
    // وضع القراءة الصافي: نقرة وسط الشاشة تُخفي/تُظهر كل الأزرار والأشرطة
    const toggleZen = () => {
      const on = document.body.classList.toggle('zen');
      if (on && !load('dz_zen_hint_v1', false)) {
        save('dz_zen_hint_v1', true);
        toast('وضع القراءة الصافي — اضغط وسط الشاشة لإظهار الأزرار');
      }
    };
    reader.addEventListener('click', (e) => {
      const x = e.clientX / window.innerWidth;
      if (mode === 'horiz') {
        if (x >= 0.3 && x <= 0.7) toggleZen(); // الحواف للسحب/التنقّل
        return;
      }
      if (x > 0.85 && prev) location.hash = `#/read/${encodeURIComponent(prev.id)}/${encodeURIComponent(mangaId)}/${i - 1}`;
      else if (x < 0.15 && next) location.hash = `#/read/${encodeURIComponent(next.id)}/${encodeURIComponent(mangaId)}/${i + 1}`;
      else toggleZen();
    });

    // اختصارات لوحة المفاتيح (RTL: السهم الأيسر = التالي)
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && next) location.hash = `#/read/${encodeURIComponent(next.id)}/${encodeURIComponent(mangaId)}/${i + 1}`;
      if (e.key === 'ArrowRight' && prev) location.hash = `#/read/${encodeURIComponent(prev.id)}/${encodeURIComponent(mangaId)}/${i - 1}`;
    };
    document.removeEventListener('keydown', window.__readerKey || (() => {}));
    window.__readerKey = onKey;
    document.addEventListener('keydown', onKey);
  } catch (e) {
    app.innerHTML = errorHtml('تعذّر تحميل هذا الفصل.', () => renderReader(chapterId, mangaId, idx));
  }
}

// ---------------------------------------------------------------------------
// مكتبتي (المفضلة + سجل القراءة) — كلها محلية على الجهاز
// ---------------------------------------------------------------------------
function renderLibrary() {
  setActiveNav('library');
  const favs = getFavs();
  const history = Object.entries(getProgress())
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.at - a.at);
  let html = `<h2 class="section">${icon('heartFill')} المفضلة (${favs.length})</h2>`;
  html += favs.length
    ? `<div class="grid">${favs.map((f) => cardHtml({ ...f, source: f.id.startsWith('asq:') ? 'asq' : f.id.startsWith('tx:') ? 'tx' : 'md' })).join('')}</div>`
    : `<div class="empty">لم تُضف أي مانجا للمفضلة بعد — افتح أي مانجا واضغط "أضف للمفضلة".</div>`;
  html += `<h2 class="section">${icon('clock')} سجل القراءة</h2>`;
  html += history.length
    ? `<div class="chapters">${history
        .map(
          (p) => `<a class="chapter-row" href="#/read/${encodeURIComponent(p.chapterId)}/${encodeURIComponent(p.id)}/${p.idx}">
            <span><span class="ch-title">${escapeHtml(p.title)}</span>
            <span class="ch-group">الفصل ${escapeHtml(String(p.chapter ?? '؟'))}</span></span>
            <span class="date">${new Date(p.at).toLocaleDateString('ar')}</span>
          </a>`
        )
        .join('')}</div>
       <div style="text-align:center;padding:18px"><button class="btn" id="clearHist">امسح السجل</button></div>`
    : `<div class="empty">لا يوجد سجل قراءة بعد.</div>`;
  app.innerHTML = html;
  document.getElementById('clearHist')?.addEventListener('click', () => {
    save(STORE.progress, {});
    renderLibrary();
  });
}

// ---------------------------------------------------------------------------
// التصفّح: مصدران + ترتيب + تصنيفات
// ---------------------------------------------------------------------------
const ASQ_GENRES = [
  { key: 'action', label: 'أكشن' },
  { key: 'romance', label: 'رومانسي' },
  { key: 'fantasy', label: 'خيال' },
  { key: 'comedy', label: 'كوميدي' },
  { key: 'drama', label: 'دراما' },
  { key: 'adventure', label: 'مغامرة' },
  { key: 'horror', label: 'رعب' },
  { key: 'school', label: 'مدرسي' },
];

// تبويبات مصدر MangaDex — يجب أن تبقى متوافقة مع GENRES في src/server.js
const MD_TABS = [
  { key: 'all', label: 'الكل', icon: 'grid' },
  { key: 'action', label: 'أكشن', icon: 'sword' },
  { key: 'romance', label: 'رومانسي', icon: 'heart' },
  { key: 'isekai', label: 'إيسيكاي', icon: 'portal' },
  { key: 'fantasy', label: 'خيال', icon: 'wand' },
  { key: 'comedy', label: 'كوميدي', icon: 'mask' },
  { key: 'horror', label: 'رعب', icon: 'ghost' },
];

// تبويبات مصدر Team-X — يجب أن تبقى متوافقة مع TYPES/GENRES في src/sources/teamx.js
const TX_TABS = [
  { key: 'manhwa', label: 'مانهوا كورية', icon: 'sparkle' },
  { key: 'manhua', label: 'مانها صينية', icon: 'grid' },
  { key: 'manga', label: 'مانجا يابانية', icon: 'fire' },
  { key: 'webtoon', label: 'ويب تون', icon: 'portal' },
  { key: 'action', label: 'أكشن', icon: 'sword' },
  { key: 'romance', label: 'رومانسي', icon: 'heart' },
  { key: 'isekai', label: 'إيسيكاي', icon: 'portal' },
  { key: 'martial', label: 'فنون قتال', icon: 'sword' },
  { key: 'fantasy', label: 'فانتازيا', icon: 'wand' },
  { key: 'drama', label: 'دراما', icon: 'mask' },
  { key: 'comedy', label: 'كوميدي', icon: 'mask' },
  { key: 'mystery', label: 'غموض', icon: 'ghost' },
];

// ---------------------------------------------------------------------------
// خلاصة التصفّح: تحميل تدريجي (infinite scroll) بدل الترقيم.
// نضيف البطاقات إلى نفس الشبكة، مع زر "تحميل المزيد" كبديل عند تعطّل المراقب،
// ونحفظ حالة الخلاصة (HTML + موضع التمرير) للعودة إليها من صفحة المانجا.
// ---------------------------------------------------------------------------
function feedShellHtml(note) {
  return `
    ${note ? `<div class="browse-note" id="feedNote">${note}</div>` : '<div class="browse-note" id="feedNote" hidden></div>'}
    <div class="grid" id="feedGrid"></div>
    <div id="feedStatus" class="feed-status"></div>
    <div id="feedSentinel" class="feed-sentinel" aria-hidden="true"></div>`;
}

// fetchPage(page) -> { items, hasNext, note? , retryAfter? }
function mountFeed(body, key, fetchPage) {
  body.innerHTML = feedShellHtml('');
  const grid = body.querySelector('#feedGrid');
  const status = body.querySelector('#feedStatus');
  const note = body.querySelector('#feedNote');
  const sentinel = body.querySelector('#feedSentinel');
  const state = { page: 0, done: false, busy: false, count: 0 };
  body.dataset.feedKey = key;

  grid.innerHTML = skeletonGrid(18).replace(/^<div class="grid">|<\/div>$/g, '');

  async function loadNext(manual) {
    if (state.busy || state.done) return;
    state.busy = true;
    status.innerHTML = `<div class="loading"><div class="spinner"></div>جارِ التحميل…</div>`;
    try {
      const data = await fetchPage(state.page + 1);
      if (data.retryAfter) {
        status.innerHTML = `<div class="loading"><div class="spinner"></div>${escapeHtml(data.message || 'جارِ التحضير…')}</div>`;
        state.busy = false;
        setTimeout(() => loadNext(), data.retryAfter);
        return;
      }
      if (state.page === 0) grid.innerHTML = '';
      state.page += 1;
      const items = data.items || [];
      state.count += items.length;
      grid.insertAdjacentHTML('beforeend', items.map(cardHtml).join(''));
      // إعلان داخل الخلاصة (2026-08-27): مرة واحدة فقط بعد الصفحة الأولى، خارج
      // شبكة الكروت حتى لا يخرّب التنسيق. أُضيف بعد الكروت لا قبلها: القارئ يرى
      // محتوى أولاً (أفضل لـCTR وأفضل لتجربة الاستخدام).
      if (state.page === 1 && !grid.parentElement.querySelector('.ad-slot.feed-ad')) {
        grid.insertAdjacentHTML('afterend', '<div class="ad-slot ad-labeled feed-ad" data-ad="native"></div>');
      }
      if (data.note) { note.innerHTML = data.note; note.hidden = false; }
      state.done = !data.hasNext || !items.length;
      status.innerHTML = state.done
        ? (state.count
            ? `<div class="feed-end">${state.count === 0 ? '' : `وصلت إلى النهاية · ${state.count} عنواناً`}</div>`
            : `<div class="empty">لا توجد نتائج بالعربية في هذا القسم حالياً.</div>`)
        : `<button class="btn more" id="feedMore">تحميل المزيد ↓</button>`;
      status.querySelector('#feedMore')?.addEventListener('click', () => loadNext(true));
      saveFeedState(body);
    } catch (e) {
      if (state.page === 0) grid.innerHTML = '';
      status.innerHTML = errorHtml('تعذّر التحميل، حاول مجدداً.', () => loadNext(true));
    } finally {
      state.busy = false;
    }
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) loadNext();
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(sentinel);
    body.__feedObserver = io;
  }
  loadNext();
}

// حفظ/استرجاع حالة صفحة التصفّح حتى لا يبدأ الزائر من الصفحة الأولى بعد الرجوع
const FEED_CACHE = new Map();
function saveFeedState(body) {
  const key = body?.dataset?.feedKey;
  if (!key) return;
  FEED_CACHE.set(key, { html: body.innerHTML, y: window.scrollY });
  if (FEED_CACHE.size > 8) FEED_CACHE.delete(FEED_CACHE.keys().next().value);
}
function saveCurrentFeedScroll() {
  const body = document.getElementById('browseBody');
  if (!body?.dataset?.feedKey) return;
  const prev = FEED_CACHE.get(body.dataset.feedKey);
  FEED_CACHE.set(body.dataset.feedKey, { html: body.innerHTML, y: window.scrollY });
}

// route: #/browse/{asq|md}/{latest|popular|genre-KEY|md tab key}
async function renderBrowse(source = 'asq', view = '') {
  setActiveNav('browse');
  const isTx = source === 'tx';
  const isAsq = !isTx && source !== 'md';
  const asqOrder = view === 'popular' ? 'popular' : 'latest';
  const asqGenre = view.startsWith('genre-') ? view.slice(6) : null;
  const feedKey = `${source}|${view || 'default'}`;

  const sourceTabs = `
    <div class="source-switch">
      <button class="src-tab ${isAsq ? 'active' : ''}" data-src="asq">مانجا العاشق</button>
      <button class="src-tab ${isTx ? 'active' : ''}" data-src="tx">مانهوا (Team-X)</button>
      <button class="src-tab ${!isAsq && !isTx ? 'active' : ''}" data-src="md">MangaDex</button>
    </div>`;

  const asqTabs = `
    <div class="tabs">
      <button class="tab ${!asqGenre && asqOrder === 'latest' ? 'active' : ''}" data-view="latest">${icon('sparkle')}آخر التحديثات</button>
      <button class="tab ${!asqGenre && asqOrder === 'popular' ? 'active' : ''}" data-view="popular">${icon('fire')}الأكثر شعبية</button>
      ${ASQ_GENRES.map(
        (g) =>
          `<button class="tab ${asqGenre === g.key ? 'active' : ''}" data-view="genre-${g.key}">${icon(
            genreIconName(g.key)
          )}${g.label}</button>`
      ).join('')}
    </div>`;

  const txTabs = `
    <div class="tabs">
      ${TX_TABS.map(
        (t) =>
          `<button class="tab ${(view || 'manhwa') === t.key ? 'active' : ''}" data-view="${t.key}">${icon(t.icon)}${t.label}</button>`
      ).join('')}
    </div>`;

  const mdTabs = `
    <div class="tabs">
      ${MD_TABS.map(
        (t) =>
          `<button class="tab ${(view || 'all') === t.key ? 'active' : ''}" data-view="${t.key}">${icon(t.icon)}${t.label}</button>`
      ).join('')}
    </div>`;

  app.innerHTML = `<div class="browse-bar">${sourceTabs}${isAsq ? asqTabs : isTx ? txTabs : mdTabs}</div><div id="browseBody">${skeletonGrid(18)}</div>`;

  app.querySelectorAll('.src-tab').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.src !== source) location.hash = `#/browse/${btn.dataset.src}`;
    })
  );
  app.querySelectorAll('.tab').forEach((btn) =>
    btn.addEventListener('click', () => {
      location.hash = `#/browse/${source}/${btn.dataset.view}`;
    })
  );
  // التصنيف المفتوح يظهر دائماً في شريط التصنيفات (لا يبقى مخفياً خارج الشاشة)
  const activeTab = app.querySelector('.tab.active');
  activeTab?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const body = document.getElementById('browseBody');

  // استرجاع نفس الخلاصة وموضع التمرير عند الرجوع من صفحة مانجا
  const cached = FEED_CACHE.get(feedKey);
  if (cached) {
    body.innerHTML = cached.html;
    body.dataset.feedKey = feedKey;
    const status = body.querySelector('#feedStatus');
    status?.querySelector('#feedMore')?.addEventListener('click', () => renderBrowseFresh());
    // الصور تُحمَّل بتأجيل فيتغيّر ارتفاع الصفحة — نُعيد ضبط الموضع عدة مرات
    if (cached.y > 0) {
      let tries = 0;
      const restore = () => {
        window.scrollTo({ top: cached.y });
        // نكرر المحاولة حتى يستقر ارتفاع الصفحة (الأغلفة تُحمَّل تدريجياً)
        if (++tries < 25 && Math.abs(window.scrollY - cached.y) > 4) setTimeout(restore, 100);
      };
      requestAnimationFrame(restore);
    }
    return;
  }
  function renderBrowseFresh() {
    FEED_CACHE.delete(feedKey);
    renderBrowse(source, view);
  }

  if (isAsq) {
    const genreSlug = asqGenre ? { school: 'school-life' }[asqGenre] || asqGenre : null;
    mountFeed(body, feedKey, async (page) => {
      const qs = new URLSearchParams({ source: 'asq', page: String(page), order: asqOrder });
      if (genreSlug) qs.set('genre', genreSlug);
      const data = await getJson(`/api/browse?${qs}`);
      return { items: data.items, hasNext: data.hasNext };
    });
    return;
  }
  if (isTx) {
    const txView = view || 'manhwa';
    mountFeed(body, feedKey, async (page) => {
      const data = await getJson(`/api/browse?source=tx&view=${encodeURIComponent(txView)}&page=${page}`);
      return { items: data.items, hasNext: data.hasNext };
    });
    return;
  }
  if (!view || view === 'all') {
    mountFeed(body, feedKey, async (page) => {
      const data = await getJson(`/api/browse?source=md&page=${page}`);
      if (data.indexing)
        return {
          retryAfter: 3000,
          message: 'جارِ فهرسة كتالوج MangaDex العربي الكامل (~700+ مانجا)، ثوانٍ معدودة…',
        };
      return {
        items: data.items,
        hasNext: data.page < data.totalPages,
        note: `<b>${data.total}</b> مانجا عربية على MangaDex`,
      };
    });
    return;
  }
  mountFeed(body, feedKey, async () => {
    const data = await getJson(`/api/genre/${view}`);
    return { items: data.items, hasNext: false };
  });
}

// ---------------------------------------------------------------------------
// شريط التنقّل السفلي (شكل تطبيق الهاتف) + التوجيه
// ---------------------------------------------------------------------------
function setActiveNav(key) {
  document.querySelectorAll('.bottom-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === key);
  });
}


// ---------------------------------------------------------------------------
// الصفحات القانونية (سياسة الخصوصية، الشروط، DMCA، اتصل بنا)
// ---------------------------------------------------------------------------
const LEGAL_PAGES = {
  privacy: {
    title: 'سياسة الخصوصية',
    body: `
      <h2>مقدمة</h2>
      <p>خصوصيتك تهمنا. توضح هذه السياسة ما نجمعه من بيانات عند استخدامك موقع DZMANGA وكيف نستعمله ونحميه.</p>
      <h2>البيانات التي نجمعها</h2>
      <ul>
        <li><b>لا نطلب إنشاء حساب</b> ولا نجمع اسمك أو بريدك أو أي بيانات شخصية تعريفية.</li>
        <li><b>تقدّم القراءة والمفضلة</b> تُحفظ محليًا على جهازك فقط (localStorage) ولا تُرسل إلى خوادمنا.</li>
        <li><b>سجلات الخادم التقنية</b> (عنوان IP، نوع المتصفح، الصفحات المطلوبة) تُحفظ مؤقتًا لأغراض الأمان وتشخيص الأعطال ثم تُحذف دوريًا.</li>
      </ul>
      <h2>ملفات تعريف الارتباط (Cookies) والإعلانات</h2>
      <p>يعرض الموقع إعلانات من طرف ثالث (شبكة Adsterra). قد تستخدم شبكات الإعلانات ملفات تعريف الارتباط أو تقنيات مشابهة لعرض إعلانات ملائمة وقياس أدائها، وفق <a href="https://adsterra.com/privacy-policy/" target="_blank" rel="noopener">سياسة خصوصية Adsterra</a>. يمكنك حظر ملفات تعريف الارتباط من إعدادات متصفحك دون أن يتأثر عمل الموقع الأساسي.</p>
      <h2>خدمات الطرف الثالث</h2>
      <p>تُجلب أغلفة وصفحات المانجا من مصادر خارجية عامة عبر خوادمنا. لا نشارك أي بيانات عن زوارنا مع هذه المصادر.</p>
      <h2>الأطفال</h2>
      <p>الموقع موجّه لعموم القراء ولا يستهدف الأطفال دون 13 عامًا، ولا نجمع عن قصد أي بيانات عنهم.</p>
      <h2>التغييرات على هذه السياسة</h2>
      <p>قد نحدّث هذه السياسة من وقت لآخر، ويُعتبر استمرارك في استخدام الموقع بعد التحديث موافقةً على النسخة الجديدة.</p>
      <h2>التواصل</h2>
      <p>لأي استفسار حول الخصوصية راسلنا عبر صفحة <a href="#/page/contact">اتصل بنا</a>.</p>`
  },
  terms: {
    title: 'شروط الاستخدام',
    body: `
      <h2>قبول الشروط</h2>
      <p>باستخدامك موقع DZMANGA فأنت توافق على هذه الشروط. إذا كنت لا توافق على أي بند منها فيرجى التوقف عن استخدام الموقع.</p>
      <h2>طبيعة الخدمة</h2>
      <ul>
        <li>DZMANGA <b>قارئ ومكشطة محتوى</b>: يعرض أعمالًا منشورة على مصادر خارجية عامة ولا يستضيف أي ملفات أو فصول على خوادمه.</li>
        <li>جميع الحقوق في الأعمال المعروضة (الرسوم، القصص، الأسماء) محفوظة لمؤلفيها وناشريها الأصليين.</li>
        <li>الخدمة مقدمة «كما هي» دون أي ضمانات، وقد تتوقف مصادر خارجية عن العمل في أي وقت.</li>
      </ul>
      <h2>التزامات المستخدم</h2>
      <ul>
        <li>عدم استخدام الموقع في أي نشاط غير قانوني أو محاولة تعطيله أو إغراقه بالطلبات الآلية.</li>
        <li>عدم إعادة توزيع محتوى الموقع تجاريًا.</li>
        <li>احترام حقوق الملكية الفكرية لأصحاب الأعمال ودعم النسخ الرسمية متى توفرت في بلدك.</li>
      </ul>
      <h2>حدود المسؤولية</h2>
      <p>لا يتحمل الموقع أي مسؤولية عن أضرار مباشرة أو غير مباشرة ناتجة عن استخدام الخدمة أو انقطاعها أو عن محتوى المصادر الخارجية والإعلانات.</p>
      <h2>تعديل الشروط</h2>
      <p>نحتفظ بحق تعديل هذه الشروط في أي وقت، وتسري النسخة المنشورة في هذه الصفحة.</p>`
  },
  dmca: {
    title: 'إخلاء المسؤولية وحقوق النشر (DMCA)',
    body: `
      <h2>إخلاء المسؤولية</h2>
      <p>موقع DZMANGA <b>لا يستضيف أي صور أو فصول على خوادمه</b>؛ كل المحتوى يُعرض من مصادر خارجية عامة متاحة على الإنترنت. جميع الأعمال المعروضة ملك لمؤلفيها وناشريها.</p>
      <h2>طلبات إزالة المحتوى</h2>
      <p>إذا كنت مالكًا لحقوق عمل معروض على الموقع وترغب في إزالته، راسلنا عبر صفحة <a href="#/page/contact">اتصل بنا</a> متضمنًا:</p>
      <ul>
        <li>تحديد العمل محل الطلب ورابط صفحته على موقعنا.</li>
        <li>ما يثبت ملكيتك للحقوق أو تفويضك بالتصرف باسم المالك.</li>
        <li>وسيلة تواصل للرد عليك.</li>
      </ul>
      <p>نتعامل مع الطلبات المكتملة خلال <b>72 ساعة عمل</b> كحد أقصى، وتُزال الأعمال المستوفية للشروط من الفهرسة.</p>
      <div class="note">نشجع القراء دائمًا على دعم المؤلفين والناشرين بشراء النسخ الرسمية متى كانت متاحة.</div>`
  },
  contact: {
    title: 'اتصل بنا',
    body: `
      <p>يسعدنا تواصلك معنا لأي استفسار أو اقتراح أو طلب متعلق بحقوق النشر:</p>
      <ul>
        <li>البريد الإلكتروني: <a href="mailto:ayoubteke12@gmail.com">ayoubteke12@gmail.com</a></li>
      </ul>
      <p>نرد عادة خلال 24–72 ساعة. لطلبات إزالة المحتوى راجع صفحة <a href="#/page/dmca">إخلاء المسؤولية / DMCA</a> أولًا لمعرفة المعلومات المطلوبة.</p>`
  }
};

function renderStaticPage(slug) {
  const page = LEGAL_PAGES[slug];
  if (!page) return renderHome();
  setActiveNav('');
  document.title = `${page.title} — DZMANGA`;
  app.innerHTML = `
    <div class="legal">
      <a class="backlink" href="#/">&rarr; الرئيسية</a>
      <h1>${page.title}</h1>
      <div class="updated">آخر تحديث: 21 أوت 2026</div>
      ${page.body}
    </div>`;
  window.scrollTo(0, 0);
}

function router() {
  document.body.classList.remove('zen'); // مغادرة وضع القراءة الصافي عند أي تنقّل
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return renderHome();
  if (parts[0] === 'page' && parts[1]) return renderStaticPage(parts[1]);
  if (parts[0] === 'browse') return renderBrowse(parts[1] || 'asq', parts[2] || '');
  if (parts[0] === 'library') return renderLibrary();
  if (parts[0] === 'search' && parts[1]) return renderSearch(parts[1]);
  if (parts[0] === 'manga' && parts[1]) return renderManga(parts.slice(1).join('/'));
  if (parts[0] === 'read' && parts[1] && parts[2] && parts[3] !== undefined) {
    return renderReader(parts[1], parts[2], parts[3]);
  }
  return renderHome();
}

// ارتفاع الهيدر الفعلي → يستخدمه شريط التصفّح اللاصق (sticky) حتى لا يختفي تحته
(function headerHeightVar() {
  const set = () => {
    const h = document.querySelector('header')?.offsetHeight || 56;
    document.documentElement.style.setProperty('--hh', `${h}px`);
  };
  set();
  window.addEventListener('resize', set);
  window.addEventListener('load', set);
})();

// زر العودة إلى الأعلى — يظهر في القوائم الطويلة فقط (وليس داخل القارئ)
(function backToTop() {
  const btn = document.createElement('button');
  btn.id = 'toTop';
  btn.className = 'to-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'العودة إلى الأعلى');
  btn.innerHTML = '↑';
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);
  const sync = () => {
    const inReader = !!document.querySelector('.reader');
    btn.classList.toggle('show', !inReader && window.scrollY > 900);
  };
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('hashchange', () => setTimeout(sync, 60));
  sync();
})();


/* أغلفة تظهر سوداء عند فشل بروكسي /img (حجب مؤقت من MangaDex مثلاً):
   نجرّب الرابط المباشر أولاً ثم صورة بديلة بدل مربع أسود. */


/* اختصارات لوحة المفاتيح داخل القارئ (لمستخدمي الحاسوب):
   ← الفصل التالي، → الفصل السابق — نفس اتجاه أزرار الشريط السفلي. */
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,select,textarea')) return;
  if (!location.hash.startsWith('#/read/')) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const bar = document.querySelector('.reader-bar');
  if (!bar) return;
  const btns = bar.querySelectorAll('button');
  const target = e.key === 'ArrowLeft' ? btns[0] : btns[1];
  if (target && !target.disabled) { e.preventDefault(); target.click(); }
});

document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.__coverFallback === 2) return;
    const src = img.getAttribute('src') || '';
    if (!img.__coverFallback && src.startsWith('/img?u=')) {
      img.__coverFallback = 1;
      img.src = decodeURIComponent(src.slice('/img?u='.length));
      return;
    }
    if (img.closest('.card-art, .live-item, .hero, .cont-card')) {
      img.__coverFallback = 2;
      img.src = PLACEHOLDER;
    }
  },
  true
);

window.addEventListener('hashchange', router);
window.addEventListener('beforeunload', saveCurrentFeedScroll);
router();

/* ── أصوات مفاتيح الكيبورد (Web Audio، بدون ملفات) ── */
(() => {
  let ctx = null;
  // 2026-08-27: أيقونات/كروت المانجا صارت تصدر نفس نقرة الكيبورد مثل أزرار
  // الشريط السفلي (طلب صاحب المنتج) — نفس المجموعة المستعملة في تأثير .key-pop
  // أسفل هذا الملف، فالصوت والحركة يبقيان متطابقين. لا يوجد صوت داخل القارئ
  // (تصفّح الصفحات) حتى لا يزعج القراءة.
  const SELECTOR =
    '.btn,.tab,.src-tab,.mode-toggle,.page-btn,.to-top,.hero-cta,.bottom-nav a,.card,.live-item,.cont-card,.chapter-row,.hero-slide';
  // تفضيل الصوت (زر 🔊 في الشريط العلوي) — مفعّل افتراضياً
  const SOUND_KEY = 'dz_sound_v1';
  const soundOn = () => localStorage.getItem(SOUND_KEY) !== 'off';
  window.__dzSound = {
    on: soundOn,
    toggle() {
      localStorage.setItem(SOUND_KEY, soundOn() ? 'off' : 'on');
      return soundOn();
    },
  };
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function click(down) {
    if (!soundOn()) return;
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    // نقرة عالية (بلاستيك المفتاح)
    const len = 0.03;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const noise = a.createBufferSource();
    noise.buffer = buf;
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = down ? 2400 : 3300;
    bp.Q.value = 1.6;
    const g1 = a.createGain();
    g1.gain.setValueAtTime(down ? 0.22 : 0.12, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + len);
    noise.connect(bp).connect(g1).connect(a.destination);
    noise.start(t);
    // «ثوك» منخفض عند الضغط فقط
    if (down) {
      const o = a.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.05);
      const g2 = a.createGain();
      g2.gain.setValueAtTime(0.25, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(g2).connect(a.destination);
      o.start(t);
      o.stop(t + 0.07);
    }
  }
  document.addEventListener('pointerdown', (e) => { if (e.target.closest(SELECTOR)) click(true); }, { passive: true, capture: true });
  document.addEventListener('pointerup', (e) => { if (e.target.closest(SELECTOR)) click(false); }, { passive: true, capture: true });
})();

/* ارتداد نابضي عند الإفلات: نضيف .key-pop لتشغيل انميشن keyPop/cardPop ثم ننزعه */
(() => {
  const POP_SEL =
    '.btn,.tab,.src-tab,.mode-toggle,.page-btn,.to-top,.hero-cta,.bottom-nav a,.card,.live-item,.cont-card,.chapter-row,.hero-slide';
  function pop(e) {
    const el = e.target.closest(POP_SEL);
    if (!el) return;
    el.classList.remove('key-pop');
    void el.offsetWidth; // إعادة تشغيل الانميشن حتى مع النقر السريع المتكرر
    el.classList.add('key-pop');
    el.addEventListener('animationend', () => el.classList.remove('key-pop'), { once: true });
    setTimeout(() => el.classList.remove('key-pop'), 500); // احتياط لو لم يصل animationend
  }
  document.addEventListener('pointerup', pop, { passive: true, capture: true });
  document.addEventListener('pointercancel', pop, { passive: true, capture: true });
})();

/* زر الصوت في الشريط العلوي: 🔊/🔇 مع حفظ التفضيل */
(() => {
  const btn = document.getElementById('soundToggle');
  if (!btn) return;
  const paint = (on) => {
    btn.textContent = on ? '🔊' : '🔇';
    btn.title = on ? 'كتم أصوات النقر' : 'تشغيل أصوات النقر';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  paint(window.__dzSound.on());
  btn.addEventListener('click', () => {
    const on = window.__dzSound.toggle();
    paint(on);
    toast(on ? 'الأصوات مفعّلة 🔊' : 'الأصوات مكتومة 🔇');
  });
})();
