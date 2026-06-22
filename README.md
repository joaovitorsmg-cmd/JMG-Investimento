# JMG Investimentos — Painel

App pessoal (PWA) de renda passiva e valor na B3: scanner de ações e FIIs, alocador de ordem de compra, carteira e lista de acompanhamento. Dados ao vivo via [brapi.dev](https://brapi.dev).

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
1. Abra o app → toque no cadeado **"Sem token"** no topo.
2. Cole seu token da brapi.dev → **Salvar e conectar**.
3. Vá em **Scanner B3 → Escanear B3**.

> O token e seus dados ficam salvos no aparelho (localStorage). No GitHub Pages persistem entre visitas; se abrir o arquivo baixado direto, pode pedir o token de novo.

## Atualizar o app depois de mudar algo
Edite o arquivo no GitHub e suba a versão do cache em `sw.js` (ex.: `jmg-inv-v1` → `jmg-inv-v2`). Sem isso, o celular pode continuar mostrando a versão antiga em cache.

---
*Ferramenta de organização e estudo. Não é recomendação de investimento.*
