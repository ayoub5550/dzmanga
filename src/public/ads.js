// ---------------------------------------------------------------------------
// dzmanga ads loader — Adsterra (account: publishers.adsterra.com, site 5998901).
// Units:
//   - Native Banner  30856951  key 108f270368660f9e4886a769d98415fe (invoke.js + container div)
//   - Banner 300x250 key ec1e95038134fd0c0769cd035e966576 (atOptions iframe format)
//   - Banner 320x50  key dcf2e11fac3a9544acd19ab8f8914202 (atOptions iframe format)
//   - Banner 728x90  30952242 (أُنشئت 2026-08-27) — ضع مفتاحها في BANNERS.wide
//     لتُستعمل على الشاشات >=900px بدل 300x250 (كود الوحدة من GET CODE في اللوحة).
// أماكن الوحدات: الرئيسية (native بعد "الأكثر شعبية")، صفحة المانجا (banner تحت
// الفصول)، نهاية الفصل (banner بعد آخر صفحة)، وخلاصة التصفح (native بعد أول صفحة).
// Policy: banners only — NO popunders/push/redirects. Never inside the reader.
// Slots are <div class="ad-slot" data-ad="native|banner"> rendered by app.js:
//   home → native (after "الأكثر شعبية"), manga page → banner (under chapters).
// SPA re-renders wipe the DOM, so a MutationObserver on #app re-injects.
// atOptions snippets use document.write → must run inside a dedicated iframe
// (they'd wipe the page if run after load in the main document).
// ---------------------------------------------------------------------------
(function () {
  const NATIVE = '108f270368660f9e4886a769d98415fe';
  const BANNERS = {
    // 728x90 (وحدة 30952242، أُنشئت 2026-08-27) للشاشات العريضة فقط. اتركها
    // فارغة = يستعمل الموقع 300x250 كما قبل، بدون أي خطأ.
    wide: { key: '', w: 728, h: 90 },
    desktop: { key: 'ec1e95038134fd0c0769cd035e966576', w: 300, h: 250 },
    mobile: { key: 'dcf2e11fac3a9544acd19ab8f8914202', w: 320, h: 50 },
  };
  let debounceTimer = null;

  function injectNative(slot) {
    document.querySelectorAll('#container-' + NATIVE).forEach((el) => el.remove());
    document.querySelectorAll('script[data-dz-ad="native"]').forEach((el) => el.remove());
    const box = document.createElement('div');
    box.id = 'container-' + NATIVE;
    slot.appendChild(box);
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.setAttribute('data-dz-ad', 'native');
    s.src = 'https://pl30957450.effectivecpmnetwork.com/' + NATIVE + '/invoke.js';
    slot.appendChild(s);
  }

  function injectBanner(slot) {
    const cfg =
      window.innerWidth <= 520
        ? BANNERS.mobile
        : window.innerWidth >= 900 && BANNERS.wide.key
        ? BANNERS.wide
        : BANNERS.desktop;
    if (!cfg.key) return;
    const f = document.createElement('iframe');
    f.width = cfg.w; f.height = cfg.h;
    f.style.cssText = 'border:0;display:block;margin:0 auto;overflow:hidden';
    f.setAttribute('scrolling', 'no');
    slot.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head><base target="_top"></head><body style="margin:0">' +
      '<scr' + 'ipt>atOptions={"key":"' + cfg.key + '","format":"iframe","height":' + cfg.h +
      ',"width":' + cfg.w + ',"params":{}};</scr' + 'ipt>' +
      '<scr' + 'ipt src="https://www.highperformanceformat.com/' + cfg.key + '/invoke.js"></scr' + 'ipt>' +
      '</body></html>');
    doc.close();
  }

  function inject() {
    document.querySelectorAll('.ad-slot').forEach((slot) => {
      if (slot.dataset.filled) return;
      slot.dataset.filled = '1';
      if (slot.dataset.ad === 'banner') injectBanner(slot);
      else injectNative(slot);
    });
  }

  function schedule() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(inject, 400);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app');
    if (!root) return;
    new MutationObserver(schedule).observe(root, { childList: true });
    schedule();
  });
})();
