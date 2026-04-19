# Indicadores — Design Spec

**Data:** 2026-04-19  
**Status:** Aprovado

---

## Visão Geral

Adição de um novo módulo chamado **Indicadores** ao projeto DASH_GESTAO. Ao fazer login, o usuário passa a ver uma tela de seleção que permite escolher entre **Gestão à Vista** (dashboard atual) e **Indicadores** (nova central de projetos retroativos). A tela de seleção aparece toda vez que o usuário faz login.

---

## Roteamento e Navegação

**Fluxo pós-login:**
```
/login → (autenticado) → /  → tela de seleção
                              ├── "Gestão à Vista" → /dashboard
                              └── "Indicadores"    → /indicadores
```

**Mudanças em `src/app/page.tsx`:**  
Em vez de redirecionar automaticamente para `/dashboard`, renderiza a tela de seleção para usuários autenticados. Usuários não autenticados continuam sendo redirecionados para `/login`.

**Nova estrutura de rotas:**
```
src/app/
  page.tsx                        ← tela de seleção (Gestão à Vista | Indicadores)
  indicadores/
    layout.tsx                    ← layout próprio sem sidebar, com botão "Trocar módulo"
    page.tsx                      ← lista de projetos
    [id]/
      page.tsx                    ← detalhe do projeto (KPIs + planilha semanal)
```

**Botão "Trocar módulo":** exibido no canto superior direito do layout de Indicadores, navega para `/` (tela de seleção).

---

## Banco de Dados

### Tabela `dash_gestao_indicadores_projects`

Armazena os projetos criados. Compartilhados entre todos os usuários.

```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
name                text NOT NULL
hotmart_product_id  text NOT NULL
campaign_terms      text[] NOT NULL DEFAULT '{}'
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

- `hotmart_product_id`: ID ou nome do produto na Hotmart para cruzar dados de vendas.
- `campaign_terms`: array de termos usados em buscas ILIKE sobre `campaign_name` na tabela `dash_gestao_meta_ads_campaigns`.

### Tabela `dash_gestao_indicadores_weekly_data`

Dados inseridos manualmente pelo usuário, semana a semana, por projeto.

```sql
id                   uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id           uuid NOT NULL REFERENCES dash_gestao_indicadores_projects(id) ON DELETE CASCADE
week_start           date NOT NULL
week_end             date NOT NULL
-- Meta Ads (campos não disponíveis no banco automático)
meta_connect_rate    numeric
meta_lp_conversion   numeric
meta_cpl_traffic     numeric
-- Google Ads (todos manuais por enquanto)
google_spend         numeric
google_cpm           numeric
google_leads         numeric
google_connect_rate  numeric
google_cpl_traffic   numeric
google_lp_conversion numeric
created_at           timestamptz DEFAULT now()
updated_at           timestamptz DEFAULT now()
UNIQUE(project_id, week_start)
```

**Campos automáticos do Meta Ads** (buscados via ILIKE nos `campaign_terms` sobre `dash_gestao_meta_ads_campaigns`):
- Investimento Total (`spend`)
- CPM (`cpm`)
- CTR (`ctr`)
- Leads Totais (`conversions`)

---

## Componentes e Interface

### Tela de Seleção (`/`)

- Dois cards centralizados na tela, sobre fundo dark do sistema.
- Card "Gestão à Vista" → navega para `/dashboard`.
- Card "Indicadores" → navega para `/indicadores`.
- Usuário não autenticado é redirecionado para `/login` antes de ver a tela.

### Layout Indicadores (`/indicadores/layout.tsx`)

- Sem sidebar lateral.
- Barra superior simples com título "Indicadores" à esquerda.
- Botão "← Trocar módulo" no canto superior direito, leva para `/`.
- Envolve todas as rotas abaixo de `/indicadores/`.

### Lista de Projetos (`/indicadores`)

- Header com título "Projetos" e botão "+ Novo Projeto" alinhado à direita.
- Grid de cards — cada card exibe o nome do projeto.
- Clique no card navega para `/indicadores/[id]`.
- **Modal "+ Novo Projeto"** com os campos:
  - Nome do projeto (text)
  - ID/Nome do produto Hotmart (text)
  - Termos de campanha (input com tags — múltiplos valores)
- Suporte a edição e exclusão de projetos via menu no card.

### Detalhe do Projeto (`/indicadores/[id]`)

**1. Seletor de período**  
Date range picker (data início e data fim) no topo da página. Os KPIs e a tabela reagem ao intervalo selecionado.

**2. Seção Meta Ads — KPI Cards (6 cards)**

| KPI | Fonte |
|---|---|
| Investimento Total | Automático (banco) |
| CPM | Automático (banco) |
| CTR | Automático (banco) |
| Connect Rate | Manual (weekly_data) |
| CPL Tráfego | Manual (weekly_data) |
| Taxa Conversão LP | Manual (weekly_data) |

KPIs automáticos: soma/média agregada de todas as campanhas cujo `campaign_name` bate com algum dos `campaign_terms` via ILIKE, dentro do período selecionado.

KPIs manuais: média das semanas com dados preenchidos dentro do período selecionado.

**3. Seção Google Ads — KPI Cards (6 cards)**  
Todos manuais. Cards exibem "—" quando não há dados inseridos para o período.

| KPI |
|---|
| Investimento Total |
| CPM |
| Leads Total |
| Connect Rate |
| CPL Tráfego |
| Taxa Conversão LP |

**4. Planilha de Indicadores Semanais**  
Tabela com uma linha por semana coberta pelo período selecionado.

Colunas:
- Semana (ex: "08/04 a 15/04")
- Investimento Meta (automático)
- CPM Meta (automático)
- CTR Meta (automático)
- Connect Rate (manual)
- Conversão LP (manual)
- CPL Tráfego (manual)
- Leads Totais Meta (automático)
- Investimento Google (manual)
- Leads Google (manual)
- Ação (botão de edição da linha)

Clique em editar abre modal/inline form para inserir/atualizar os campos manuais daquela semana (`week_start` / `week_end`).

---

## API Routes

```
GET    /api/indicadores/projects              ← lista todos os projetos
POST   /api/indicadores/projects              ← cria projeto
PUT    /api/indicadores/projects/[id]         ← edita projeto
DELETE /api/indicadores/projects/[id]         ← exclui projeto

