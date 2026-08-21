// ---------------------------------------------------------------------------
// dzmanga ads loader (stub — 2026-08-21).
// The site has no ad-network account approved yet. When one is ready:
//   1. Set enabled:true and fill provider + the network's embed snippet
//      inside injectAds() below (banner zones only — NO popunders/redirects,
//      they destroy reader trust and get manga sites blacklisted).
//   2. Recommended placements (divs already styled by .ad-slot in index.html):
//      - homepage: between "آخر التحديثات" and "الأكثر شعبية" sections
//      - manga page: under the chapter list
//      - reader: ONLY between chapters (never between pages mid-chapter).
//   3. Keep it light: one script tag, async, no layout shift (fixed height).
// ---------------------------------------------------------------------------
window.DZ_ADS = { enabled: false, provider: null };

function injectAds() {
  if (!window.DZ_ADS.enabled) return;
  // example (Adsterra banner):
  // const s = document.createElement('script');
  // s.src = '//www.highperformanceformat.com/<zone>/invoke.js'; s.async = true;
  // document.querySelectorAll('.ad-slot').forEach(el => { ... });
}
document.addEventListener('DOMContentLoaded', injectAds);
