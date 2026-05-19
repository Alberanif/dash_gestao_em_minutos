# YouTube `impressions` Bug Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolar a métrica `impressions` em chamada separada best-effort na Analytics API e tornar o campo `analyticsError` visível em `cron_logs`, eliminando falhas silenciosas de 18+ dias.

**Architecture:** A chamada principal em `analytics.ts` é dividida em 4 chamadas por chunk; a Chamada 4 (`impressions`) tem try/catch próprio e falha graciosamente com `impressions: 0`. Uma migration adiciona `warning_message` à tabela de logs; os dois callers de `collectYouTube` passam `analyticsError` para esse campo.

**Tech Stack:** TypeScript, Next.js App Router, Supabase (PostgreSQL), YouTube Analytics API v2.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/032_cron_logs_warning_message.sql` | Criar | Adiciona coluna `warning_message text` |
| `src/lib/youtube/analytics.ts` | Modificar | Extrai `impressions` para Chamada 4 isolada |
| `src/app/api/cron/collect/route.ts` | Modificar | Propaga `analyticsError` → `warning_message` |
| `src/app/api/youtube/batch-collect/route.ts` | Modificar | Idem |

---

## Task 1: Migration — adicionar `warning_message` a `cron_logs`

**Files:**
- Create: `supabase/migrations/032_cron_logs_warning_message.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/032_cron_logs_warning_message.sql
ALTER TABLE dash_gestao_cron_logs
  ADD COLUMN IF NOT EXISTS warning_message text;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

No dashboard do Supabase → SQL Editor, colar e executar o conteúdo do arquivo.
Ou via CLI:
```bash
supabase db push
```

- [ ] **Step 3: Verificar que a coluna existe**

No Supabase SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dash_gestao_cron_logs'
  AND column_name = 'warning_message';
```
Resultado esperado: 1 linha com `warning_message | text`.

- [ ] **Step 4: Commitar a migration**

```bash
git add supabase/migrations/032_cron_logs_warning_message.sql
git commit -m "feat(cron-logs): add warning_message column for soft Analytics API errors"
```

---

## Task 2: Isolar `impressions` em Chamada 4 — `analytics.ts`

**Files:**
- Modify: `src/lib/youtube/analytics.ts:97-99,109-111,145-194`

Esta é a mudança central. A função `queryChannelDaily` passa de 3 para 4 chamadas por chunk.

- [ ] **Step 1: Remover `impressions` das métricas das Chamadas 1 e 1b**

Em `analytics.ts`, substituir as duas ocorrências do string de métricas (linhas 97-99 e 109-111):

```ts
// ANTES (linhas 97-99 e 109-111 — aparece duas vezes, idêntico):
metrics:
  "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
  "likes,comments,shares,impressions",

// DEPOIS (aplicar nos dois lugares):
metrics:
  "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
  "likes,comments,shares",
```

- [ ] **Step 2: Adicionar Chamada 4 após a Chamada 3**

Imediatamente após o bloco da Chamada 3 (que termina na linha 145 com `};`), inserir:

```ts
    await sleep(100);

    // Chamada 4: impressions — best-effort, canal pode não expor essa métrica.
    // Retorna 400 com "Unknown identifier (impressions)" nesses casos.
    let impressionsData: Record<string, unknown> = {};
    try {
      impressionsData = await analyticsGet(accessToken, {
        ids: `channel==${channelId}`,
        startDate: chunk.start,
        endDate: chunk.end,
        metrics: "impressions",
        dimensions: "day",
        filters: "creatorContentType==VIDEO_ON_DEMAND",
      });
    } catch {
      // Canal não suporta impressions — todos os dias ficam com impressions: 0
    }
```

- [ ] **Step 3: Converter `impressionsData` para linhas e indexar por data**

Logo após as três linhas existentes de `columnarToObjects` (linha 147-149), adicionar:

```ts
    const impressionsRows = columnarToObjects(impressionsData);
```

E logo após os três `Map` existentes (após a linha que define `subsByDate`, linha 158-160), adicionar:

```ts
    const impressionsByDate = new Map<string, Record<string, unknown>>(
      impressionsRows.map((r) => [r.day as string, r])
    );
```

- [ ] **Step 4: Usar `impressionsByDate` no merge final**

No loop de merge (próximo a linha 194), substituir:

```ts
        impressions: Number(video?.impressions ?? 0),
```

por:

```ts
        impressions: Number(impressionsByDate.get(date)?.impressions ?? 0),
