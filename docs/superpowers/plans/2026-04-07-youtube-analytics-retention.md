# YouTube Analytics — Métricas de Retenção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 4 KPI cards de performance (retenção, engajamento, taxa de comentários, duração média) e atualizar a tabela de vídeos com métricas percentuais calculadas client-side.

**Architecture:** Todos os cálculos são feitos em `youtube/page.tsx` após o fetch de `/api/youtube/videos`. Nenhuma mudança de API, banco ou cron. Os dados de `like_count`, `comment_count`, `view_count` e `duration` já chegam do endpoint existente.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, componentes `KpiCard` e `DataTable` existentes.

---

## Arquivos Modificados

- **Modify:** `src/app/dashboard/youtube/page.tsx` — único arquivo alterado. Adiciona helpers, novos KPI cards, colunas da tabela atualizadas e CSV export atualizado.

---

### Task 1: Adicionar helpers de cálculo de duração e métricas de retenção

**Files:**
- Modify: `src/app/dashboard/youtube/page.tsx` (linhas 14–29, após `parseIsoDuration`)

- [ ] **Step 1: Adicionar `parseIsoDurationToSeconds` e `formatSeconds` logo após a função `parseIsoDuration` existente (linha 25)**

Inserir após a linha `}` que fecha `parseIsoDuration`:

```typescript
function parseIsoDurationToSeconds(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const sec = parseInt(m[3] ?? "0");
  return h * 3600 + min * 60 + sec;
}

function formatSeconds(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Adicionar `calcRetentionMetrics` após os helpers de duração**

```typescript
function calcRetentionMetrics(videos: VideoSnapshot[]) {
  const withViews = videos.filter((v) => v.view_count > 0);
  if (withViews.length === 0) {
    return { retencao: 0, engajamento: 0, taxaComentarios: 0, duracaoMedia: "—" };
  }
  const retencao =
    withViews.reduce((sum, v) => sum + v.like_count / v.view_count, 0) / withViews.length;
  const engajamento =
    withViews.reduce((sum, v) => sum + (v.like_count + v.comment_count) / v.view_count, 0) /
    withViews.length;
  const taxaComentarios =
    withViews.reduce((sum, v) => sum + v.comment_count / v.view_count, 0) / withViews.length;
  const withDuration = videos.filter((v) => v.duration);
  const duracaoMedia =
    withDuration.length > 0
      ? formatSeconds(
          withDuration.reduce((sum, v) => sum + parseIsoDurationToSeconds(v.duration), 0) /
            withDuration.length
        )
      : "—";
  return { retencao, engajamento, taxaComentarios, duracaoMedia };
}
```

- [ ] **Step 3: Adicionar novos ícones SVG após `IconVideo` (linha 80)**

```typescript
const IconThumbUp = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const IconActivity = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const IconMessageSquare = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconClock = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
```

- [ ] **Step 4: Verificar manualmente no browser**

Neste ponto nenhuma UI mudou ainda. Verificar que o TypeScript compila sem erros:
```bash
npx tsc --noEmit
```
Esperado: sem erros relacionados às novas funções.

---

### Task 2: Adicionar segunda linha de KPI cards na aba "Visão Geral"

**Files:**
- Modify: `src/app/dashboard/youtube/page.tsx` (bloco `{selectedSection === "Visão Geral"}`)

- [ ] **Step 1: Chamar `calcRetentionMetrics` logo após a linha `const previous = ...` no componente**

Após `const previous = channelData[channelData.length - 2];` (linha 114), adicionar:

```typescript
const metrics = calcRetentionMetrics(videos);
```

- [ ] **Step 2: Adicionar 4 SkeletonCards no estado de loading**

Localizar o bloco de loading em "Visão Geral" (em torno da linha 175):
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <SkeletonCard /><SkeletonCard /><SkeletonCard />
</div>
```
Substituir por:
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <SkeletonCard /><SkeletonCard /><SkeletonCard />
</div>
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
</div>
```

- [ ] **Step 3: Adicionar segunda linha de KPI cards após a linha `</div>` que fecha os 3 cards de canal**

Localizar o fechamento do primeiro grid de cards (após o card "Vídeos", em torno da linha 213):

```tsx
</div>

