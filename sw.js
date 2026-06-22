/* =====================================================
   SERVICE WORKER — JMG Investimentos
   App funciona offline (shell). Cotações vão sempre pela rede.
   Para atualizar o app depois de mudar arquivos: suba o número
   da versão em CACHE (ex.: jmg-inv-v2) e recarregue.
   ===================================================== */
const CACHE = 'jmg-inv-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Cotações / indicadores (brapi) — sempre pela rede, nunca cacheia preço velho
  if (url.includes('brapi.dev')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('{"results":[]}', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Fontes do Google — stale-while-revalidate (deixa o app abrir offline)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const cached = await c.match(e.request);
        const net = fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Resto (shell do app) — cache primeiro, rede como reserva
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
