# Dashboard IGT — Redesign Completo

**Data:** 2026-04-09  
**Projeto:** Gestão em 4 Minutos — Painel Interno IGT  
**Abordagem:** Bottom-up (componentes base → páginas)  
**Stack:** Next.js 16, Tailwind CSS v4, Recharts, Inter font

---

## 1. Tokens de Design & Sistema de Cores

### globals.css — variáveis atualizadas

```css
:root {
  /* Brand */
  --color-primary:       #3B93C3;  /* IGT blue — botões, links, ativos, foco */
  --color-primary-dark:  #2E7AA8;  /* hover de botões primários */
  --color-primary-light: #EBF5FB;  /* bg de item ativo na nav, badges info */
  --color-accent:        #F5A623;  /* laranja IGT — warnings, badges destaque */

  /* Superfícies */
  --color-bg:      #F1F5F9;  /* fundo geral das páginas */
  --color-surface: #FFFFFF;  /* cards, sidebar, modais */
  --color-border:  #E2E8F0;  /* bordas de cards, inputs, separadores */

  /* Tipografia */
  --color-text:       #1E293B;  /* texto principal */
  --color-text-muted: #64748B;  /* labels, subtítulos, placeholders */

  /* Semântica */
  --color-success: #16A34A;
  --color-danger:  #DC2626;
  --color-warning: #F5A623;  /* reutiliza accent */

  /* Forma */
  --radius-sm:   8px;   /* inputs, badges */
  --radius-card: 12px;  /* cards */
  --radius-lg:   16px;  /* modais */

  /* Sombra */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:   0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
}
```

### Escala tipográfica

| Uso | Tamanho | Peso |
|---|---|---|
| KPI value | 28px | 700 |
| Heading de página | 20px | 600 |
| Heading de card | 15px | 600 |
| Body / cell | 14px | 400 |
| Label / caption | 13px | 500 |
| Badge | 12px | 500 |

### Grid de espaçamento

Base **8px** — todos os gaps e paddings múltiplos de 4 ou 8.  
Padding interno de card: `20px`. Gap entre cards: `16px`. Padding de página: `24px`.

---

## 2. Sidebar — Layout Colapsável

### Estrutura

```
┌──────────────────────┐
│  Logo / Ícone IGT    │  ← 56px de altura, padding 16px
├──────────────────────┤
│  Nav links           │  ← flex-1, overflow-y auto
├──────────────────────┤
│  Usuário + Logout    │  ← fixo no rodapé
└──────────────────────┘
```

### Dimensões

- **Expandida:** 220px
- **Colapsada:** 60px
- Transição: `width 200ms ease` via CSS transition
- Estado persistido em `localStorage` (`sidebar-collapsed`)

### Cabeçalho (topo da sidebar)

- **Expandida:** logo IGT (`/igt-logo.png`, 28px) + texto "IGT" em branco, fundo IGT blue, padding 16px 
- **Colapsada:** apenas logo IGT centralizada (28px)

### Itens de navegação

- Ícone SVG 18px + label (expandida) / ícone SVG 18px centralizado (colapsada)
- **Ativo:** background `--color-primary-light`, texto `--color-primary`, borda esquerda `3px solid --color-primary`
- **Hover:** background `#F8FAFC`, transição 150ms
- **Colapsada + hover:** tooltip flutuante à direita com o label da seção (posição absolute, z-index alto)
- Padding por item: `10px 16px` (expandida), `10px 0` centralizado (colapsada)

### Botão de colapso

- Ícone de chevron `«` / `»`, posicionado na borda direita da sidebar, verticalmente centrado
- Fundo branco, borda sutil, `border-radius: 50%`, 24px × 24px
- `position: absolute; right: -12px; top: 50%`

### Rodapé

- **Expandida:** email do usuário (truncado, 13px muted) + ícone logout à direita
- **Colapsada:** apenas ícone de logout centralizado com tooltip "Sair"

---

## 3. Layout de Página (Dashboard Shell)

```
┌──────────┬─────────────────────────────────────────────┐
│          │  Page Header (title + subtitle + actions)   │
│ Sidebar  ├─────────────────────────────────────────────┤
│          │  Conteúdo da página (scroll vertical)       │
└──────────┴─────────────────────────────────────────────┘
```

- Main area: `flex-1`, `overflow-y: auto`, `background: --color-bg`
- Page header: `background: --color-surface`, `border-bottom: 1px solid --color-border`, `padding: 20px 24px`
  - Título: 20px semibold, texto principal
  - Subtítulo (opcional): 13px muted
  - Ações (filtros, export): agrupadas à direita em row

---

## 4. Componentes Base

### 4.1 KpiCard

**Layout:**
```
┌──────────────────────────────────┐
│  [ícone]  Título          delta  │
│           Valor                  │
│           [sparkline]            │
└──────────────────────────────────┘
```

- Fundo `--color-surface`, `border-radius: --radius-card`, `border: 1px solid --color-border`, `box-shadow: --shadow-card`
- Padding: `20px`
- Ícone: círculo 36px, background `--color-primary-light`, ícone SVG 16px em `--color-primary`
- Título: 13px, `--color-text-muted`, font-weight 500
- Valor: 28px bold, `--color-text`
- Delta: pill `border-radius: 99px`, 12px medium — verde (`#DCFCE7` bg + `#16A34A` text) ou vermelho (`#FEE2E2` bg + `#DC2626` text)
- Sparkline: largura completa, altura 48px, `margin-top: 12px`
- Grid: 4 colunas desktop / 2 tablet (768px) / 1 mobile (375px)

