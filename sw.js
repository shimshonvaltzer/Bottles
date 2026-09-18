// Water Sort Puzzle - service worker
// Versioned cache-first offline support. Uses relative paths so it works
// under a GitHub Pages project subpath as well as at the domain root.

var CACHE_NAME = 'watersort-v1';

// Resolve all asset URLs relative to this file's own location so the SW
// works correctly regardless of the path/subpath it is served from.
var SCOPE_URL = new URL('./', self.location);

var ASSETS = [
  'index.html',
  'style.css',
  'game.js',
  'manifest.json',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
].map(function (path) {
  return new URL(path, SCOPE_URL).toString();
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return Promise.all(
          ASSETS.map(function (url) {
            return cache.add(url).catch(function () {
              // Ignore individual asset failures so install doesn't fail
              // entirely if one optional asset is missing.
            });
          })
        );
      })
      .catch(function () {})
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .catch(function () {})
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle simple GET requests; let everything else pass through.
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches
      .match(request)
      .then(function (cached) {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then(function (response) {
            if (response && response.ok && response.type === 'basic') {
              var copy = response.clone();
              caches
                .open(CACHE_NAME)
                .then(function (cache) {
                  cache.put(request, copy);
                })
                .catch(function () {});
            }
            return response;
          })
          .catch(function () {
            // Offline and not cached: fall back to the cached start page
            // for navigation requests, otherwise fail gracefully.
            if (request.mode === 'navigate') {
              return caches.match(new URL('index.html', SCOPE_URL).toString());
            }
            return new Response('', { status: 503, statusText: 'Offline' });
          });
      })
      .catch(function () {
        return new Response('', { status: 503, statusText: 'Offline' });
      })
  );
});
