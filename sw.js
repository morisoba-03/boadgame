// =============================================
//  みんなのボドゲ - Service Worker (v5.0)
//  オフラインでも遊べるようにアプリ本体をキャッシュする。
// =============================================
const CACHE_NAME = 'bodoge-v5.0';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './themes.js',
    './script.js',
    './icon.svg',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // 1件でも失敗すると install ごと落ちるため、個別に入れて失敗は握りつぶす。
            .then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => null))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// stale-while-revalidate: まずキャッシュを返しつつ、裏で最新版を取り込む。
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request).then(response => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            }).catch(() => cached);

            return cached || network;
        })
    );
});