### 4.2 LineChart (card)

- Fundo `--color-surface`, padding `20px`, `border-radius: --radius-card`, `border: 1px solid --color-border`
- Cor primária da série: `--color-primary`
- Gradiente fill: `--color-primary` → opacidade 0
- Gridlines: `#F1F5F9` (invisível quase, não compete com dados)
- Tooltip: fundo branco, sombra `--shadow-md`, border-radius 8px, texto 13px
- Legenda: acima do gráfico, à direita do título
- Botões de período (7d / 30d / 90d): pill buttons, ativo com `--color-primary` bg branco texto, inativo com border sutil

### 4.3 DataTable

- Fundo `--color-surface`, `border-radius: --radius-card`, `border: 1px solid --color-border`
- Cabeçalho: `background: #F8FAFC`, `border-bottom: 1px solid --color-border`, 13px medium, `--color-text-muted`
- Linhas: branco; hover `#F8FAFC` (remover zebra striping — visual mais limpo)
- Separadores: apenas `border-bottom: 1px solid --color-border` entre linhas
- Células: 14px, `--color-text`, padding `12px 16px`
- Ordenação: ícone de seta no header, ativo com `--color-primary`
- Export CSV: botão secundário (borda `--color-border`, texto `--color-text-muted`) no canto superior direito do card

### 4.4 SectionTabs

- Container: `border-bottom: 1px solid --color-border`, background transparente
- Item ativo: `border-bottom: 2px solid --color-primary`, texto `--color-primary`, 14px semibold
- Item inativo: texto `--color-text-muted`, 14px regular, hover → `--color-text`
- Padding por item: `10px 16px`
- Sem background de pill — estilo underline limpo

### 4.5 AccountTabs

- Pills horizontais com `border-radius: --radius-sm`
- Ativo: `background: --color-primary`, texto branco
- Inativo: `background: transparent`, `border: 1px solid --color-border`, texto `--color-text-muted`
- Hover inativo: `background: --color-primary-light`
- Padding: `6px 14px`, texto 13px medium

### 4.6 Skeleton (loading)

- Cor base: `#E2E8F0`, animação `animate-pulse`
- Formas espelham exatamente o componente real (mesmos border-radius, mesmos tamanhos)
- Sem mudanças estruturais — apenas atualizar as cores para alinhar com novos tokens

### 4.7 Badges de Status

Shape: `border-radius: 99px`, padding `3px 10px`, 12px medium

| Status | Background | Texto |
|---|---|---|
| Aprovado / Ativo | `#DCFCE7` | `#16A34A` |
| Pendente | `#FEF9C3` | `#B45309` |
| Cancelado / Inativo | `#FEE2E2` | `#DC2626` |
| Em análise | `#DBEAFE` | `#1D4ED8` |
| Reembolsado | `#F3E8FF` | `#7C3AED` |
| Expirado / Bloqueado | `#F1F5F9` | `#475569` |

---

## 5. Páginas

### 5.1 Dashboard Layout (`layout.tsx`)

- Substituir sidebar atual por versão colapsável
- Adicionar `PageHeader` como componente reutilizável (`src/components/layout/page-header.tsx`)
- Atualizar metadado: `title: "Painel IGT — Gestão em 4 Minutos"`

### 5.2 YouTube, Instagram, Hotmart

- Substituir KpiCards pelos redesenhados
- Adicionar `PageHeader` com título da plataforma + subtítulo (ex: "Análise de canal")
- Filtros de data + AccountTabs movidos para o `PageHeader` (área de ações)
- Remover padding/estrutura ad-hoc — usar grid consistente
- Gráfico ocupa 100% da largura do conteúdo
- Tabela de dados ocupa 100% da largura abaixo do gráfico

### 5.3 Dados

- `PageHeader` com título "Dados & Sincronização"
- Tabs de plataforma usando `SectionTabs`
- Área de batch collect da Hotmart: card `--color-surface` com padding consistente
- Tabela de logs com badges de status atualizados

### 5.4 Configurações

- `PageHeader` com título "Configurações"
- Seções separadas por cards (`AccountList`, `UserManagement`) com títulos de seção internos
- Modal `AccountForm`: padding 24px, `border-radius: --radius-lg`, sombra `--shadow-md`

---

## 6. Ordem de Implementação

1. **`globals.css`** — atualizar tokens
2. **`src/components/ui/`** — KpiCard, DataTable, LineChart, Sparkline, Skeleton
3. **`src/components/dashboard/`** — SectionTabs, AccountTabs
4. **`src/components/layout/`** — sidebar colapsável, PageHeader
5. **`src/app/dashboard/layout.tsx`** — integrar novo sidebar
6. **Páginas** — YouTube, Instagram, Hotmart, Dados, Settings

---

## 7. O que NÃO muda

- Lógica de autenticação e rotas
- Chamadas de API e hooks de dados
- Componente `LoginForm` (já redesenhado)
- Estrutura de arquivos e nomenclatura
- Integrações com Recharts (apenas estilização)
