const CACHE_NAME = 'medspace-v2';

// Installieren und sofort aktivieren
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

// Alten Cache beim Update löschen
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim();
});

// NETWORK FIRST: Immer erst im Internet nach der neuesten Version schauen!
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).then(response => {
            // Wir sind online: Neue Version laden und heimlich im Hintergrund speichern
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
            return response;
        }).catch(() => {
            // Wir sind offline: Gespeicherte Version nutzen
            return caches.match(e.request);
        })
    );
});
