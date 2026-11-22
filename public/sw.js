/* GrowLand service worker
 * - فایل‌های ثابت (JS/CSS/فونت/تصویر) با استراتژی stale-while-revalidate کش می‌شوند
 * - صفحه اصلی network-first است؛ بدون اینترنت از کش (یا صفحه آفلاین) نمایش داده می‌شود
 * - درخواست‌های Supabase / API هرگز کش نمی‌شوند (داده همیشه تازه و امن)
 * با هر تغییر مهم، عدد VERSION را بالا ببرید.
 */
const VERSION = 'v1';
const STATIC_CACHE = `growland-static-${VERSION}`;
const PAGE_CACHE = `growland-pages-${VERSION}`;
const PRECACHE = ['/', '/offline.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/logo.jpg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // فقط همان origin؛ Supabase و هر دامنه‌ی دیگر دست‌نخورده می‌ماند
  if (url.origin !== self.location.origin) return;

  // ناوبری (باز کردن صفحه): اول شبکه، بعد کش، بعد صفحه آفلاین
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(async () => (await caches.match('/')) || (await caches.match('/offline.html'))),
    );
    return;
  }

  // فایل‌های ساخته‌شده و ثابت
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|woff2?|png|jpe?g|svg|ico|webmanifest)$/.test(url.pathname);
  if (!isAsset) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
