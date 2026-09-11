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
index.html      → o painel
manifest.json   → identidade do app (nome, ícones, cores)
sw.js           → service worker (offline + instalável)
icon-192.png    → ícone do app
icon-512.png    → ícone do app
```

## Publicar no GitHub Pages

**Opção rápida (pelo site, sem Git):**
1. Crie um repositório novo — ex.: `jmg-investimentos`.
2. **Add file → Upload files** → arraste os 5 arquivos acima → **Commit**.
3. **Settings → Pages** → Source: `Deploy from a branch` → Branch: `main` / `/root` → **Save**.
4. Em ~1 min o app fica em:
   `https://joaovitorsmg-cmd.github.io/jmg-investimentos/`

**Opção Git (terminal):**
```bash
git init && git add . && git commit -m "JMG Investimentos"
git branch -M main
git remote add origin https://github.com/joaovitorsmg-cmd/jmg-investimentos.git
git push -u origin main
```
Depois ative o Pages como no passo 3.

## Instalar no celular (vira app com ícone)
- **Android (Chrome):** abra o link → menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o link → **Compartilhar** → **Adicionar à Tela de Início**.

Depois de instalado, abre em tela cheia e funciona offline (as cotações precisam de internet).

## Conectar os dados (1ª vez)
1. Crie a conta com Google em **usebolsai.com** e gere sua chave de API.
2. Abra o app → toque em **"Sem chave"** no topo → cole a chave → **Salvar e conectar**.
3. Vá em **Ações → Escanear B3**.

> A chave e seus dados ficam salvos só no aparelho (localStorage) e a chave vai no header `X-API-Key`. No GitHub Pages persistem entre visitas; se abrir o arquivo baixado direto, pode pedir a chave de novo.

### Cota da API
O plano grátis da Bolsai dá **200 requisições/dia**, então o painel cacheia cada resposta: cotação 15 min, fundamentos 12 h, proventos e FIIs 24 h, macro 6 h, setores 7 dias. O contador no topo mostra quanto resta, e **Config → Cache e consumo** permite limpar o cache ou reler a cota. Mudar critérios (DY mínimo, ROE, P/L, dívida) **re-ranqueia o universo já baixado sem gastar requisição**.

Endpoints de **proventos, balanços e macro são do plano Pro**. No grátis o painel segue funcionando: preço, fundamentos, screener de ações e de FIIs respondem, e o DPA pode ser lançado à mão em *Minha lista*.

### Se tudo falhar de uma vez
Rode **Config → Diagnóstico da API**. Ele começa por uma sonda de conectividade que faz três chamadas — uma sem header custom, uma com `X-API-Key` e uma com `?api_key=` — e conclui qual é o caso:

- nenhuma chega → rede do aparelho ou a Bolsai fora do ar;
- só a do header falha → **CORS no preflight** do `X-API-Key`. Se a de `?api_key=` passar, troque **Config → Como enviar a chave** para *Parâmetro `?api_key=`* e o painel volta a funcionar. Se nenhuma das duas passar, só a Bolsai resolve, liberando a origem do painel;
- todas chegam → é status HTTP, e a lista de endpoints logo abaixo mostra qual.

> Até a v7 o service worker devolvia um 503 sintético quando a chamada falhava, então falta de rede, DNS e bloqueio de CORS apareciam todos como "Bolsai fora do ar (503)". Agora a chamada sai direto pelo navegador e o erro real aparece como erro real.

### Se alguma coluna aparecer vazia
O OpenAPI da Bolsai deixa vários schemas abertos, então o painel procura cada métrica por vários nomes de campo possíveis. Em **Config → Diagnóstico da API** ele bate em cada endpoint e imprime os campos que voltaram — compare com a lista `F` no topo do `<script>` e acrescente o nome que faltar.

## Atualizar o app depois de mudar algo
Edite o arquivo no GitHub e pronto: o service worker busca o shell **pela rede primeiro** e só cai no cache quando está offline, então o que está publicado é o que aparece no próximo carregamento. Se o app já estava aberto quando você publicou, ele avisa "Nova versão instalada" e recarrega sozinho.

A versão em execução aparece em **Config → Cache e consumo**. Use isso para conferir se o celular pegou o deploy novo.

> Até a v6 o shell era servido do cache primeiro, e o celular ficava preso numa build antiga até limpar os dados do site na mão. Se algum aparelho ainda estiver assim: exporte o backup em Config, limpe os dados do site no navegador, reabra e importe o JSON.

## Histórico de fontes de dados
Rodava em brapi.dev com a HG Brasil como reserva de DY/P-VP; as duas saíram e tudo passou para a Bolsai. Ganhos da migração: o scanner faz **uma** chamada em vez de dezenas, ROE/margem líquida/dívida-patrimônio vêm calculados em vez de aproximados por LPA÷VPA, FIIs ganharam vacância/segmento/inquilinos, e entraram as abas **Ativo** e **Macro**. Perda: os minicontratos **WIN/WDO** eram exclusivos da brapi e a Bolsai não cobre derivativos — aquele card virou o termômetro macro, que serve à mesma decisão (comparar o yield da ordem com a renda fixa).

---
*Ferramenta de organização e estudo. Não é recomendação de investimento.*
