/* =====================================================
   SERVICE WORKER — JMG Investimentos
   App funciona offline (shell). Cotações vão sempre pela rede.
   Para atualizar o app depois de mudar arquivos: suba o número
   da versão em CACHE (ex.: jmg-inv-v2) e recarregue.
   ===================================================== */
const CACHE = 'jmg-inv-v8';
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

  // Dados de mercado (Bolsai) — o service worker NÃO se mete. Sai direto pelo
  // navegador, sem cache aqui (o app já cacheia por TTL).
  //
  // Até a v7 este bloco devolvia um 503 sintético quando o fetch falhava, e isso
  // mentia sobre a causa: falha de rede, DNS e bloqueio de CORS chegavam ao app
  // todos como "Bolsai fora do ar (503)". Deixando passar, o erro real aparece
  // como erro real — e o Diagnóstico em Config consegue separar um do outro.
  if (url.includes('api.usebolsai.com')) return;

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

  // Shell do app — REDE PRIMEIRO, cache como reserva offline.
  // Cache-primeiro (como era até a v6) congelava o celular numa build antiga:
  // o app só atualizava quando o número da versão acima mudava, e mesmo assim
  // só no carregamento seguinte. Agora, havendo internet, o que está publicado
  // é sempre o que aparece; sem internet, o app ainda abre pelo cache.
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.ok && e.request.method === 'GET') {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
  );
});
