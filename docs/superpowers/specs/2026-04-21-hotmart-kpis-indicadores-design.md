# Hotmart KPIs nos Indicadores — Design Spec

**Data:** 2026-04-21  
**Módulo:** `src/app/indicadores/[id]`  
**Status:** Aprovado

## Objetivo

Adicionar KPIs de vendas Hotmart à página de detalhe de cada projeto do módulo Indicadores. O usuário associa uma conta Hotmart e um ou mais produtos ao projeto; a página exibe vendas e receita por produto (BRL apenas, status COMPLETE + APPROVED) no período selecionado, com uma linha de totais agregados.

---

## Banco de Dados

### Migration: `supabase/migrations/012_indicadores_hotmart_fields.sql`

```sql
ALTER TABLE dash_gestao_indicadores_projects
  ADD COLUMN IF NOT EXISTS hotmart_account_id text,
  ADD COLUMN IF NOT EXISTS hotmart_product_ids text[] NOT NULL DEFAULT '{}';
```

O campo legado `hotmart_product_id` (text único) é mantido sem alteração para não quebrar queries existentes, mas não é mais usado pela feature.

---

## Tipos TypeScript

### Atualizar `src/types/indicadores.ts`

Adicionar a `IndicadoresProject`:
```ts
hotmart_account_id: string | null;
hotmart_product_ids: string[];
```

Novos tipos:
```ts
export interface HotmartProductMetrics {
  product_id: string;
  product_name: string;
  sales_count: number;
  revenue: number;
}

export interface HotmartMetrics {
  products: HotmartProductMetrics[];
  total_sales: number;
  total_revenue: number;
  has_non_brl: boolean;
}
```

---

## Arquitetura

### Abordagem escolhida
Endpoint dedicado (Opção A): a lógica Hotmart vive em uma rota própria, chamada em paralelo com `/metrics` na página de detalhe.

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/012_indicadores_hotmart_fields.sql` | **Novo** — adiciona colunas à tabela |
| `src/types/indicadores.ts` | Atualizar `IndicadoresProject`; adicionar `HotmartProductMetrics`, `HotmartMetrics` |
| `src/app/api/indicadores/projects/route.ts` | Incluir `hotmart_account_id` e `hotmart_product_ids` no INSERT |
| `src/app/api/indicadores/projects/[id]/route.ts` | Incluir os novos campos no PUT |
| `src/app/api/indicadores/projects/[id]/hotmart-metrics/route.ts` | **Novo** — retorna KPIs Hotmart |
| `src/components/indicadores/project-form-modal.tsx` | Adicionar seletor de conta e multi-select de produtos |
| `src/app/indicadores/[id]/page.tsx` | Adicionar seção Hotmart na aba Visão Geral |

---

## Nova Rota de API

### `GET /api/indicadores/projects/[id]/hotmart-metrics`

**Query params:** `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD) — ambos obrigatórios.

**Lógica:**
1. Busca o projeto para obter `hotmart_product_ids`
2. Se `hotmart_product_ids` for vazio, retorna `{ products: [], total_sales: 0, total_revenue: 0, has_non_brl: false }`
3. Consulta `dash_gestao_hotmart_sales`:
   - `product_id IN (hotmart_product_ids)`
   - `status IN ('COMPLETE', 'APPROVED')`
   - `currency = 'BRL'`
   - `purchase_date >= start_date AND purchase_date <= end_date + 'T23:59:59'`
4. Consulta separada para detectar vendas não-BRL (mesmo produto, mesma data, status aprovado, currency != 'BRL') — apenas para setar `has_non_brl`
5. Agrupa resultados por `(product_id, product_name)`: soma `price` → `revenue`, conta linhas → `sales_count`
6. Calcula `total_sales` e `total_revenue` somando todos os produtos
7. Retorna `HotmartMetrics`

**Resposta de erro:** `{ error: "..." }` com status 404 se projeto não encontrado, 400 se datas ausentes, 500 em erro de DB.

---

## Formulário de Projeto

### Alterações em `project-form-modal.tsx`

Nova seção "Hotmart" após os campos existentes, com dois campos sequenciais:

**1. Seletor de conta Hotmart**
- Dropdown populado via `GET /api/accounts?platform=hotmart`
- Exibe `account.name`; valor interno é `account.id`
- Campo opcional — sem conta selecionada, os campos de produtos ficam desabilitados
- Ao trocar a conta, limpa os produtos selecionados

**2. Multi-select de produtos**
- Habilitado apenas quando uma conta está selecionada
- Input de texto com debounce de 300ms: ao digitar 2+ caracteres, busca `GET /api/hotmart/products?account_id={id}` e filtra client-side por `product_name` ou `product_id` contendo o termo
- Dropdown de resultados abaixo do input (máx. 8 itens visíveis com scroll)
- Ao selecionar, o produto aparece como tag removível abaixo do input (mesmo padrão visual de `campaign_terms`)
- Sem limite de produtos por projeto
- O `account_id` e os `product_ids` são enviados no payload do POST/PUT

**Payload do formulário atualizado:**
```ts
{
  name: string;
  hotmart_account_id: string | null;
  hotmart_product_ids: string[];
  campaign_terms: string[];
  organic_lead_events: string[];
}
```

---

## UI — Seção Hotmart na Visão Geral

### Localização
Nova seção após "Leads Orgânicos" na aba "Visão Geral" de `src/app/indicadores/[id]/page.tsx`.

### Comportamento de fetch
Chamada em paralelo com o `/metrics` existente:
```ts
const [metricsRes, hotmartRes] = await Promise.all([
  fetch(`/api/indicadores/projects/${id}/metrics?${params}`),
  fetch(`/api/indicadores/projects/${id}/hotmart-metrics?${params}`),
]);
```

Estado: `hotmartMetrics: HotmartMetrics | null` e `loadingHotmart: boolean`.

### Casos de exibição

**Sem produtos configurados:**
```
Hotmart
  Nenhum produto Hotmart configurado.
  [Editar projeto para adicionar]
```

**1 produto (sem linha de total):**
```
Hotmart
  Produto Destrave Pro     42 vendas   R$ 8.190,00
```

**2+ produtos (com linha de total):**
```
Hotmart
  Produto Destrave Pro     42 vendas   R$ 8.190,00
  Produto Mentoria VIP     11 vendas   R$ 5.390,00
  ──────────────────────────────────────────────
  Total                    53 vendas   R$ 13.580,00
```

**Nota de moeda** (se `has_non_brl = true`):
```
* Vendas em outras moedas não incluídas.
```

### Estilo visual
- Usa o componente `Section` existente com `accent: "#f97316"` (laranja) e ícone de carrinho (SVG inline)
- Corpo: tabela simples com 3 colunas (`nome`, `vendas`, `receita`)
- Linha de total com `fontWeight: 700` e `borderTop`
- Loading: skeleton de 3 linhas (mesmo padrão do `KpiBox`)
- Erro de fetch: mensagem inline com botão "Tentar novamente"

---

## Edge Cases

- **Projeto sem conta/produtos:** retorna estrutura vazia; UI mostra "Nenhum produto configurado"
- **Produtos sem vendas no período:** `sales_count: 0`, `revenue: 0` — linha exibida normalmente
- **Erro de API Hotmart:** seção exibe estado de erro com retry, não bloqueia o restante da página
- **`has_non_brl = true`:** nota discreta exibida abaixo dos dados
- **Trocar conta no formulário:** limpa array de produtos para evitar IDs de conta errada

---

## Constantes utilizadas

```ts
const HOTMART_STATUS_APPROVED = ["COMPLETE", "APPROVED"];
```
