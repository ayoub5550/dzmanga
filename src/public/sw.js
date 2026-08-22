/* dzmanga service worker — تسريع فتح التطبيق وتخفيف الشبكة.
   - قوقعة التطبيق (HTML/JS/الأيقونات): stale-while-revalidate.
   - صور الفصول والأغلفة (/img): cache-first مع سقف للعناصر.
   - طلبات /api: لا تُخزَّن هنا (للخادم كاش خاص به وبيانات متغيّرة). */
const SHELL = 'dz-shell-v20';
const IMGS = 'dz-img-v1';
const SHELL_FILES = ['/', '/app.js', '/manifest.json', '/favicon-32.png', '/icon-192.png'];
const IMG_LIMIT = 400;

self.addEventListener('install', (e) => {
  // cache:'reload' يتجاوز كاش HTTP للمتصفح — بدونه قد يخزّن SW الجديد نسخاً
  // قديمة من app.js (كانت max-age=3600) رغم رفع رقم SHELL.
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL && k !== IMGS).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trim(cacheName, limit) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > limit) await Promise.all(keys.slice(0, keys.length - limit).map((k) => c.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname === '/img') {
    e.respondWith(
      caches.open(IMGS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) { c.put(req, res.clone()); trim(IMGS, IMG_LIMIT); }
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  e.respondWith(
    caches.open(SHELL).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: false });
      const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
