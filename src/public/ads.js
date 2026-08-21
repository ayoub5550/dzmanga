// ---------------------------------------------------------------------------
// dzmanga ads loader — Adsterra Native Banner (unit 30856951, "NativeBanner_1").
// Account: publishers.adsterra.com (login dzmanga / owner's email). Managed
// via the Adsterra dashboard; policy: banners only — NO popunders/redirects/
// push (they destroy reader trust). Placement: .ad-slot divs that app.js
// renders on the homepage (after "الأكثر شعبية") and on the manga page
// (under the chapter list). Never inside the reader between pages.
//
// How it works: Adsterra's invoke.js fills <div id="container-<hash>">.
// The SPA re-renders views, wiping the container, so a MutationObserver
// re-injects it into the first empty .ad-slot after each render. Only one
// container per page (duplicate ids won't be filled).
// ---------------------------------------------------------------------------
(function () {
  const HASH = '108f270368660f9e4886a769d98415fe';
  const SRC = 'https://pl30957450.effectivecpmnetwork.com/' + HASH + '/invoke.js';
  let debounceTimer = null;

  function inject() {
    const slot = document.querySelector('.ad-slot');
    if (!slot || slot.dataset.filled) return;
    // remove any stale container elsewhere (SPA nav leftovers)
    document.querySelectorAll('#container-' + HASH).forEach((el) => el.remove());
    document.querySelectorAll('script[data-dz-ad]').forEach((el) => el.remove());
    slot.dataset.filled = '1';
    const box = document.createElement('div');
    box.id = 'container-' + HASH;
    slot.appendChild(box);
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.setAttribute('data-dz-ad', '1');
    s.src = SRC;
    slot.appendChild(s);
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
