const app = document.getElementById('app');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const liveResults = document.getElementById('liveResults');

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
  return `<a class="live-item" href="#/manga/${m.id}">
    <img src="${cover}" loading="lazy" />
    <span class="t">${escapeHtml(m.title)}</span>
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

function loadingHtml() {
  return `<div class="loading"><div class="spinner"></div>جارِ التحميل…</div>`;
}

function skeletonGrid(n = 12) {
  return `<div class="grid">${Array.from({ length: n })
    .map(() => `<div class="card"><div class="skeleton" style="aspect-ratio:2/3"></div></div>`)
    .join('')}</div>`;
}

function cardHtml(m) {
  const cover = m.cover || 'https://placehold.co/260x380/1c1826/9791ac?text=dzmanga';
  return `<a class="card" href="#/manga/${m.id}">
    <img src="${cover}" loading="lazy" alt="${escapeHtml(m.title)}" />
    <div class="title">${escapeHtml(m.title)}</div>
  </a>`;
}

function rowHtml(items) {
  return `<div class="row">${items.map(cardHtml).join('')}</div>`;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

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
    <a class="hero-slide ${i === 0 ? 'active' : ''}" href="#/manga/${m.id}">
      <div class="bg" style="background-image:url('${m.cover}')"></div>
      <div class="fade"></div>
      <div class="hero-content">
        <span class="hero-badge">🔥 الأكثر شعبية</span>
        <div class="hero-title">${escapeHtml(m.title)}</div>
        <span class="hero-cta">اقرأ الآن ←</span>
      </div>
    </a>`
    )
    .join('');
  const dots = hero.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('');
  return `<div class="hero">${slides}<div class="hero-dots">${dots}</div></div>`;
}

async function renderHome() {
  app.innerHTML = `
    <div class="hero skeleton" style="height:280px;margin:18px 0 8px"></div>
    <h2 class="section">🆕 آخر التحديثات</h2>${skeletonGrid(6)}
  `;
  try {
    const { hero, popular, latest, genres } = await getJson('/api/home');
    let html = heroHtml(hero);
    html += `<h2 class="section">🆕 آخر التحديثات</h2>${rowHtml(latest)}`;
    html += `<h2 class="section">🔥 الأكثر شعبية</h2>${rowHtml(popular)}`;
    for (const g of genres || []) {
      html += `<h2 class="section">${genreEmoji(g.key)} ${escapeHtml(g.label)}</h2>${rowHtml(g.items)}`;
    }
    app.innerHTML = html;
    startHeroRotation();
  } catch (e) {
    app.innerHTML = `<div class="empty">تعذّر الوصول إلى MangaDex. حاول مجدداً بعد قليل.</div>`;
  }
}

function genreEmoji(key) {
  return { action: '⚔️', romance: '💗', isekai: '🌌', fantasy: '🐉', comedy: '😂', horror: '👻' }[key] || '📚';
}

async function renderSearch(q) {
  searchInput.value = q;
  app.innerHTML = `<h2 class="section">نتائج البحث عن "${escapeHtml(q)}"</h2>${skeletonGrid(12)}`;
  try {
    const { results } = await getJson(`/api/search?q=${encodeURIComponent(q)}`);
    app.innerHTML = `
      <h2 class="section">نتائج البحث عن "${escapeHtml(q)}"</h2>
      ${results.length ? `<div class="grid">${results.map(cardHtml).join('')}</div>` : `<div class="empty">لا توجد نتائج بالعربية لهذا البحث.</div>`}
    `;
  } catch (e) {
    app.innerHTML = `<div class="empty">فشل البحث. حاول مجدداً.</div>`;
  }
}

