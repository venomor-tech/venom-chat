// Service worker بسيط: الشبكة أولًا، ولو مفيش نت يفتح آخر نسخة اتحملت.
const CACHE = "venom-v3";
const CDN = "venom-cdn-v3";
const CDN_HOSTS = ["www.gstatic.com", "cdn.tailwindcss.com"];
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CDN).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (CDN_HOSTS.includes(url.hostname)) {   // مكتبات Firebase وTailwind: نسخة محفوظة تتحدث في الخلفية
    e.respondWith(caches.open(CDN).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return; // باقي الطلبات الخارجية للشبكة مباشرة
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});

// ===== إشعارات فورية (FCM عبر Web Push) =====
self.addEventListener("push", (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (_) {}
  const d = p.data || p.notification || p;
  const title = d.title || "VENOM";
  e.waitUntil(self.registration.showNotification(title, { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.room || "venom", data: { room: d.room || "" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    return clients.openWindow("./");
  }));
});
