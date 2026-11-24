// Service worker for Jack Attack Street, Ayò Ọlọ́pọ́n and Street Dice.
//  1. Network-first caching, so the shell still opens offline.
//  2. Web Push streak reminders: a push carries no payload; we ask the Worker what to say.
const CACHE_NAME = 'jack-attack-v3';
const SHELL_URLS = ['/', '/jackattack/', '/ayo/', '/dice/', '/icon-192.png', '/icon-512.png', '/ayo/icon-192.png', '/dice/icon-192.png'];
const API_BASE = 'https://jack-attack-rooms.btltech.workers.dev';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.startsWith('/assets/'))) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

const FALLBACK = {
  title: "Today's daily is ready",
  body: 'A new daily is waiting for you.',
  url: '/?source=push',
  icon: '/icon-192.png',
};

// Browsers require every push to show a notification, so always show one, even if the Worker is unreachable.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let msg = FALLBACK;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const res = await fetch(API_BASE + '/api/push/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (res.ok) msg = { ...FALLBACK, ...(await res.json()) };
      }
    } catch (e) {
      // fall back to the generic text
    }
    await self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: msg.icon,
      badge: '/icon-192.png',
      tag: 'daily-streak', // a newer reminder replaces an older one instead of stacking
      data: { url: msg.url },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Reuse an open tab on the same game if there is one.
    const sameGame = wins.find((w) => new URL(w.url).pathname === target.pathname);
    if (sameGame && 'focus' in sameGame) return sameGame.focus();
    return self.clients.openWindow(target.href);
  })());
});
