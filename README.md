# JMG Investimentos — Painel

App pessoal (PWA) de renda passiva e valor na B3: scanner de ações e de FIIs, raio-X por ativo, termômetro macro, alocador de ordem de compra, carteira e lista de acompanhamento. Dados via [Bolsai](https://usebolsai.com) (`api.usebolsai.com`).

## Abas
| Aba | O que faz |
|---|---|
| **Alocador** | Informe o valor disponível → ordem de compra pronta (o que comprar, quantas cotas), com renda anual estimada e comparação com a Selic/CDI |
| **Ações** | Screener da B3 numa requisição: P/L, P/VP, ROE, margem líquida, EV/EBITDA, dívida/PL, DY — com ranking de renda, de valor e universo ordenável |
| **FIIs** | Screener de FIIs: P/VP, DY 12m, VP/cota, vacância, segmento, tipo, mandato e gestão |
| **Ativo** | Raio-X de ação ou FII: faixa de 52 semanas, trajetória de preço, proventos pagos, fundamentos trimestrais, eventos corporativos, cadastro CVM, inquilinos (FII) |
| **Macro** | Selic, CDI, IPCA, IGP-M e dólar PTAX, com acumulado composto para as séries de inflação |
| **Minha lista** | Watchlist com alvo manual, teto de Bazin ou preço de Graham |
| **Carteira** | Posição, resultado, dividendos/ano estimados e yield on cost vs. renda fixa |

## Arquivos
```
index.html                      → o painel
tools/snapshot.mjs              → busca os dados na Bolsai (roda no Actions)
.github/workflows/pages.yml     → agenda a coleta e publica o site
worker.js                       → proxy Cloudflare, só para o modo ao vivo
manifest.json                   → identidade do app (nome, ícones, cores)
sw.js                           → service worker (offline + instalável)
icon-192.png / icon-512.png     → ícones do app
```

## Instalar no celular (vira app com ícone)
- **Android (Chrome):** abra o link → menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o link → **Compartilhar** → **Adicionar à Tela de Início**.

Depois de instalado, abre em tela cheia e funciona offline — como os dados são arquivos
estáticos publicados junto do app, até o scanner continua respondendo sem internet, com
os números da última publicação.

## Como os dados chegam até o painel

A `api.usebolsai.com` **não aceita chamadas de navegador**: ela responde, mas não envia
`Access-Control-Allow-Origin`, então o navegador barra a leitura de qualquer resposta.
Isso não tem correção no front-end — a chamada precisa sair de um servidor.

O servidor aqui é o próprio **GitHub Actions**:

```
GitHub Actions (servidor, sem CORS)          GitHub Pages                 celular
  tools/snapshot.mjs                           _site/index.html             lê ./data/*.json
  → api.usebolsai.com  ──busca──▶  _site/data/*.json  ──publica──▶  mesma origem, sem CORS
  chave = Secret BOLSAI_API_KEY
```

Consequências, todas boas:

- **a chave nunca chega ao aparelho** — vive só no Secret do repositório;
- **nenhuma cota é gasta pelo celular**: quem consome as requisições é a Action, uma vez por dia;
- o painel abre **já pronto** — scanner, FIIs e macro carregados, sem apertar botão;
- funciona offline, porque é tudo arquivo estático.

O preço é a atualização ser periódica em vez de instantânea — o que não custa nada aqui,
já que a Bolsai entrega **fechamento** da B3, não preço intradiário.

## Configurar (uma vez)

1. **Chave como Secret** — no GitHub: `Settings → Secrets and variables → Actions → New repository secret`,
   nome `BOLSAI_API_KEY`, valor = sua chave da Bolsai.
2. **Pages pelo Actions** — `Settings → Pages → Source: GitHub Actions`.
   (O workflow tenta configurar sozinho; se a conta não permitir, esse clique resolve.)
3. **Rodar** — aba `Actions → Publicar painel e atualizar dados → Run workflow`.

Daí em diante roda sozinho às 23:00 UTC (20:00 de Brasília) nos dias úteis, e a cada push.

### Ajustar o volume de dados
No `Run workflow` dá para mudar, ou editar os defaults em `.github/workflows/pages.yml`:

| Entrada | Padrão | O que faz |
|---|---|---|
| `detalhe_acoes` | 60 | quantas ações ganham raio-X (preço 52s, proventos, balanços, cadastro) |
| `detalhe_fiis` | 40 | quantos FIIs ganham raio-X (distribuições, histórico, inquilinos) |
| `max_req` | 800 | teto de requisições da execução |
| `tickers_extra` | — | tickers sempre detalhados, separados por vírgula |

Custo aproximado: 9 requisições para o núcleo (screener de ações, de FIIs, setores e macro)
mais ~6 por ação detalhada e ~5 por FII. **No plano grátis (200/dia)** use
`detalhe_acoes=15`, `detalhe_fiis=10`, `max_req=180` — o núcleo sozinho já alimenta
Alocador, os dois scanners, Macro, Minha lista e Carteira. **No Pro (10 mil/dia)** os padrões
sobram, e dá para subir bastante.

Se a Bolsai falhar numa execução, o job recupera o snapshot anterior do cache e publica
ele: o painel fica com dado de ontem em vez de ficar vazio. O resumo da execução no
GitHub mostra o que veio e o que faltou.

## Modo ao vivo (opcional)

Em `Config → Fonte de dados` dá para escolher "Sempre ao vivo". Como o navegador barra a
Bolsai direto, esse modo exige um proxy: `worker.js` é um Cloudflare Worker pronto
(instruções no topo do arquivo) — publique, e preencha `Config → Proxy` com a URL dele.
Serve para consultar um ticker que ficou fora do raio-X do snapshot.

## Atualizar o app depois de mudar algo
Edite o arquivo no GitHub e pronto: o service worker busca o shell **pela rede primeiro** e só cai no cache quando está offline, então o que está publicado é o que aparece no próximo carregamento. Se o app já estava aberto quando você publicou, ele avisa "Nova versão instalada" e recarrega sozinho.

A versão em execução aparece em **Config → Cache e consumo**. Use isso para conferir se o celular pegou o deploy novo.

> Até a v6 o shell era servido do cache primeiro, e o celular ficava preso numa build antiga até limpar os dados do site na mão. Se algum aparelho ainda estiver assim: exporte o backup em Config, limpe os dados do site no navegador, reabra e importe o JSON.

## Histórico de fontes de dados
Rodava em brapi.dev com a HG Brasil como reserva de DY/P-VP; as duas saíram e tudo passou para a Bolsai. Ganhos da migração: o scanner faz **uma** chamada em vez de dezenas, ROE/margem líquida/dívida-patrimônio vêm calculados em vez de aproximados por LPA÷VPA, FIIs ganharam vacância/segmento/inquilinos, e entraram as abas **Ativo** e **Macro**. Perda: os minicontratos **WIN/WDO** eram exclusivos da brapi e a Bolsai não cobre derivativos — aquele card virou o termômetro macro, que serve à mesma decisão (comparar o yield da ordem com a renda fixa).

---
*Ferramenta de organização e estudo. Não é recomendação de investimento.*
