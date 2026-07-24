self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification && event.notification.data ? event.notification.data : {};
  const targetView = data.targetView || 'alerts';
  const openUrl = `/?view=${encodeURIComponent(targetView)}`;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          client.postMessage({ type: 'snaptrack-open-view', view: targetView });
          await client.focus();
          return;
        }
      } catch (e) {
        // ignore malformed client URLs
      }
    }
    await self.clients.openWindow(openUrl);
  })());
});

self.addEventListener('push', event => {
  const payload = (() => {
    try { return event.data ? event.data.json() : {}; }
    catch(e){ return {}; }
  })();

  const title = payload.title || 'SnapTrack Alert';
  const body = payload.body || 'You have a new update.';
  const targetView = payload.targetView || 'alerts';
  const tag = payload.tag || `snaptrack-${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { targetView },
      requireInteraction: false
    })
  );
});