{/* KPI Cards — Performance */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <KpiCard
    title="Retenção"
    value={`${(metrics.retencao * 100).toFixed(2)}%`}
    icon={IconThumbUp}
    accentColor="#16A34A"
  />
  <KpiCard
    title="Engajamento Total"
    value={`${(metrics.engajamento * 100).toFixed(2)}%`}
    icon={IconActivity}
    accentColor="#D97706"
  />
  <KpiCard
    title="Coment./Views"
    value={`${(metrics.taxaComentarios * 100).toFixed(2)}%`}
    icon={IconMessageSquare}
    accentColor="#7C3AED"
  />
  <KpiCard
    title="Duração Média"
    value={metrics.duracaoMedia}
    icon={IconClock}
    accentColor="#0EA5E9"
  />
</div>
```

- [ ] **Step 4: Verificar no browser**

Abrir `http://localhost:3000/dashboard/youtube`, selecionar uma conta com vídeos coletados.

Checar:
- Linha 1: 3 cards (Inscritos, Views Totais, Vídeos) — inalterados
- Linha 2: 4 cards (Retenção %, Engajamento Total %, Coment./Views %, Duração Média mm:ss)
- Nenhum card exibe `NaN`, `Infinity` ou `undefined`
- Se não há vídeos coletados: cards de performance exibem `0.00%` e `—`

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/youtube/page.tsx
git commit -m "feat(youtube): add retention and engagement KPI cards"
```

---

### Task 3: Atualizar colunas da tabela de vídeos e CSV export

**Files:**
- Modify: `src/app/dashboard/youtube/page.tsx` (bloco `{selectedSection === "Vídeos"}`)

- [ ] **Step 1: Substituir as colunas da DataTable**

Localizar a prop `columns={[...]}` da `DataTable` (a partir da linha 249) e substituir toda a definição de colunas por:

```tsx
columns={[
  {
    key: "title",
    label: "Título",
    render: (_, row) => (
      <div className="flex items-center gap-3 min-w-[220px]">
        <img
          src={row.thumbnail_url as string}
          alt=""
          className="rounded flex-shrink-0 object-cover"
          style={{ width: 72, height: 40 }}
          loading="lazy"
        />
        <span className="text-sm font-medium line-clamp-2" style={{ color: "var(--color-text)" }}>
          {row.title as string}
        </span>
      </div>
    ),
  },
  {
    key: "view_count",
    label: "Views",
    render: (v) => (
      <span className="text-sm font-medium tabular-nums">{formatCompact(v as number)}</span>
    ),
  },
  {
    key: "like_count",
    label: "Retenção",
    render: (_, row) => {
      const views = row.view_count as number;
      const likes = row.like_count as number;
      if (!views) return <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>;
      return (
        <span className="text-sm tabular-nums font-medium" style={{ color: "var(--color-text)" }}>
          {((likes / views) * 100).toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: "comment_count",
    label: "Engajamento",
    render: (_, row) => {
      const views = row.view_count as number;
      const likes = row.like_count as number;
      const comments = row.comment_count as number;
      if (!views) return <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>;
      return (
        <span className="text-sm tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {(((likes + comments) / views) * 100).toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: "thumbnail_url",
    label: "Coment./Views",
    render: (_, row) => {
      const views = row.view_count as number;
      const comments = row.comment_count as number;
      if (!views) return <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>;
      return (
        <span className="text-sm tabular-nums" style={{ color: "var(--color-text-muted)" }}>
          {((comments / views) * 100).toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: "duration",
    label: "Duração",
    render: (_, row) => (
      <span className="text-sm font-mono tabular-nums">
        {parseIsoDuration(row.duration as string)}
      </span>
    ),
  },
  {
    key: "published_at",
    label: "Publicado",
    render: (_, row) =>
      row.published_at ? (
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {new Date(row.published_at as string).toLocaleDateString("pt-BR")}
        </span>
      ) : "—",
  },
]}
```

- [ ] **Step 2: Atualizar a função `exportCsv`**

Substituir a função `exportCsv` atual por:

```typescript
function exportCsv() {
  const headers = "Titulo,Views,Retencao%,Engajamento%,ComentariosViews%,Duracao,Publicado\n";
  const rows = videos
    .map((v) => {
      const retencao = v.view_count ? ((v.like_count / v.view_count) * 100).toFixed(2) : "0";
      const engajamento = v.view_count
        ? (((v.like_count + v.comment_count) / v.view_count) * 100).toFixed(2)
        : "0";
      const taxaComentarios = v.view_count
        ? ((v.comment_count / v.view_count) * 100).toFixed(2)
        : "0";
      return `"${v.title}",${v.view_count},${retencao},${engajamento},${taxaComentarios},"${parseIsoDuration(v.duration)}","${v.published_at}"`;
    })
    .join("\n");
  const blob = new Blob([headers + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "youtube_videos.csv";
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Verificar no browser**

Abrir aba "Vídeos":
- Colunas visíveis: Título | Views | Retenção | Engajamento | Coment./Views | Duração | Publicado
- Retenção exibe percentual com 2 casas decimais (ex: `4.23%`)
- Vídeos com 0 views exibem `—` nas métricas
- Clicar em "Exportar CSV" e abrir o arquivo: confirmar que as 7 colunas estão presentes e com valores corretos

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/youtube/page.tsx
git commit -m "feat(youtube): update video table with retention percentage columns"
```

---

## Verificação Final

1. Abrir `http://localhost:3000/dashboard/youtube`
2. Selecionar uma conta YouTube com dados coletados
3. **Aba "Visão Geral":**
   - Linha 1: Inscritos, Views Totais, Vídeos (sem alteração)
   - Linha 2: Retenção (%), Engajamento Total (%), Coment./Views (%), Duração Média (mm:ss)
   - Nenhum valor exibe `NaN` ou `Infinity`
4. **Aba "Vídeos":**
   - 7 colunas: Título, Views, Retenção, Engajamento, Coment./Views, Duração, Publicado
   - Vídeos sem views mostram `—` nas métricas percentuais
5. **CSV export:** colunas atualizadas com os três percentuais
6. **Sem conta configurada:** tela de "Nenhuma conta YouTube cadastrada" inalterada
