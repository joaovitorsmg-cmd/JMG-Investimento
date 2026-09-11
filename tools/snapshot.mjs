#!/usr/bin/env node
/* =====================================================================
   SNAPSHOT BOLSAI  →  JSON estático
   ---------------------------------------------------------------------
   Roda no GitHub Actions, não no navegador. Essa é a questão toda: a
   api.usebolsai.com responde, mas não manda Access-Control-Allow-Origin,
   então nenhum navegador consegue LER a resposta. Aqui não existe CORS —
   é servidor falando com servidor — e o resultado é publicado como JSON
   na mesma origem do painel, onde o navegador lê sem pedir licença.

   Efeito colateral bem-vindo: a chave vive num Secret do repositório e
   nunca chega ao celular.

   Variáveis:
     BOLSAI_API_KEY   obrigatória (Secret do repositório)
     OUT_DIR          destino (padrão _site/data)
     DETALHE_ACOES    quantas ações ganham arquivo de raio-X (padrão 60)
     DETALHE_FIIS     quantos FIIs ganham arquivo de raio-X (padrão 40)
     MAX_REQ          teto de requisições da execução (padrão 800)
     TICKERS_EXTRA    lista separada por vírgula, sempre detalhada
   ===================================================================== */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const API = (process.env.BOLSAI_API || 'https://api.usebolsai.com') + '/api/v1';