```

- [ ] **Step 5: Verificar tipagem**

```bash
npx tsc --noEmit
```

Resultado esperado: sem erros de tipo.

- [ ] **Step 6: Commitar**

```bash
git add src/lib/youtube/analytics.ts
git commit -m "fix(youtube): isolate impressions into separate best-effort Analytics API call"
```

---

## Task 3: Propagar `analyticsError` em `cron/collect/route.ts`

**Files:**
- Modify: `src/app/api/cron/collect/route.ts:39-62`

- [ ] **Step 1: Capturar `analyticsError` no bloco YouTube e incluir no insert**

Substituir o bloco `try` inteiro (linhas 38-70):

```ts
    try {
      let records = 0;
      let warningMessage: string | undefined;

      if (account.platform === "youtube") {
        const result = await collectYouTube(account);
        records = result.channelRecords + result.videoRecords;
        warningMessage = result.analyticsError;
      } else if (account.platform === "instagram") {
        const result = await collectInstagramDaily(account);
        records = result.profileRecords + result.mediaRecords;
      } else if (account.platform === "hotmart") {
        const result = await collectHotmart(account);
        records = result.salesRecords;
      } else if (account.platform === "meta-ads") {
        const result = await collectMetaAds(account);
        records = result.dailyRecords + result.campaignDailyRecords;
      }

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: account.platform,
        status: "success",
        records_collected: records,
        warning_message: warningMessage ?? null,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      results.push({
        account_id: account.id,
        account_name: account.name,
        platform: account.platform,
        status: "success",
        records,
      });
    }
```

- [ ] **Step 2: Verificar tipagem**

```bash
npx tsc --noEmit
```

Resultado esperado: sem erros de tipo.

- [ ] **Step 3: Commitar**

```bash
git add src/app/api/cron/collect/route.ts
git commit -m "fix(cron): propagate analyticsError to warning_message in cron_logs"
```

---

## Task 4: Propagar `analyticsError` em `batch-collect/route.ts`

**Files:**
- Modify: `src/app/api/youtube/batch-collect/route.ts:39-46`

- [ ] **Step 1: Adicionar `warning_message` ao insert de sucesso**

Substituir o bloco de insert de sucesso (linhas 39-46):

```ts
    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "youtube",
      status: "success",
      records_collected: result.channelRecords + result.videoRecords,
      warning_message: result.analyticsError ?? null,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });
```

- [ ] **Step 2: Verificar tipagem**

```bash
npx tsc --noEmit
```

Resultado esperado: sem erros de tipo.

- [ ] **Step 3: Commitar**

```bash
git add src/app/api/youtube/batch-collect/route.ts
git commit -m "fix(batch-collect): propagate analyticsError to warning_message in cron_logs"
```

---

## Task 5: Verificação end-to-end pós-deploy

Após deploy em produção:

- [ ] **Step 1: Rodar o cron manualmente e verificar log**

No Supabase SQL Editor, após disparar o cron:
```sql
SELECT job_name, status, records_collected, warning_message, finished_at
FROM dash_gestao_cron_logs
WHERE job_name = 'youtube'
ORDER BY finished_at DESC
LIMIT 5;
```

Para o canal que antes quebrava:
- `status = 'success'`
- `records_collected > 0`
- `warning_message IS NULL` (Chamada 4 passou) OU `warning_message IS NOT NULL` (Chamada 4 retornou 400 — esperado e aceitável)

Para canais saudáveis:
- `status = 'success'`, `records_collected > 0`, `warning_message IS NULL`

- [ ] **Step 2: Verificar dados no banco para o canal afetado**

```sql
SELECT date, views, likes, comments, impressions
FROM dash_gestao_youtube_channel_daily
WHERE account_id = '<id-da-conta-afetada>'
ORDER BY date DESC
LIMIT 10;
```

Esperado: `views`, `likes`, `comments` com valores reais; `impressions` pode ser 0 se o canal não suportar a métrica.

---

## Task 6: Backfill dos 18 dias de gap

Após confirmar que a Task 5 passou:

- [ ] **Step 1: Identificar o `account_id` da conta afetada**

```sql
SELECT id, name FROM dash_gestao_accounts WHERE platform = 'youtube';
```

- [ ] **Step 2: Disparar o backfill**

```bash
curl -X POST https://<host>/api/youtube/batch-collect \
  -H "Authorization: Bearer <seu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "<id-da-conta-afetada>",
    "start_date": "2026-05-01",
    "end_date": "2026-05-18"
  }'
```

Resposta esperada:
```json
{ "channelRecords": 18, "videoRecords": <n> }
```

- [ ] **Step 3: Confirmar registros no banco**

```sql
SELECT date, views, likes, comments, impressions
FROM dash_gestao_youtube_channel_daily
WHERE account_id = '<id-da-conta-afetada>'
  AND date BETWEEN '2026-05-01' AND '2026-05-18'
ORDER BY date;
```

Esperado: 18 linhas, `views` > 0 nos dias com atividade, sem zeros em massa.

---

## Spec coverage

| Requisito do spec | Task |
|---|---|
| Seção 1: `impressions` isolado em Chamada 4 | Task 2 |
| Seção 2: migration `warning_message` | Task 1 |
| Seção 2: callers propagam `analyticsError` | Tasks 3 e 4 |
| Seção 3: backfill via `batch-collect` | Task 6 |
| Seção 4: verificação Cenário A (canal sem impressions) | Task 5 |
| Seção 4: verificação Cenário C (warning visível) | Task 5 |
