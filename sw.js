// 版本編號規範：自 1.0.0 起算；小更新為 1.1.0 / 1.2.0，極小修正為 1.0.1 / 1.0.2
const CACHE_NAME = "deals-pwa-cache-1.0.0";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./icon.svg",
  "./manifest.json"
];

self.addEventListener("install", function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_ASSETS);
    }).catch(function() {})
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function(event) {
  const req = event.request;

  if (req.method !== "GET" || req.url.indexOf("script.google.com") !== -1 || req.url.indexOf("googleusercontent.com") !== -1) {
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.search.indexOf("force_reload=") !== -1) {
    event.respondWith(
      fetch(req).then(function(networkRes) {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put("./index.html", clone);
          });
        }
        return networkRes;
      }).catch(function() {
        return caches.match("./index.html", { ignoreSearch: true });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(req, { ignoreSearch: true }).then(function(cachedRes) {
        const fetchPromise = fetch(req).then(function(networkRes) {
          if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
            cache.put(req, networkRes.clone());
            if (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html")) {
              cache.put("./index.html", networkRes.clone());
            }
          }
          return networkRes;
        }).catch(function() {
          return null;
        });

        if (cachedRes) {
          return cachedRes;
        }
        return fetchPromise.then(function(res) {
          return res || cache.match("./index.html", { ignoreSearch: true });
        });
      });
    })
  );
});