GET    /api/indicadores/projects/[id]/metrics ← KPIs agregados do período (query params: start_date, end_date)
GET    /api/indicadores/projects/[id]/weekly  ← dados semanais do período
POST   /api/indicadores/projects/[id]/weekly  ← cria/atualiza semana (upsert por week_start)
```

---

## Tipos TypeScript

```ts
// src/types/indicadores.ts

export interface IndicadoresProject {
  id: string;
  name: string;
  hotmart_product_id: string;
  campaign_terms: string[];
  created_at: string;
  updated_at: string;
}

export interface IndicadoresWeeklyData {
  id: string;
  project_id: string;
  week_start: string;
  week_end: string;
  meta_connect_rate: number | null;
  meta_lp_conversion: number | null;
  meta_cpl_traffic: number | null;
  google_spend: number | null;
  google_cpm: number | null;
  google_leads: number | null;
  google_connect_rate: number | null;
  google_cpl_traffic: number | null;
  google_lp_conversion: number | null;
  created_at: string;
  updated_at: string;
}

export interface IndicadoresMetrics {
  // Meta Ads (automático)
  meta_spend: number;
  meta_cpm: number;
  meta_ctr: number;
  meta_leads: number;
  // Meta Ads (manual — da semana mais recente com dados)
  meta_connect_rate: number | null;
  meta_lp_conversion: number | null;
  meta_cpl_traffic: number | null;
  // Google Ads (manual)
  google_spend: number | null;
  google_cpm: number | null;
  google_leads: number | null;
  google_connect_rate: number | null;
  google_cpl_traffic: number | null;
  google_lp_conversion: number | null;
}
```

---

## Fora do Escopo (por ora)

- Dados automáticos de Google Ads (integração futura).
- Gráficos de evolução temporal.
- Permissões por projeto (todos os usuários veem todos os projetos).
- Exportação de dados.
