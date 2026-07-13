const CACHE_NAME = "paipachi-pwa-v219";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const STATIC_EXTENSIONS = [".html", ".css", ".js", ".webmanifest", ".svg", ".png", ".jpg", ".jpeg"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  const isAppShell = event.request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/sw.js");
  if (isAppShell) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match("./index.html"))
    );
    return;
  }
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
  if (!isStaticAsset) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
