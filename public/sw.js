const CACHE_NAME = "lord-ai-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/lord-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Browser extensions and other non-HTTP resources cannot be stored in Cache.
  // Only cache same-origin web requests handled by this service worker.
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  const isSupabase =
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/v1") ||
    url.pathname.startsWith("/auth/v1") ||
    url.pathname.startsWith("/storage/v1") ||
    url.pathname.startsWith("/functions/v1");

  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/~oauth") ||
    url.pathname.startsWith("/api/") ||
    isSupabase
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("/")
          .then(
            (cached) =>
              cached ??
              new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } }),
          ),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((response) => {
            if (!response.ok) {
              return response;
            }

            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });

            return response;
          })
          .catch(
            () =>
              new Response(JSON.stringify({ error: "Offline" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }),
          ),
    ),
  );
});
