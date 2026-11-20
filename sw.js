// Service worker: deja la app disponible sin conexión y gestiona los clics en notificaciones.
// Estrategia "red primero": con conexión siempre se usa la versión publicada más reciente
// (así los cambios de diseño y temas se ven de inmediato); sin conexión se usa la copia guardada.
const CACHE = 'labtimer-v4';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const IMAGES = ['pig_face', 'pig', 'pig_nose', 'pink_heart', 'sparkling_heart', 'two_hearts', 'zzz', 'alarm_clock', 'party_popper']
  .map((n) => `/img/${n}.webp`);
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/sounds.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  ...IMAGES,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function save(key, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(key, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  // Imágenes y fuentes no cambian: caché primero.
  if (url.pathname.startsWith('/img/') || !sameOrigin) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => save(request, res))));
    return;
  }

  // Página, estilos y código: red primero, caché si no hay conexión.
  const navigate = request.mode === 'navigate';
  const key = navigate ? '/index.html' : request;
  event.respondWith(
    // Una petición de navegación no se puede copiar con opciones: se pide por URL.
    fetch(navigate ? request.url : request, { cache: 'no-cache' })
      .then((res) => save(key, res))
      .catch(() => caches.match(key)),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => 'focus' in w);
      return win ? win.focus() : self.clients.openWindow('/');
    }),
  );
});
