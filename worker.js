/* =====================================================================
   PROXY BOLSAI — Cloudflare Worker
   Só é necessário se o Diagnóstico do painel acusar que api.usebolsai.com
   não devolve Access-Control-Allow-Origin. Nesse caso o navegador barra a
   leitura de toda resposta, e não há correção possível no front-end: a
   chamada precisa sair de um servidor, que então devolve os dados ao
   painel com o cabeçalho de CORS que faltava.

   Deploy (~5 min, plano grátis basta):
     1. dash.cloudflare.com → Workers & Pages → Create → Worker
     2. Cole este arquivo, Deploy. Anote a URL (…workers.dev)
     3. Settings → Variables:
          ORIGEM  = https://SEU-USUARIO.github.io   (origem do painel)
          BOLSAI_KEY = sua chave  ← como *Secret*, opcional mas recomendado
     4. No painel: Config → Proxy = a URL do worker

   Guardando BOLSAI_KEY como Secret, a chave passa a viver só no worker:
   some do localStorage do celular e não trafega mais do navegador.
   ===================================================================== */
const UPSTREAM = 'https://api.usebolsai.com';

export default {
  async fetch(req, env) {
    const origem = env.ORIGEM || '*';

    // preflight: o navegador pergunta antes de mandar o header X-API-Key
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origem);
    if (req.method !== 'GET') return cors(json({ detail: 'só GET' }, 405), origem);

    const url = new URL(req.url);

    // a chave pode vir do painel (header ou ?api_key=) ou ficar guardada aqui
    const doPainel = req.headers.get('X-API-Key') || url.searchParams.get('api_key');
    const chave = doPainel || env.BOLSAI_KEY;
    if (!chave) return cors(json({ detail: 'sem chave: mande X-API-Key ou configure BOLSAI_KEY no worker' }, 401), origem);

    // não repassa a chave na query — ela vai no header, como a Bolsai documenta
    url.searchParams.delete('api_key');
    const alvo = UPSTREAM + url.pathname + (url.search || '');

    let r;
    try {
      r = await fetch(alvo, { headers: { 'X-API-Key': chave, 'Accept': 'application/json' } });
    } catch (e) {
      return cors(json({ detail: 'proxy não alcançou a Bolsai: ' + e.message }, 502), origem);
    }

    const saida = new Response(r.body, {
      status: r.status,
      headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' }
    });
    return cors(saida, origem);
  }
};

function cors(r, origem) {
  r.headers.set('Access-Control-Allow-Origin', origem);
  r.headers.set('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  r.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  r.headers.set('Access-Control-Max-Age', '86400');
  if (origem !== '*') r.headers.set('Vary', 'Origin');
  return r;
}
const json = (o, st) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