// Chapters come from the API in ascending order; the reader's prev/next
// logic indexes into that exact array, so we keep each chapter's original
// index (`idx`) attached no matter how we group/reverse them for display.
function groupChaptersByVolume(chapters, descending) {
  const withIdx = chapters.map((c, idx) => ({ ...c, idx }));
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

function chapterRowHtml(c, mangaId) {
  return `
    <a class="chapter-row" href="#/read/${c.id}/${mangaId}/${c.idx}">
      <span>
        <span class="ch-title">الفصل ${c.chapter ?? '؟'}${c.title ? ' — ' + escapeHtml(c.title) : ''}</span>
        ${c.group ? `<span class="ch-group">${escapeHtml(c.group)}</span>` : ''}
      </span>
      <span class="date">${c.publishAt ? new Date(c.publishAt).toLocaleDateString('ar') : ''}</span>
    </a>`;
}

function chaptersHtml(chapters, mangaId, descending) {
  if (!chapters.length) return '<div class="empty">لا توجد فصول بالعربية حالياً.</div>';
  const groups = groupChaptersByVolume(chapters, descending);
  return groups
    .map(
      (g) => `
    <div class="volume-group">
      ${g.key !== 'no-volume' || groups.length > 1 ? `<div class="volume-label">${escapeHtml(g.label)}</div>` : ''}
      <div class="chapters">${g.items.map((c) => chapterRowHtml(c, mangaId)).join('')}</div>
    </div>`
    )
    .join('');
}

async function renderManga(id) {
  app.innerHTML = loadingHtml();
  try {
    const [manga, { chapters }] = await Promise.all([
      getJson(`/api/manga/${id}`),
      getJson(`/api/manga/${id}/chapters`),
    ]);
    const cover = manga.cover || 'https://placehold.co/260x380/171f1a/8a9a8f?text=dzmanga';
    let descending = true; // newest chapters first by default, like most manga readers
    app.innerHTML = `
      <a class="backlink" href="#/">&rarr; رجوع</a>
      <div class="detail">
        <img src="${cover}" alt="${escapeHtml(manga.title)}" />
        <div class="info">
          <h1>${escapeHtml(manga.title)}</h1>
          <div class="meta">${manga.author ? escapeHtml(manga.author) + ' · ' : ''}${manga.status || ''} ${manga.year ? '· ' + manga.year : ''}</div>
          <div class="tags">${manga.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
          <div class="desc">${escapeHtml(manga.description) || 'لا يوجد وصف.'}</div>
        </div>
      </div>
      <h2 class="section">
        الفصول (${chapters.length})
        <button class="btn more" id="sortToggle" style="margin-inline-start:auto">تنازلي ⇅</button>
      </h2>
      <div id="chapterList">${chaptersHtml(chapters, manga.id, descending)}</div>
    `;
    document.getElementById('sortToggle')?.addEventListener('click', (e) => {
      descending = !descending;
      e.target.textContent = descending ? 'تنازلي ⇅' : 'تصاعدي ⇅';
      document.getElementById('chapterList').innerHTML = chaptersHtml(chapters, manga.id, descending);
    });
    window.__chapterCache = window.__chapterCache || {};
    window.__chapterCache[manga.id] = chapters;
  } catch (e) {
    app.innerHTML = `<div class="empty">تعذّر تحميل هذه المانجا.</div>`;
  }
}

async function renderReader(chapterId, mangaId, idx) {
  app.innerHTML = loadingHtml();
  try {
    let chapters = window.__chapterCache?.[mangaId];
    if (!chapters) {
      const data = await getJson(`/api/manga/${mangaId}/chapters`);
      chapters = data.chapters;
      window.__chapterCache = window.__chapterCache || {};
      window.__chapterCache[mangaId] = chapters;
    }
    const { pages } = await getJson(`/api/chapter/${chapterId}/pages`);
    const i = parseInt(idx, 10);
    const prev = chapters[i - 1];
    const next = chapters[i + 1];
    app.innerHTML = `
      <a class="backlink" href="#/manga/${mangaId}">&rarr; الفصل ${chapters[i]?.chapter ?? ''}</a>
      <div class="reader">
        ${pages.map((p) => `<img src="${p}" loading="lazy" />`).join('')}
      </div>
      <div class="reader-bar">
        <button class="btn primary" ${next ? '' : 'disabled'} onclick="location.hash='#/read/${next?.id}/${mangaId}/${i + 1}'">التالي &larr;</button>
        <a class="btn" href="#/manga/${mangaId}">الفصول</a>
        <button class="btn" ${prev ? '' : 'disabled'} onclick="location.hash='#/read/${prev?.id}/${mangaId}/${i - 1}'">&rarr; السابق</button>
      </div>
    `;
    window.scrollTo(0, 0);
  } catch (e) {
    app.innerHTML = `<div class="empty">تعذّر تحميل هذا الفصل.</div>`;
  }
}

// Tabs for the browse page: "الكل" (paginated across the whole MangaDex ar
// catalog) plus one tab per curated genre (fixed-size list, no pagination
// needed). Keep this list of keys/labels/emoji in sync with GENRES in
// src/server.js if genres are added/removed there.
const BROWSE_TABS = [
  { key: 'all', label: '📚 الكل' },
  { key: 'action', label: '⚔️ أكشن' },
  { key: 'romance', label: '💗 رومانسي' },
  { key: 'isekai', label: '🌌 إيسيكاي' },
  { key: 'fantasy', label: '🐉 خيال' },
  { key: 'comedy', label: '😂 كوميدي' },
  { key: 'horror', label: '👻 رعب' },
];

function paginationHtml(page, totalPages) {
  const nums = [];
  const add = (n) => nums.push(n);
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, page + 2);
  if (from > 1) { add(1); if (from > 2) nums.push('…'); }
  for (let i = from; i <= to; i++) add(i);
  if (to < totalPages) { if (to < totalPages - 1) nums.push('…'); add(totalPages); }
  return `
    <div class="pagination">
      <button class="btn page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← السابق</button>
      ${nums
        .map((n) =>
          n === '…'
            ? `<span class="page-ellipsis">…</span>`
            : `<button class="btn page-btn ${n === page ? 'primary active-page' : ''}" data-page="${n}">${n}</button>`
        )
        .join('')}
      <button class="btn page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>التالي →</button>
    </div>
  `;
}

