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

async function renderManga(id) {
  app.innerHTML = loadingHtml();
  try {
    const [manga, { chapters }] = await Promise.all([
      getJson(`/api/manga/${id}`),
      getJson(`/api/manga/${id}/chapters`),
    ]);
    const cover = manga.cover || 'https://placehold.co/260x380/1c1826/9791ac?text=dzmanga';
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

async function renderBrowse() {
  app.innerHTML = `<h2 class="section">📚 تصفّح كل المانجا العربية</h2>${skeletonGrid(18)}`;
  let offset = 0;
  let done = false;
  let loading = false;
  const seen = new Set();

  function shell(itemsHtml) {
    return `
      <h2 class="section">📚 تصفّح كل المانجا العربية</h2>
      <div class="grid" id="browseGrid">${itemsHtml}</div>
      <div id="browseFooter" style="text-align:center;padding:24px 0">
        ${done ? '<span class="empty">وصلت لنهاية القائمة 🎉</span>' : '<button class="btn primary" id="loadMoreBtn">حمّل المزيد</button>'}
      </div>
    `;
  }

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.textContent = 'جارِ التحميل…';
    try {
      const data = await getJson(`/api/browse?offset=${offset}`);
      offset = data.nextOffset;
      done = data.done;
      const fresh = data.items.filter((m) => !seen.has(m.id));
      fresh.forEach((m) => seen.add(m.id));
      const grid = document.getElementById('browseGrid');
      if (grid) grid.insertAdjacentHTML('beforeend', fresh.map(cardHtml).join(''));
      const footer = document.getElementById('browseFooter');
      if (footer) {
        footer.innerHTML = done
          ? '<span class="empty">وصلت لنهاية القائمة 🎉</span>'
          : '<button class="btn primary" id="loadMoreBtn">حمّل المزيد</button>';
        document.getElementById('loadMoreBtn')?.addEventListener('click', loadMore);
      }
    } catch (e) {
      const footer = document.getElementById('browseFooter');
      if (footer) footer.innerHTML = '<span class="empty">تعذّر التحميل، حاول مجدداً</span>';
    }
    loading = false;
  }

  app.innerHTML = shell('');
  document.getElementById('loadMoreBtn')?.addEventListener('click', loadMore);
  await loadMore();
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
