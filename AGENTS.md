<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Dash V2 (reestilização) — leia antes de concluir que algo "não existe"

A V2 é uma camada visual nova sob a rota `/v2/...`, com piloto no Indicadores. O V1 não muda. Escopo e decisões: `docs/PRD_2026-10-22_dash_v2.md` (issue #250) e `dash_gestao_v2/DIRECAO_DESIGN.md`.

**O código da V2 pode não estar na `main`.** Ele vive em PRs empilhados e na branch `preview/v2`. Antes de afirmar que um arquivo, rota ou componente da V2 não existe, faça:

1. `git fetch origin`
2. `gh pr list --state open --search "v2"` e `git branch -r | grep -i v2`
3. Procure em `origin/preview/v2`, não só na árvore atual (`git ls-tree -r origin/preview/v2 --name-only | grep v2`).

**Onde está cada coisa**

- `src/app/v2/` — rotas (`/v2`, `/v2/indicadores/eventos`, `/v2/indicadores/[id]`, `/v2/_kit`).
- `src/components/v2/` — `ui/`, `motion/`, `shell/`, `charts/`, `evento/`, `eventos/`, `cor.ts`, `tokens.css`.
- `preview/v2` — integração de todas as branches V2 mais o upgrade do Next; é o que sobe no servidor de testes. Nunca é mergeada: é descartável e refeita a partir da pilha.
- `feat/v2-*`, `perf/v2-bundle`, `ci/v2-orcamento-bundle` — a pilha de PRs, cada um apontando para o anterior. A ordem de integração é a ordem das dependências: `feat/v2-fundacao` → `primitivos` → `shell` → `seletor-eventos` → `perf/v2-bundle` → `dashboard-evento` → `heroi-webgl` → `animacoes` → `jornada-fluxo` → `cor`.
- `dash_gestao_v2/` — PRD, direção de design e tokens-fonte. Os tokens vivos ficam em `src/components/v2/tokens.css`.

**Regras**

- O V1 nunca importa de `v2/` (teste de isolamento em `src/app/v2/__tests__`).
- Mergear a base de um PR empilhado com `--delete-branch` fecha o PR filho: retargete o filho para a `main` antes.
- Branch nova da V2 sai da ponta da pilha, não da `main`, e entra em `preview/v2` por merge.
- Use `git worktree list` para ver onde cada branch está aberta; o diretório principal costuma estar na `main`, que não reflete a V2.
