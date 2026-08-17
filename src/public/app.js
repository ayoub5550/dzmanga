const app = document.getElementById('app');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) location.hash = `#/search/${encodeURIComponent(q)}`;
});

function loadingHtml() {
  return `<div class="loading"><div class="spinner"></div>جارِ التحميل…</div>`;
}

function cardHtml(m) {
  const cover = m.cover || 'https://placehold.co/260x380/1b1f2b/555?text=No+Cover';
  return `<a class="card" href="#/manga/${m.id}">
    <img src="${cover}" loading="lazy" alt="${escapeHtml(m.title)}" />
    <div class="title">${escapeHtml(m.title)}</div>
  </a>`;
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

async function renderHome() {
  app.innerHTML = loadingHtml();
  try {
    const { popular, latest } = await getJson('/api/home');
    app.innerHTML = `
      <h2 class="section">🔥 الأكثر شعبية</h2>
      <div class="grid">${popular.map(cardHtml).join('')}</div>
      <h2 class="section">🆕 آخر التحديثات</h2>
      <div class="grid">${latest.map(cardHtml).join('')}</div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="empty">تعذّر الوصول إلى MangaDex. حاول مجدداً بعد قليل.</div>`;
  }
}

async function renderSearch(q) {
  searchInput.value = q;
  app.innerHTML = loadingHtml();
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

async function renderManga(id) {
  app.innerHTML = loadingHtml();
  try {
    const [manga, { chapters }] = await Promise.all([
      getJson(`/api/manga/${id}`),
      getJson(`/api/manga/${id}/chapters`),
    ]);
    const cover = manga.cover || 'https://placehold.co/260x380/1b1f2b/555?text=No+Cover';
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
      <h2 class="section">الفصول (${chapters.length})</h2>
      <div class="chapters">
        ${chapters.length ? chapters.map((c, i) => `
          <a class="chapter-row" href="#/read/${c.id}/${manga.id}/${i}">
            <span>الفصل ${c.chapter ?? '؟'}${c.title ? ' — ' + escapeHtml(c.title) : ''}</span>
            <span class="date">${c.publishAt ? new Date(c.publishAt).toLocaleDateString('ar') : ''}</span>
          </a>`).join('') : '<div class="empty">لا توجد فصول بالعربية حالياً.</div>'}
      </div>
    `;
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

function router() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return renderHome();
  if (parts[0] === 'search' && parts[1]) return renderSearch(decodeURIComponent(parts[1]));
  if (parts[0] === 'manga' && parts[1]) return renderManga(parts[1]);
  if (parts[0] === 'read' && parts[1] && parts[2] && parts[3] !== undefined) {
    return renderReader(parts[1], parts[2], parts[3]);
  }
  return renderHome();
}

window.addEventListener('hashchange', router);
router();
