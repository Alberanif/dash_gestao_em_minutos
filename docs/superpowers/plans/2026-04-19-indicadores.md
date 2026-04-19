# Indicadores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o módulo "Indicadores" — uma central de projetos retroativos com KPIs de Meta Ads (automáticos) e Google Ads + métricas de LP (manuais, por semana) — acessível via tela de seleção pós-login.

**Architecture:** A página raiz `/` passa a ser a tela de seleção; "Gestão à Vista" direciona ao `/dashboard` existente e "Indicadores" a uma nova área em `/indicadores/` com layout próprio. Projetos são armazenados em duas tabelas Supabase novas; métricas automáticas de Meta Ads são agregadas via ILIKE nos `campaign_terms` do projeto; todos os dados de Google Ads e métricas de LP são inseridos manualmente pelo usuário semana a semana.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + Auth), TypeScript, CSS variables (design system existente).

---

## File Map

| Ação | Arquivo |
|---|---|
| Criar | `src/types/indicadores.ts` |
| Criar | `src/app/api/indicadores/projects/route.ts` |
| Criar | `src/app/api/indicadores/projects/[id]/route.ts` |
| Criar | `src/app/api/indicadores/projects/[id]/weekly/route.ts` |
| Criar | `src/app/api/indicadores/projects/[id]/metrics/route.ts` |
| Modificar | `src/app/page.tsx` |
| Criar | `src/app/indicadores/layout.tsx` |
| Criar | `src/components/indicadores/project-card.tsx` |
| Criar | `src/components/indicadores/project-form-modal.tsx` |
| Criar | `src/app/indicadores/page.tsx` |
| Criar | `src/components/indicadores/weekly-data-modal.tsx` |
| Criar | `src/app/indicadores/[id]/page.tsx` |

---

## Task 1: TypeScript types + DB migration

**Files:**
- Create: `src/types/indicadores.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

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
  meta_spend: number;
  meta_cpm: number;
  meta_ctr: number;
  meta_leads: number;
  meta_connect_rate: number | null;
  meta_lp_conversion: number | null;
  meta_cpl_traffic: number | null;
  google_spend: number | null;
  google_cpm: number | null;
  google_leads: number | null;
  google_connect_rate: number | null;
  google_cpl_traffic: number | null;
  google_lp_conversion: number | null;
}
```

- [ ] **Step 2: Criar as tabelas no Supabase**

Acesse o Supabase Dashboard → SQL Editor e execute:

```sql
-- Tabela de projetos
CREATE TABLE IF NOT EXISTS dash_gestao_indicadores_projects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  hotmart_product_id text NOT NULL,
  campaign_terms     text[] NOT NULL DEFAULT '{}',
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- Tabela de dados semanais manuais
CREATE TABLE IF NOT EXISTS dash_gestao_indicadores_weekly_data (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           uuid NOT NULL REFERENCES dash_gestao_indicadores_projects(id) ON DELETE CASCADE,
  week_start           date NOT NULL,
  week_end             date NOT NULL,
  meta_connect_rate    numeric,
  meta_lp_conversion   numeric,
  meta_cpl_traffic     numeric,
  google_spend         numeric,
  google_cpm           numeric,
  google_leads         numeric,
  google_connect_rate  numeric,
  google_cpl_traffic   numeric,
  google_lp_conversion numeric,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE(project_id, week_start)
);
```

- [ ] **Step 3: Commit**

```bash
git add src/types/indicadores.ts
git commit -m "feat(indicadores): add TypeScript types and DB migration"
```

---

## Task 2: API — Projects CRUD

**Files:**
- Create: `src/app/api/indicadores/projects/route.ts`
- Create: `src/app/api/indicadores/projects/[id]/route.ts`

- [ ] **Step 1: Criar rota de listagem e criação**