async function loadAllPage(body, page) {
  body.innerHTML = skeletonGrid(24);
  try {
    const data = await getJson(`/api/browse?page=${page}`);
    if (data.indexing) {
      body.innerHTML = `<div class="loading"><div class="spinner"></div>جارِ فهرسة الكتالوج الكامل (~700+ مانجا)، ثوانٍ معدودة…</div>`;
      setTimeout(() => loadAllPage(body, page), 3000);
      return;
    }
    body.innerHTML = `
      <div class="empty" style="text-align:${document.dir === 'rtl' ? 'right' : 'left'};padding:0 2px 14px">
        عرض ${data.items.length} من أصل <b>${data.total}</b> مانجا عربية متوفرة على MangaDex — صفحة ${data.page} من ${data.totalPages}
      </div>
      <div class="grid">${data.items.map(cardHtml).join('')}</div>
      ${paginationHtml(data.page, data.totalPages)}
    `;
    body.querySelectorAll('.page-btn:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        loadAllPage(body, parseInt(btn.dataset.page, 10));
        body.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  } catch (e) {
    body.innerHTML = `<div class="empty">تعذّر التحميل، حاول مجدداً.</div>`;
  }
}

async function renderBrowse(activeTab = 'all') {
  const tabsHtml = BROWSE_TABS.map(
    (t) => `<button class="tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`
  ).join('');

  app.innerHTML = `
    <div class="tabs">${tabsHtml}</div>
    <div id="browseBody">${skeletonGrid(18)}</div>
  `;

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab !== activeTab) renderBrowse(btn.dataset.tab);
    });
  });

  const body = document.getElementById('browseBody');

  if (activeTab === 'all') {
    await loadAllPage(body, 1);
  } else {
    try {
      const data = await getJson(`/api/genre/${activeTab}`);
      body.innerHTML = data.items.length
        ? `<div class="grid">${data.items.map(cardHtml).join('')}</div>`
        : `<div class="empty">لا توجد نتائج بالعربية في هذا القسم حالياً.</div>`;
    } catch (e) {
      body.innerHTML = `<div class="empty">تعذّر التحميل، حاول مجدداً.</div>`;
    }
  }
}

function router() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return renderHome();
  if (parts[0] === 'browse') return renderBrowse();
  if (parts[0] === 'search' && parts[1]) return renderSearch(decodeURIComponent(parts[1]));
  if (parts[0] === 'manga' && parts[1]) return renderManga(parts[1]);
  if (parts[0] === 'read' && parts[1] && parts[2] && parts[3] !== undefined) {
    return renderReader(parts[1], parts[2], parts[3]);
  }
  return renderHome();
}

window.addEventListener('hashchange', router);
router();