const KEY = process.env.BOLSAI_API_KEY || '';
const OUT = process.env.OUT_DIR || '_site/data';
const DET_ACOES = intEnv('DETALHE_ACOES', 60);
const DET_FIIS = intEnv('DETALHE_FIIS', 40);
const MAX_REQ = intEnv('MAX_REQ', 800);
const EXTRA = (process.env.TICKERS_EXTRA || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

function intEnv(n, d) { const v = parseInt(process.env[n] ?? '', 10); return Number.isFinite(v) ? v : d; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const erros = [];
let reqs = 0, cotaEstourou = false;

/* Nunca imprime a chave, nem em erro: o log do Actions é público num repo público. */
function limpa(msg) { return KEY ? String(msg).split(KEY).join('***') : String(msg); }

async function get(path, { critico = false } = {}) {
  if (reqs >= MAX_REQ) { cotaEstourou = true; throw new Error(`teto de ${MAX_REQ} requisições atingido`); }
  let ultima = '';
  for (let tent = 0; tent < 4; tent++) {
    reqs++;
    let r;
    try {
      r = await fetch(API + path, { headers: { 'X-API-Key': KEY, Accept: 'application/json' } });
    } catch (e) { ultima = 'rede: ' + e.message; await sleep(800 * (tent + 1)); continue; }

    if (r.ok) return r.json();

    // 429 = cota do dia. Insistir só queima o resto do orçamento.
    if (r.status === 429) { cotaEstourou = true; throw new Error('429 cota diária esgotada'); }
    if (r.status === 401 || r.status === 403) throw new Error(`${r.status} chave recusada ou endpoint fora do plano`);
    if (r.status === 404) throw new Error('404 não encontrado');
    ultima = 'HTTP ' + r.status;
    if (r.status < 500) break;
    await sleep(900 * (tent + 1));
  }
  throw new Error(ultima || 'falhou');
}

async function tenta(rotulo, fn, { critico = false } = {}) {
  try { return await fn(); }
  catch (e) {
    const msg = limpa(e.message);
    erros.push(`${rotulo}: ${msg}`);
    console.error(`  ✗ ${rotulo} — ${msg}`);
    if (critico) throw e;
    return null;
  }
}

async function grava(rel, dados) {
  const p = join(OUT, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(dados));
  return p;
}

/* a API devolve ora {data:[…]}, ora {results:[…]}, ora a lista pelada */
function linhas(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  for (const k of ['data', 'results', 'items', 'rows', 'stocks', 'fiis', 'funds', 'series', 'tickers']) {
    if (Array.isArray(d[k])) return d[k];
  }
  for (const v of Object.values(d)) if (Array.isArray(v)) return v;
  return [];
}
const tickerDe = o => String(o?.ticker || o?.symbol || o?.stock || o?.code || o?.ticker_primary || '').toUpperCase();
const numDe = (o, ks) => { for (const k of ks) { const v = o?.[k]; if (v != null && v !== '' && Number.isFinite(+v)) return +v; } return null; };

async function main() {
  if (!KEY) { console.error('BOLSAI_API_KEY ausente — configure o Secret do repositório.'); process.exit(1); }
  console.log(`Snapshot Bolsai → ${OUT}  (detalhe: ${DET_ACOES} ações, ${DET_FIIS} FIIs; teto ${MAX_REQ} req)`);

  /* ---------- núcleo: alimenta Ações, FIIs, Macro, Alocador, lista e carteira ---------- */
  const setores = await tenta('setores', () => get('/companies/sectors'));
  if (setores) await grava('setores.json', setores);

  const acoes = await tenta('screener de ações',
    () => get('/screener/?limit=500&sort=market_cap&order=desc'));
  const linhasAcoes = linhas(acoes);
  await grava('acoes.json', { gerado_em: new Date().toISOString(), total: linhasAcoes.length, rows: linhasAcoes });
  console.log(`  ✓ ações: ${linhasAcoes.length}`);

  const fiis = await tenta('screener de FIIs',
    () => get('/fiis/screener?limit=500&sort=dividend_yield_ttm&order=desc'));
  const linhasFiis = linhas(fiis);
  await grava('fiis.json', { gerado_em: new Date().toISOString(), total: linhasFiis.length, rows: linhasFiis });
  console.log(`  ✓ FIIs: ${linhasFiis.length}`);

  /* ---------- macro ---------- */
  const lista = await tenta('lista de séries macro', () => get('/macro/'));
  const nomes = linhas(lista)
    .map(x => typeof x === 'string' ? x : String(x?.name || x?.series || x?.series_name || x?.code || ''))
    .filter(Boolean);
  const querPegar = nomes.filter(n => /selic|cdi|ipca|igp|ptax|d[oó]lar|usd/i.test(n));
  const series = {};
  for (const n of (querPegar.length ? querPegar : nomes).slice(0, 6)) {
    const d = await tenta(`macro ${n}`, () => get(`/macro/${encodeURIComponent(n)}?limit=36`));
    if (d) series[n] = linhas(d);
    await sleep(120);
  }
  await grava('macro.json', { gerado_em: new Date().toISOString(), series });
  console.log(`  ✓ macro: ${Object.keys(series).length} séries`);

  /* ---------- raio-X por ticker ---------- */
  const ordenaPor = (arr, ks) => [...arr].sort((a, b) => (numDe(b, ks) ?? -Infinity) - (numDe(a, ks) ?? -Infinity));
  const alvoAcoes = ordenaPor(linhasAcoes, ['market_cap', 'market_capitalization', 'market_value'])
    .map(tickerDe).filter(Boolean).slice(0, Math.max(DET_ACOES, 0));
  const alvoFiis = ordenaPor(linhasFiis, ['dividend_yield_ttm', 'dividend_yield'])
    .map(tickerDe).filter(Boolean).slice(0, Math.max(DET_FIIS, 0));
  const tickersFii = new Set(linhasFiis.map(tickerDe));
  const alvos = [...new Set([...EXTRA, ...alvoAcoes, ...alvoFiis])];

  const detalhados = [];
  for (const tk of alvos) {
    if (cotaEstourou || reqs >= MAX_REQ) { console.log('  ! orçamento de requisições esgotado — detalhe interrompido'); break; }
    const ehFii = tickersFii.has(tk);
    const det = { ticker: tk, tipo: ehFii ? 'fii' : 'acao', gerado_em: new Date().toISOString() };
    const p = async (campo, path) => { const d = await tenta(`${tk} ${campo}`, () => get(path)); if (d) det[campo] = d; };

    await p('quote', `/stocks/${tk}/quote`);
    await p('stats', `/stocks/${tk}/stats`);
    await p('history', `/stocks/${tk}/history?limit=180`);
    if (ehFii) {
      await p('fii', `/fiis/${tk}`);
      await p('distributions', `/fiis/${tk}/distributions?years=5`);
      await p('fiiHistory', `/fiis/${tk}/history?limit=24`);
      await p('tenants', `/fiis/${tk}/tenants`);
    } else {
      await p('fundamentals', `/fundamentals/${tk}`);
      await p('fundamentalsHistory', `/fundamentals/${tk}/history?limit=12`);
      await p('dividends', `/dividends/${tk}?years=5`);
      await p('company', `/companies/${tk}`);
      await p('events', `/stocks/${tk}/corporate-events`);
    }
    await grava(`ativos/${tk}.json`, det);
    detalhados.push(tk);
    if (detalhados.length % 10 === 0) console.log(`  … ${detalhados.length}/${alvos.length} detalhados (${reqs} req)`);
    await sleep(90);
  }
  console.log(`  ✓ raio-X: ${detalhados.length} tickers`);

  const meta = {
    gerado_em: new Date().toISOString(),
    requisicoes: reqs,
    cota_estourou: cotaEstourou,
    acoes: linhasAcoes.length,
    fiis: linhasFiis.length,
    series_macro: Object.keys(series),
    detalhados,
    erros: erros.slice(0, 60)
  };
  await grava('meta.json', meta);

  console.log(`\nPronto: ${reqs} requisições, ${erros.length} erros.`);
  /* Falhar a execução aqui apagaria o site publicado por causa de um erro
     de dado. O painel mostra o que veio e sinaliza o que faltou. */
  if (!linhasAcoes.length && !linhasFiis.length) {
    console.error('Nenhum dado obtido — verifique a chave e o plano.');
    process.exit(2);
  }
}

main().catch(e => { console.error('Falha geral:', limpa(e.message)); process.exit(1); });
