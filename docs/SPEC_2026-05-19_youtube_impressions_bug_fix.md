# Design: YouTube Analytics — Isolamento de `impressions` e visibilidade de erros

**Data:** 2026-05-19
**Status:** Aprovado

## Contexto e causa raiz

A YouTube Analytics API retorna HTTP 400 com `"Unknown identifier (impressions) given in field parameters.metrics"` para canais que não têm essa métrica disponível. O campo `impressions` estava embutido na chamada principal de `queryChannelDaily` (`analytics.ts:98`) e no seu fallback (`analytics.ts:110`). Quando qualquer das duas retornava 400, a exceção propagava para o bloco `try/catch` de `collectYouTube` (`services/youtube.ts:165-233`), que zerova `channelRecords` e populava `analyticsError`.

O problema ficou invisível por 18 dias porque ambos os callers de `collectYouTube` — `cron/collect/route.ts` e `batch-collect/route.ts` — ignoram completamente o campo `analyticsError` e gravam `status: "success"` com `records_collected: 0` no log.

## Escopo da mudança

Três arquivos de código + uma migration de banco:

| Arquivo | Mudança |
|---|---|
| `src/lib/youtube/analytics.ts` | Extrair `impressions` para Chamada 4 isolada |
| `src/app/api/cron/collect/route.ts` | Propagar `analyticsError` para `warning_message` |
| `src/app/api/youtube/batch-collect/route.ts` | Idem |
| `supabase/migrations/032_cron_logs_warning_message.sql` | Adicionar coluna `warning_message` |

---

## Seção 1 — Isolamento de `impressions` na Analytics API

**Arquivo:** `src/lib/youtube/analytics.ts`

A função `queryChannelDaily` passa de 3 para 4 chamadas por chunk de datas:

```
Chamada 1:  views, estimatedMinutesWatched, averageViewDuration,
            averageViewPercentage, likes, comments, shares
            + filtro VIDEO_ON_DEMAND
            → se 400: fallback sem filtro (Chamada 1b), mesma lista de métricas

Chamada 2:  views + filtro SHORT  (sem mudança)

Chamada 3:  subscribersGained, subscribersLost  (sem mudança)

Chamada 4:  impressions + filtro VIDEO_ON_DEMAND  ← nova, best-effort
            → se qualquer erro: impressionsByDate fica vazio
```

No merge final, `impressions` usa `impressionsByDate.get(date) ?? 0`. Se a Chamada 4 falhar, os demais campos (views, watch-time, likes, etc.) não são afetados.

A interface `ChannelDailyApiRow` e a coluna `impressions` no banco permanecem sem mudança.

---

## Seção 2 — Visibilidade: `warning_message` em `cron_logs`

### Migration

```sql
-- supabase/migrations/032_cron_logs_warning_message.sql
ALTER TABLE dash_gestao_cron_logs
  ADD COLUMN IF NOT EXISTS warning_message text;
```

Não altera o constraint `check (status in ('success', 'error'))` — `warning_message` é ortogonal ao status.

### Callers de `collectYouTube`

Em `cron/collect/route.ts` e `batch-collect/route.ts`, o insert de sucesso passa a incluir:

```ts
warning_message: result.analyticsError ?? null,
```

Um log com `status: "success"`, `records_collected: 0` e `warning_message` preenchido identifica imediatamente uma falha silenciosa da Analytics API sem confundir com falha total da coleta.

---

## Seção 3 — Backfill do gap

`batch-collect/route.ts` já aceita `start_date` / `end_date` e faz upsert com `onConflict: "account_id,date"`. Após o deploy, rodar manualmente para cada conta afetada:

```bash
curl -X POST https://<host>/api/youtube/batch-collect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "<id-da-conta>",
    "start_date": "2026-05-01",
    "end_date": "2026-05-18"
  }'
```

Os zeros existentes são sobrescritos pelo upsert. Nenhuma automação de detecção de gap é necessária — evento pontual.

---

## Seção 4 — Verificação pós-deploy

**Cenário A — canal sem suporte a `impressions`:**
- `views`, `likes`, `comments`, demais métricas têm valores corretos
- `impressions` fica `0` (esperado e aceitável)
- `cron_logs`: `status: "success"`, `warning_message: null` (não lança mais erro)

**Cenário B — canal com suporte a `impressions`:**
- `impressions` tem valores reais
- Nenhuma regressão nas outras métricas

**Cenário C — falha legítima da Analytics API (ex: token expirado):**
- `analyticsError` ainda é propagado
- `cron_logs`: `status: "success"`, `warning_message` preenchido com o erro
- Detectável sem investigação manual

---

## O que este design não faz

- Não remove a coluna `impressions` do banco
- Não adiciona automação de detecção/preenchimento de gaps
- Não muda a interface `ChannelDailyApiRow`
- Não altera a lógica de coleta de vídeos (`data-api.ts`)