```ts
// src/app/api/indicadores/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { name, hotmart_product_id, campaign_terms } = body;

  if (!name?.trim() || !hotmart_product_id?.trim()) {
    return NextResponse.json(
      { error: "name e hotmart_product_id são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .insert({
      name: name.trim(),
      hotmart_product_id: hotmart_product_id.trim(),
      campaign_terms: Array.isArray(campaign_terms) ? campaign_terms : [],
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Criar rota de edição e exclusão**

```ts
// src/app/api/indicadores/projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { name, hotmart_product_id, campaign_terms } = body;

  if (!name?.trim() || !hotmart_product_id?.trim()) {
    return NextResponse.json(
      { error: "name e hotmart_product_id são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .update({
      name: name.trim(),
      hotmart_product_id: hotmart_product_id.trim(),
      campaign_terms: Array.isArray(campaign_terms) ? campaign_terms : [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const { error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .delete()
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Verificar rotas no navegador**

Acesse `http://localhost:3000/api/indicadores/projects` — deve retornar `[]` (array vazio sem erro).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/indicadores/projects/route.ts src/app/api/indicadores/projects/[id]/route.ts
git commit -m "feat(indicadores): add projects CRUD API routes"
```

---

## Task 3: API — Weekly data

**Files:**
- Create: `src/app/api/indicadores/projects/[id]/weekly/route.ts`

- [ ] **Step 1: Criar rota de dados semanais**

```ts
// src/app/api/indicadores/projects/[id]/weekly/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("dash_gestao_indicadores_weekly_data")
    .select("*")
    .eq("project_id", id)
    .order("week_start", { ascending: true });

  if (start_date) query = query.gte("week_start", start_date);
  if (end_date) query = query.lte("week_start", end_date);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id: project_id } = await params;
  const body = await request.json();
  const {
    week_start, week_end,
    meta_connect_rate, meta_lp_conversion, meta_cpl_traffic,
    google_spend, google_cpm, google_leads,
    google_connect_rate, google_cpl_traffic, google_lp_conversion,
  } = body;

  if (!week_start || !week_end) {
    return NextResponse.json({ error: "week_start e week_end são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_weekly_data")
    .upsert(
      {
        project_id,
        week_start,
        week_end,
        meta_connect_rate: meta_connect_rate ?? null,
        meta_lp_conversion: meta_lp_conversion ?? null,
        meta_cpl_traffic: meta_cpl_traffic ?? null,
        google_spend: google_spend ?? null,
        google_cpm: google_cpm ?? null,
        google_leads: google_leads ?? null,
        google_connect_rate: google_connect_rate ?? null,
        google_cpl_traffic: google_cpl_traffic ?? null,
        google_lp_conversion: google_lp_conversion ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,week_start" }
    )
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/indicadores/projects/[id]/weekly/route.ts
git commit -m "feat(indicadores): add weekly data API route"
```

---

## Task 4: API — Metrics

**Files:**
- Create: `src/app/api/indicadores/projects/[id]/metrics/route.ts`

- [ ] **Step 1: Criar rota de métricas agregadas**

```ts
// src/app/api/indicadores/projects/[id]/metrics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { IndicadoresMetrics } from "@/types/indicadores";

function avgField(rows: Record<string, unknown>[], field: string): number | null {
  const vals = rows
    .map((r) => r[field])
    .filter((v): v is number => v !== null && v !== undefined && typeof v === "number");
  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date e end_date são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Buscar projeto para obter campaign_terms
  const { data: project, error: projectError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .select("campaign_terms")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const terms: string[] = project.campaign_terms ?? [];

  // Buscar campanhas Meta Ads via ILIKE nos campaign_terms
  let campaignQuery = supabase
    .from("dash_gestao_meta_ads_campaigns")
    .select("spend, impressions, clicks, ctr, cpm, conversions")
    .gte("collected_date", start_date)
    .lte("collected_date", end_date);

  if (terms.length > 0) {
    const ilikeFilter = terms.map((t) => `campaign_name.ilike.%${t}%`).join(",");
    campaignQuery = campaignQuery.or(ilikeFilter);
  } else {
    // Sem termos: sem dados automáticos
    campaignQuery = campaignQuery.eq("campaign_id", "NO_MATCH");
  }

  // Buscar dados semanais manuais do período
  const [campaignsResult, weeklyResult] = await Promise.all([
    campaignQuery,
    supabase
      .from("dash_gestao_indicadores_weekly_data")
      .select("*")
      .eq("project_id", id)
      .gte("week_start", start_date)
      .lte("week_start", end_date),
  ]);

  if (campaignsResult.error) {
    return NextResponse.json({ error: campaignsResult.error.message }, { status: 500 });
  }
  if (weeklyResult.error) {
    return NextResponse.json({ error: weeklyResult.error.message }, { status: 500 });
  }

  const campaigns = campaignsResult.data ?? [];
  const weekly = (weeklyResult.data ?? []) as Record<string, unknown>[];

  // Agrega Meta Ads automáticos
  const meta_spend = campaigns.reduce((s, r) => s + (r.spend ?? 0), 0);
  const totalImpressions = campaigns.reduce((s, r) => s + ((r.impressions as number) ?? 0), 0);
  const totalClicks = campaigns.reduce((s, r) => s + ((r.clicks as number) ?? 0), 0);
  const meta_leads = campaigns.reduce((s, r) => s + ((r.conversions as number) ?? 0), 0);
  const meta_cpm = totalImpressions > 0 ? (meta_spend / totalImpressions) * 1000 : 0;
  const meta_ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const metrics: IndicadoresMetrics = {
    meta_spend,
    meta_cpm,
    meta_ctr,
    meta_leads,
    meta_connect_rate: avgField(weekly, "meta_connect_rate"),
    meta_lp_conversion: avgField(weekly, "meta_lp_conversion"),
    meta_cpl_traffic: avgField(weekly, "meta_cpl_traffic"),
    google_spend: avgField(weekly, "google_spend"),
    google_cpm: avgField(weekly, "google_cpm"),
    google_leads: avgField(weekly, "google_leads"),
    google_connect_rate: avgField(weekly, "google_connect_rate"),
    google_cpl_traffic: avgField(weekly, "google_cpl_traffic"),
    google_lp_conversion: avgField(weekly, "google_lp_conversion"),
  };

  return NextResponse.json(metrics);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/indicadores/projects/[id]/metrics/route.ts
git commit -m "feat(indicadores): add metrics aggregation API route"
```

---

## Task 5: Tela de seleção

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Substituir redirect por tela de seleção**

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SelectionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        gap: 16,
        padding: 24,
      }}
    >
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          marginBottom: 8,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Selecione o módulo
      </p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {/* Gestão à Vista */}
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 200,
            height: 140,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-card)",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-text)",
            textDecoration: "none",
            transition: "box-shadow 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          }}
        >
          Gestão à Vista
        </Link>

        {/* Indicadores */}
        <Link
          href="/indicadores"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 200,
            height: 140,
            borderRadius: "var(--radius-card)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            boxShadow: "var(--shadow-card)",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-text)",
            textDecoration: "none",
            transition: "box-shadow 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
          }}
        >
          Indicadores
        </Link>
      </div>
    </main>
  );
}
```

> **Nota:** `onMouseEnter`/`onMouseLeave` em Server Components são ignorados pelo servidor mas funcionam no cliente (hidratação). Como este componente não tem "use client", use uma abordagem CSS se preferir. Alternativa: extraia os cards para um `SelectionCards` client component.

- [ ] **Step 2: Extrair cards para client component (evitar aviso do Next.js)**

Crie `src/components/layout/selection-cards.tsx`:

```tsx
// src/components/layout/selection-cards.tsx
"use client";

import Link from "next/link";

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 200,
  height: 140,
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  boxShadow: "var(--shadow-card)",
  fontSize: 16,
  fontWeight: 700,
  color: "var(--color-text)",
  textDecoration: "none",
  transition: "box-shadow 0.15s, border-color 0.15s",
  cursor: "pointer",
};

export function SelectionCards() {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
      <Link
        href="/dashboard"
        style={cardStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        }}
      >
        Gestão à Vista
      </Link>

      <Link
        href="/indicadores"
        style={cardStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        }}
      >
        Indicadores
      </Link>
    </div>
  );
}
```

Atualize `src/app/page.tsx` para usar o componente:

```tsx
// src/app/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SelectionCards } from "@/components/layout/selection-cards";

export default async function SelectionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        gap: 16,
        padding: 24,
      }}
    >
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          marginBottom: 8,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Selecione o módulo
      </p>
      <SelectionCards />
    </main>
  );
}
```

- [ ] **Step 3: Verificar no navegador**

Acesse `http://localhost:3000` autenticado. Deve exibir os dois cards. Clique em "Gestão à Vista" → vai para `/dashboard`. Clique em "Indicadores" → vai para `/indicadores` (404 por enquanto — ok).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/layout/selection-cards.tsx
git commit -m "feat(indicadores): replace root redirect with module selection screen"
```

---

## Task 6: Layout do módulo Indicadores

**Files:**
- Create: `src/app/indicadores/layout.tsx`

- [ ] **Step 1: Criar o layout**

```tsx
// src/app/indicadores/layout.tsx
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Indicadores — IGT",
};

export default async function IndicadoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Barra superior */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          height: 56,
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.01em",
          }}
        >
          Indicadores
        </span>

        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-muted)",
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            transition: "color 0.15s",
          }}
        >
          ← Trocar módulo
        </Link>
      </header>

      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Verificar no navegador**

Acesse `http://localhost:3000/indicadores`. Deve exibir o header com "Indicadores" e o botão "← Trocar módulo". Conteúdo vazio (404 → agora deve mostrar o layout com main vazio).

- [ ] **Step 3: Commit**

```bash
git add src/app/indicadores/layout.tsx
git commit -m "feat(indicadores): add Indicadores section layout with header"
```

---

## Task 7: Componentes — ProjectCard e ProjectFormModal

**Files:**
- Create: `src/components/indicadores/project-card.tsx`
- Create: `src/components/indicadores/project-form-modal.tsx`

- [ ] **Step 1: Criar ProjectCard**

```tsx
// src/components/indicadores/project-card.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import type { IndicadoresProject } from "@/types/indicadores";

interface ProjectCardProps {
  project: IndicadoresProject;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onClick, onEdit, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "20px 16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        position: "relative",
        minHeight: 100,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)")
      }
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {project.name}
        </p>

        {/* Menu ⋯ */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              color: "var(--color-text-muted)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-md)",
                zIndex: 20,
                minWidth: 120,
                overflow: "hidden",
              }}
            >
              {(["Editar", "Excluir"] as const).map((label) => (
                <button
                  key={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    label === "Editar" ? onEdit() : onDelete();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 14px",
                    fontSize: 13,
                    color: label === "Excluir" ? "var(--color-danger)" : "var(--color-text)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "var(--color-bg)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "none")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {project.campaign_terms.length > 0 && (
        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            marginTop: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.campaign_terms.join(", ")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar ProjectFormModal**

```tsx
// src/components/indicadores/project-form-modal.tsx
"use client";

import { useState, useEffect } from "react";
import type { IndicadoresProject } from "@/types/indicadores";

interface ProjectFormData {
  name: string;
  hotmart_product_id: string;
  campaign_terms: string[];
}

interface ProjectFormModalProps {
  project?: IndicadoresProject;
  open: boolean;
  onClose: () => void;
  onSave: (data: ProjectFormData) => Promise<void>;
}

const EMPTY: ProjectFormData = { name: "", hotmart_product_id: "", campaign_terms: [] };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export function ProjectFormModal({ project, open, onClose, onSave }: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectFormData>(EMPTY);
  const [termInput, setTermInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        project
          ? { name: project.name, hotmart_product_id: project.hotmart_product_id, campaign_terms: project.campaign_terms }
          : EMPTY
      );
      setTermInput("");
      setError("");
    }
  }, [open, project]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function addTerm() {
    const t = termInput.trim();
    if (!t || form.campaign_terms.includes(t)) return;
    setForm((p) => ({ ...p, campaign_terms: [...p.campaign_terms, t] }));
    setTermInput("");
  }

  function removeTerm(term: string) {
    setForm((p) => ({ ...p, campaign_terms: p.campaign_terms.filter((t) => t !== term) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Nome é obrigatório"); return; }
    if (!form.hotmart_product_id.trim()) { setError("ID/Nome do produto Hotmart é obrigatório"); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 480,
          padding: 24,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          type="button"
          style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-muted)", fontSize: 20, lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>

        <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--color-text)", marginBottom: 20, paddingRight: 32 }}>
          {project ? "Editar Projeto" : "Novo Projeto"}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Nome do projeto</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: Destrave, Perpétuo, MH"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>ID / Nome do produto Hotmart</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: 123456 ou Nome do Produto"
              value={form.hotmart_product_id}
              onChange={(e) => setForm((p) => ({ ...p, hotmart_product_id: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Termos de campanha (Meta Ads)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="text"
                placeholder="Termo para buscar campanhas..."
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTerm(); } }}
              />
              <button
                type="button"
                onClick={addTerm}
                disabled={!termInput.trim()}
                style={{
                  padding: "8px 14px", fontSize: 16, fontWeight: 700,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-primary)",
                  background: termInput.trim() ? "var(--color-primary)" : "var(--color-border)",
                  color: termInput.trim() ? "#fff" : "var(--color-text-muted)",
                  cursor: termInput.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
            {form.campaign_terms.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.campaign_terms.map((term) => (
                  <span
                    key={term}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "3px 10px", fontSize: 12, fontWeight: 600,
                      borderRadius: 99,
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                    }}
                  >
                    {term}
                    <button
                      type="button"
                      onClick={() => removeTerm(term)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--color-primary)", fontSize: 14, lineHeight: 1, padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px", fontSize: 13,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600,
                borderRadius: "var(--radius-sm)", border: "none",
                background: saving ? "var(--color-border)" : "var(--color-primary)",
                color: saving ? "var(--color-text-muted)" : "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Salvando..." : project ? "Salvar alterações" : "Criar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/indicadores/project-card.tsx src/components/indicadores/project-form-modal.tsx
git commit -m "feat(indicadores): add ProjectCard and ProjectFormModal components"
```

---

## Task 8: Página de listagem de projetos

**Files:**
- Create: `src/app/indicadores/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
// src/app/indicadores/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ProjectCard } from "@/components/indicadores/project-card";
import { ProjectFormModal } from "@/components/indicadores/project-form-modal";
import type { IndicadoresProject } from "@/types/indicadores";

export default function IndicadoresPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<IndicadoresProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IndicadoresProject | undefined>(undefined);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/indicadores/projects");
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleSave(formData: { name: string; hotmart_product_id: string; campaign_terms: string[] }) {
    const method = editing ? "PUT" : "POST";
    const url = editing
      ? `/api/indicadores/projects/${editing.id}`
      : "/api/indicadores/projects";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erro ao salvar");
    }
    await loadProjects();
  }

  async function handleDelete(project: IndicadoresProject) {
    if (!confirm(`Excluir o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/indicadores/projects/${project.id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== project.id));
  }

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(project: IndicadoresProject) {
    setEditing(project);
    setFormOpen(true);
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)" }}>
          Projetos
        </h1>
        <button
          onClick={openCreate}
          style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 600,
            borderRadius: "var(--radius-sm)", border: "none",
            background: "var(--color-primary)", color: "#fff", cursor: "pointer",
          }}
        >
          + Novo Projeto
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 100, borderRadius: "var(--radius-card)",
                background: "var(--color-surface)", border: "1px solid var(--color-border)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--color-border)",
            borderRadius: "var(--radius-card)",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Nenhum projeto criado ainda
          </p>
          <button
            onClick={openCreate}
            style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 600,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-primary)",
              background: "var(--color-primary-light)",
              color: "var(--color-primary)", cursor: "pointer",
            }}
          >
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => router.push(`/indicadores/${project.id}`)}
              onEdit={() => openEdit(project)}
              onDelete={() => handleDelete(project)}
            />
          ))}
        </div>
      )}

      <ProjectFormModal
        project={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar no navegador**

Acesse `http://localhost:3000/indicadores`. Deve exibir "Nenhum projeto criado ainda". Clique em "+ Novo Projeto", preencha o form e salve. O card deve aparecer no grid.

- [ ] **Step 3: Commit**

```bash
git add src/app/indicadores/page.tsx
git commit -m "feat(indicadores): add projects list page"
```

---

## Task 9: Componente WeeklyDataModal

**Files:**
- Create: `src/components/indicadores/weekly-data-modal.tsx`

- [ ] **Step 1: Criar o modal**

```tsx
// src/components/indicadores/weekly-data-modal.tsx
"use client";

import { useState, useEffect } from "react";
import type { IndicadoresWeeklyData } from "@/types/indicadores";

interface WeeklyDataModalProps {
  projectId: string;
  weekStart: string;
  weekEnd: string;
  existing: IndicadoresWeeklyData | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: IndicadoresWeeklyData) => void;
}

type FormFields = {
  meta_connect_rate: string;
  meta_lp_conversion: string;
  meta_cpl_traffic: string;
  google_spend: string;
  google_cpm: string;
  google_leads: string;
  google_connect_rate: string;
  google_cpl_traffic: string;
  google_lp_conversion: string;
};

const EMPTY_FORM: FormFields = {
  meta_connect_rate: "",
  meta_lp_conversion: "",
  meta_cpl_traffic: "",
  google_spend: "",
  google_cpm: "",
  google_leads: "",
  google_connect_rate: "",
  google_cpl_traffic: "",
  google_lp_conversion: "",
};

function toStr(v: number | null | undefined): string {
  return v !== null && v !== undefined ? String(v) : "";
}

function toNum(s: string): number | null {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

function formatWeek(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-");
  const [, em, ed] = end.split("-");
  return `${sd}/${sm}/${sy} a ${ed}/${em}`;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--color-text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "var(--color-text)",
  marginBottom: 12,
  marginTop: 4,
};

export function WeeklyDataModal({
  projectId,
  weekStart,
  weekEnd,
  existing,
  open,
  onClose,
  onSave,
}: WeeklyDataModalProps) {
  const [form, setForm] = useState<FormFields>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        existing
          ? {
              meta_connect_rate: toStr(existing.meta_connect_rate),
              meta_lp_conversion: toStr(existing.meta_lp_conversion),
              meta_cpl_traffic: toStr(existing.meta_cpl_traffic),
              google_spend: toStr(existing.google_spend),
              google_cpm: toStr(existing.google_cpm),
              google_leads: toStr(existing.google_leads),
              google_connect_rate: toStr(existing.google_connect_rate),
              google_cpl_traffic: toStr(existing.google_cpl_traffic),
              google_lp_conversion: toStr(existing.google_lp_conversion),
            }
          : EMPTY_FORM
      );
      setError("");
    }
  }, [open, existing]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function field(key: keyof FormFields, label: string) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input
          style={inputStyle}
          type="text"
          inputMode="decimal"
          placeholder="—"
          value={form[key]}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        week_start: weekStart,
        week_end: weekEnd,
        meta_connect_rate: toNum(form.meta_connect_rate),
        meta_lp_conversion: toNum(form.meta_lp_conversion),
        meta_cpl_traffic: toNum(form.meta_cpl_traffic),
        google_spend: toNum(form.google_spend),
        google_cpm: toNum(form.google_cpm),
        google_leads: toNum(form.google_leads),
        google_connect_rate: toNum(form.google_connect_rate),
        google_cpl_traffic: toNum(form.google_cpl_traffic),
        google_lp_conversion: toNum(form.google_lp_conversion),
      };
      const res = await fetch(`/api/indicadores/projects/${projectId}/weekly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Erro ao salvar");
      }
      const saved = await res.json();
      onSave(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%", maxWidth: 520,
          padding: 24, position: "relative",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          type="button"
          style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-muted)", fontSize: 20, lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginBottom: 4, paddingRight: 32 }}>
          Dados da semana
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
          {formatWeek(weekStart, weekEnd)}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Meta Ads manual */}
          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
            }}
          >
            <p style={sectionTitleStyle}>Meta Ads — campos manuais</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {field("meta_connect_rate", "Connect Rate (%)")}
              {field("meta_lp_conversion", "Conversão LP (%)")}
              {field("meta_cpl_traffic", "CPL Tráfego (R$)")}
            </div>
          </div>

          {/* Google Ads */}
          <div
            style={{
              padding: 16,
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg)",
            }}
          >
            <p style={sectionTitleStyle}>Google Ads</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {field("google_spend", "Investimento (R$)")}
              {field("google_cpm", "CPM (R$)")}
              {field("google_leads", "Leads")}
              {field("google_connect_rate", "Connect Rate (%)")}
              {field("google_cpl_traffic", "CPL Tráfego (R$)")}
              {field("google_lp_conversion", "Conversão LP (%)")}
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px", fontSize: 13,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600,
                borderRadius: "var(--radius-sm)", border: "none",
                background: saving ? "var(--color-border)" : "var(--color-primary)",
                color: saving ? "var(--color-text-muted)" : "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/indicadores/weekly-data-modal.tsx
git commit -m "feat(indicadores): add WeeklyDataModal component"
```

---

## Task 10: Página de detalhe do projeto

**Files:**
- Create: `src/app/indicadores/[id]/page.tsx`

- [ ] **Step 1: Criar utilitário de semanas (inline na página)**

A função `buildWeeks(start, end)` divide um intervalo em chunks de 7 dias a partir de `start`:

```ts
function buildWeeks(start: string, end: string): { weekStart: string; weekEnd: string }[] {
  const weeks: { weekStart: string; weekEnd: string }[] = [];
  const endDate = new Date(end);
  let current = new Date(start);
  while (current <= endDate) {
    const weekStart = current.toISOString().slice(0, 10);
    const weekEndDate = new Date(current);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = (weekEndDate > endDate ? endDate : weekEndDate).toISOString().slice(0, 10);
    weeks.push({ weekStart, weekEnd });
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}
```

- [ ] **Step 2: Criar a página de detalhe**

```tsx
// src/app/indicadores/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { WeeklyDataModal } from "@/components/indicadores/weekly-data-modal";
import type { IndicadoresProject, IndicadoresWeeklyData, IndicadoresMetrics } from "@/types/indicadores";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function buildWeeks(start: string, end: string): { weekStart: string; weekEnd: string }[] {
  const weeks: { weekStart: string; weekEnd: string }[] = [];
  const endDate = new Date(end);
  let current = new Date(start);
  while (current <= endDate) {
    const weekStart = current.toISOString().slice(0, 10);
    const weekEndDate = new Date(current);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = (weekEndDate > endDate ? endDate : weekEndDate)
      .toISOString()
      .slice(0, 10);
    weeks.push({ weekStart, weekEnd });
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtBRL(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(2)}%`;
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 13,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  outline: "none",
};

function KpiBox({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </p>
      <p style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)", lineHeight: 1.1 }}>
        {value}
      </p>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<IndicadoresProject | null>(null);
  const [startDate, setStartDate] = useState(daysAgo(28));
  const [endDate, setEndDate] = useState(today());
  const [metrics, setMetrics] = useState<IndicadoresMetrics | null>(null);
  const [weeklyData, setWeeklyData] = useState<IndicadoresWeeklyData[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Weekly modal state
  const [weeklyModal, setWeeklyModal] = useState<{
    weekStart: string;
    weekEnd: string;
    existing: IndicadoresWeeklyData | null;
  } | null>(null);

  // Load project
  useEffect(() => {
    fetch(`/api/indicadores/projects`)
      .then((r) => r.json())
      .then((data: IndicadoresProject[]) => {
        const found = data.find((p) => p.id === id) ?? null;
        setProject(found);
      })
      .catch(() => setProject(null));
  }, [id]);

  const loadData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoadingMetrics(true);
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const [metricsRes, weeklyRes] = await Promise.all([
      fetch(`/api/indicadores/projects/${id}/metrics?${params}`),
      fetch(`/api/indicadores/projects/${id}/weekly?${params}`),
    ]);
    const [metricsData, weeklyRaw] = await Promise.all([metricsRes.json(), weeklyRes.json()]);
    setMetrics(metricsData.error ? null : metricsData);
    setWeeklyData(Array.isArray(weeklyRaw) ? weeklyRaw : []);
    setLoadingMetrics(false);
  }, [id, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleWeeklySave(saved: IndicadoresWeeklyData) {
    setWeeklyData((prev) => {
      const idx = prev.findIndex((w) => w.week_start === saved.week_start);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved].sort((a, b) => a.week_start.localeCompare(b.week_start));
    });
  }

  const weeks = buildWeeks(startDate, endDate);

  const sectionBoxStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-card)",
    padding: 20,
    marginBottom: 20,
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
          {project?.name ?? "Carregando..."}
        </h1>
        {project?.campaign_terms && project.campaign_terms.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Termos: {project.campaign_terms.join(", ")}
          </p>
        )}
      </div>

      {/* Date range picker */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 500 }}>Período:</span>
        <input
          type="date"
          style={inputStyle}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>até</span>
        <input
          type="date"
          style={inputStyle}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        {loadingMetrics && (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Carregando...</span>
        )}
      </div>

      {/* Meta Ads KPIs */}
      <div style={sectionBoxStyle}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          Meta Ads
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <KpiBox title="Investimento Total" value={fmtBRL(metrics?.meta_spend)} />
          <KpiBox title="CPM" value={fmtBRL(metrics?.meta_cpm)} />
          <KpiBox title="CTR" value={fmtPct(metrics?.meta_ctr)} />
          <KpiBox title="Connect Rate" value={fmtPct(metrics?.meta_connect_rate)} />
          <KpiBox title="CPL Tráfego" value={fmtBRL(metrics?.meta_cpl_traffic)} />
          <KpiBox title="Taxa Conversão LP" value={fmtPct(metrics?.meta_lp_conversion)} />
        </div>
      </div>

      {/* Google Ads KPIs */}
      <div style={sectionBoxStyle}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          Google Ads
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          <KpiBox title="Investimento Total" value={fmtBRL(metrics?.google_spend)} />
          <KpiBox title="CPM" value={fmtBRL(metrics?.google_cpm)} />
          <KpiBox title="Leads Total" value={fmtNum(metrics?.google_leads)} />
          <KpiBox title="Connect Rate" value={fmtPct(metrics?.google_connect_rate)} />
          <KpiBox title="CPL Tráfego" value={fmtBRL(metrics?.google_cpl_traffic)} />
          <KpiBox title="Taxa Conversão LP" value={fmtPct(metrics?.google_lp_conversion)} />
        </div>
      </div>

      {/* Planilha semanal */}
      <div style={sectionBoxStyle}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", marginBottom: 16 }}>
          Planilha de Indicadores Semanais
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {[
                  "Semana",
                  "Invest. Meta",
                  "CPM Meta",
                  "CTR Meta",
                  "Leads Meta",
                  "Connect Rate",
                  "Conversão LP",
                  "CPL Tráfego",
                  "Invest. Google",
                  "Leads Google",
                  "",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid var(--color-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map(({ weekStart, weekEnd }) => {
                const wd = weeklyData.find((w) => w.week_start === weekStart) ?? null;

                // Auto Meta Ads data for this week — would require per-week API; for now show "—" (aggregated only in KPIs)
                // To show per-week auto data, call metrics API per week — expensive. Show "ver KPIs" placeholder for auto cols.
                return (
                  <tr
                    key={weekStart}
                    style={{ borderBottom: "1px solid var(--color-border)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "var(--color-bg)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "transparent")
                    }
                  >
                    <td style={{ padding: "8px 10px", color: "var(--color-text)", whiteSpace: "nowrap", fontWeight: 500 }}>
                      {formatDate(weekStart)} – {formatDate(weekEnd)}
                    </td>
                    {/* Auto Meta Ads columns — fetched per-week lazily */}
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-muted)" }}>—</td>
                    {/* Manual fields */}
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtPct(wd?.meta_connect_rate)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtPct(wd?.meta_lp_conversion)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtBRL(wd?.meta_cpl_traffic)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtBRL(wd?.google_spend)}</td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>{fmtNum(wd?.google_leads)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <button
                        onClick={() =>
                          setWeeklyModal({ weekStart, weekEnd, existing: wd })
                        }
                        style={{
                          background: "none",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "4px 10px",
                          fontSize: 12,
                          color: "var(--color-primary)",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {wd ? "Editar" : "Inserir"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly data modal */}
      {weeklyModal && (
        <WeeklyDataModal
          projectId={id}
          weekStart={weeklyModal.weekStart}
          weekEnd={weeklyModal.weekEnd}
          existing={weeklyModal.existing}
          open={!!weeklyModal}
          onClose={() => setWeeklyModal(null)}
          onSave={handleWeeklySave}
        />
      )}
    </div>
  );
}
```

> **Nota sobre colunas automáticas na tabela:** As colunas "Invest. Meta", "CPM Meta", "CTR Meta", "Leads Meta" da tabela mostram "—" porque buscar dados por semana requereria N chamadas à API (uma por semana). Os valores totais do período aparecem nos KPI cards acima. Se futuramente for necessário mostrar por semana, criar um endpoint `/api/indicadores/projects/[id]/weekly-auto` que agrega os dados de campanha por semana.

- [ ] **Step 3: Verificar no navegador**

1. Clique num projeto na lista → abre a página de detalhe.
2. O header exibe o nome do projeto.
3. KPI cards de Meta Ads mostram valores (ou "—" se sem dados no período).
4. KPI cards de Google Ads mostram "—" (sem dados manuais ainda).
5. Tabela mostra uma linha por semana do período selecionado.
6. Clique em "Inserir" numa linha → abre o WeeklyDataModal.
7. Preencha os campos e salve → a linha da tabela atualiza com os dados inseridos.
8. Os KPI cards de Google Ads atualizam ao mudar o período após salvar dados.

- [ ] **Step 4: Commit**

```bash
git add src/app/indicadores/[id]/page.tsx
git commit -m "feat(indicadores): add project detail page with KPIs and weekly table"
```

---

## Task 11: Verificação final e ajustes

- [ ] **Step 1: Testar o fluxo completo**

1. Acessar `http://localhost:3000` sem estar autenticado → redireciona para `/login`.
2. Fazer login → cai na tela de seleção com dois cards.
3. Clicar "Gestão à Vista" → abre o dashboard atual normalmente.
4. Voltar para `/` e clicar "Indicadores" → abre `/indicadores`.
5. Criar um projeto com nome, ID Hotmart e termos de campanha.
6. O card do projeto aparece no grid.
7. Clicar no card → abre página de detalhe.
8. Alterar o período → KPIs de Meta Ads atualizam.
9. Na tabela, clicar "Inserir" numa semana, preencher dados de Google Ads e métricas LP.
10. Salvar → linha atualiza; KPIs de Google Ads atualizam.
11. Clicar "← Trocar módulo" → volta para tela de seleção.

- [ ] **Step 2: Verificar que o dashboard atual não foi afetado**

Acesse `/dashboard`, `/dashboard/eqa`, `/dashboard/meta-ads` e confirme que funcionam normalmente.

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat(indicadores): complete Indicadores module implementation"
```
