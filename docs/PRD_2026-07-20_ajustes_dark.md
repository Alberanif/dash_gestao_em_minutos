# PRD — Ajustes na identidade escura (.dash-dark)

**Date:** 2026-07-20
**Status:** Approved (decisões validadas em entrevista com o owner)
**Owner:** Alberani

## 1. Contexto e problema

O módulo **Ajustes** (`/ajustes`, `/ajustes/configuracoes`, `/ajustes/dados`) é a última área do produto que ainda usa o layout antigo claro (branco + azul `#3b93c3`, tokens de `globals.css`). Todo o restante — menu inicial, Indicadores, Dash Ultimates — já adota paleta escura com visual profissional. O contraste é imediato: ao navegar do menu escuro para os Ajustes, a tela "estoura" em branco e destoa da identidade do produto.

O projeto já possui uma **identidade escura oficial e compartilhada**: a classe `.dash-dark` em `src/app/dash-theme.css`, consumida por Indicadores e Dash Ultimates. Ela define superfícies, bordas, texto, acentos e tipografia (IBM Plex Sans/Mono) e **remapeia os tokens legados `--color-*`** — de modo que componentes globais (`surface-card`, `btn-primary`, `btn-secondary`, `field-control`, `DataTable`) ficam corretos no escuro sem alteração, bastando o root do módulo receber a classe.

**Objetivo:** migrar o módulo Ajustes para a `.dash-dark`, eliminando a última área clara "legada" do fluxo principal, **consumindo** a identidade compartilhada (nunca copiando tokens) e sem regressão visual nas páginas claras de `/dashboard` que compartilham componentes.

## 2. Escopo

### Incluído

- **Hub `/ajustes`** (tela com os cards "Configurações" e "Dados") migrado para `.dash-dark`, seguindo o precedente do seletor de eventos do Indicadores (telas de seleção *dentro* de módulo usam `.dash-dark`; o navy é exclusivo da home).
- **`/ajustes/configuracoes`** (contas conectadas + gerenciamento de usuários) e **`/ajustes/dados`** (sincronização, coletas em lote, logs) migradas para `.dash-dark`.
- **Componentes compartilhados** (`StatusBadge`, `Skeleton`) adaptados pelo padrão **token com fallback claro** — precedente já existente no `DataTable` (`var(--table-header-bg, #F8FAFC)`): os hex claros fixos viram fallback, e os valores escuros são definidos apenas dentro de `.dash-dark` em `dash-theme.css`. Páginas claras de `/dashboard` permanecem intactas.
- **Cores fixas claras** nos componentes de settings (`account-list`, `account-form`, `user-management`, `settings-cards`) mapeadas para os acentos oficiais da `.dash-dark` com fundo translúcido.
- **Aposentadoria da duplicata legada `/dashboard/settings`**: a rota vira `redirect()` para `/ajustes/configuracoes` (bookmarks não quebram); os links "Configurações" nas páginas `/dashboard/{youtube,instagram,hotmart,meta-ads}` passam a apontar para `/ajustes/configuracoes`. Isso elimina a última tela que consumia `AccountList`/`UserManagement` no claro.

### Fora de escopo

| Item | Motivo |
|---|---|
| Escurecer as demais páginas de `/dashboard` (Gestão à Vista) | Fora do pedido; continuam claras e os componentes compartilhados preservam o fallback claro por causa delas |
| Redesenhar o menu inicial (`/`) | Já é escuro (identidade navy própria da home) e tem testes de restrição por papel |
| Mudanças funcionais nos Ajustes | Restyle puro: nenhuma lógica, rota de API ou permissão muda |
| Unificar a identidade navy da home com a `.dash-dark` | Decisão de identidade separada, não bloqueia este trabalho |

## 3. Decisões de design (validadas em entrevista)

1. **Identidade do hub:** `.dash-dark` como as subpáginas — módulo coeso, precedente do Indicadores. (Alternativas rejeitadas: estilo navy da home; eliminar o hub movendo as entradas para o menu inicial.)
2. **Estratégia para componentes compartilhados:** token com fallback claro (precedente `DataTable`), sem duplicar componentes e sem tocar o visual das telas claras.
3. **Mapeamento de cores fixas → acentos `.dash-dark`:**
   - Badges de papel (`user-management`): gestor → `--amber`, analista → `--violet`, comum → `--blue`, sempre com fundo translúcido (padrão dos dashes) em vez de pastel sólido.
   - Banners e estados de sucesso/erro (`account-form`, `StatusBadge`): `--green` / `--red` translúcidos.
   - Cards do hub: "Configurações" com acento `--blue`, "Dados" com acento `--green` (substituindo `#059669`/`#ecfdf5`).
   - Fundos utilitários `#F8FAFC`/`#E2E8F0` → superfícies `--surface-2`/tons equivalentes via token.
4. **Consequências assumidas da adoção da identidade:** tipografia do módulo muda de DM Sans para IBM Plex Sans/Mono; botão "Voltar" do `PageHeader` fica `--blue` sobre fundo escuro — ambos sem alteração no componente, apenas pelo remapeamento de tokens.
5. **`/dashboard/settings`:** `redirect()` em vez de deleção, preservando links antigos.

## 4. Validação

- App em dev: conferência visual das 3 telas escuras, do redirect de `/dashboard/settings` e de **uma tela clara de `/dashboard`** (anti-regressão dos componentes compartilhados), com screenshots anexados ao PR.
- Suíte de testes completa. As 7 falhas pré-existentes do repo não fazem parte do escopo.

## 5. Entrega

- Branch a partir da `main`; PR único referenciando esta issue.
- Nenhuma migração de banco, nenhuma variável de ambiente, nenhuma dependência nova.
