# Design Spec: Migração YouTube Data API v3 → Analytics API

**Data:** 2026-04-07  
**Status:** Aprovado

---

## Contexto e Motivação

A integração atual com a YouTube Data API v3 coleta snapshots ponto-no-tempo (um registro por execução do cron). Isso impede a construção de histórico temporal real — o dashboard não consegue mostrar evolução diária de views, watch time ou retenção real.

A YouTube Analytics API fornece métricas com granularidade de dia, permite backfill histórico e inclui métricas de qualidade que a v3 não oferece (`averageViewPercentage`, `estimatedMinutesWatched`, `averageViewDuration`).

---

## Decisões de Design

| Decisão | Escolha |
|---|---|
| OAuth2 flow | Fluxo completo no app (botão → Google → callback automático) |
| Tabelas existentes | Removidas e substituídas por tabelas com granularidade de data |
| Profundidade do backfill | Configurável por conta (`history_start_date`) |
| Estrutura do serviço | Camadas separadas: auth, analytics engine, orquestração |
| `api_key` | Removido — token OAuth funciona para ambas as APIs |

---

## 1. Schema — Migration 003

### Tabelas removidas
- `dash_gestao_youtube_channel_snapshots`
- `dash_gestao_youtube_video_snapshots`

### Tabelas criadas

```sql
-- Métricas diárias do canal
create table dash_gestao_youtube_channel_daily (
  id                        uuid primary key default uuid_generate_v4(),
  account_id                uuid not null references dash_gestao_accounts(id) on delete cascade,
  date                      date not null,
  views                     bigint,
  estimated_minutes_watched bigint,
  average_view_duration     integer,       -- segundos
  average_view_percentage   numeric(5,2),  -- % retenção real (0–100)
  subscribers_gained        integer,
  subscribers_lost          integer,
  likes                     bigint,
  comments                  bigint,
  shares                    bigint,
  unique (account_id, date)
);

-- Metadados de vídeos (buscados 1x via Data API v3 com token OAuth)
create table dash_gestao_youtube_videos (
  id            uuid primary key default uuid_generate_v4(),
  account_id    uuid not null references dash_gestao_accounts(id) on delete cascade,
  video_id      text not null,
  title         text,
  published_at  timestamptz,
  thumbnail_url text,
  duration      text,
  updated_at    timestamptz not null default now(),
  unique (account_id, video_id)
);

-- Métricas diárias por vídeo
create table dash_gestao_youtube_video_daily (
  id                        uuid primary key default uuid_generate_v4(),
  account_id                uuid not null references dash_gestao_accounts(id) on delete cascade,
  video_id                  text not null,
  date                      date not null,
  views                     bigint,
  estimated_minutes_watched bigint,
  average_view_duration     integer,
  average_view_percentage   numeric(5,2),
  likes                     bigint,
  comments                  bigint,
  unique (account_id, video_id, date)
);
```

Índices a criar: `(account_id, date)` em `channel_daily`, `(account_id, video_id, date)` em `video_daily`.

RLS: mesmas políticas das tabelas antigas (select para authenticated, writes via service_role).

### Credenciais YouTube (`YouTubeCredentials`)

```typescript
interface YouTubeCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  channel_id: string;           // auto-detectado no callback OAuth
  history_start_date: string;   // YYYY-MM-DD — define profundidade do backfill
  // auto-gerenciados pelo sistema:
  access_token?: string;
  access_token_expiry?: string; // ISO timestamp
}
```

O campo `api_key` é removido completamente.

---

## 2. OAuth2 Flow

### Rotas novas

- `GET /api/auth/youtube/connect` — gera URL de autorização e redireciona
- `GET /api/auth/youtube/callback` — processa retorno do Google

### Sequência

```
1. Usuário clica "Conectar com Google" → frontend chama
   GET /api/auth/youtube/connect?account_id=XXX

2. connect route:
   - Valida que account_id existe e pertence ao usuário autenticado
   - Gera state = HMAC-SHA256(account_id, CRON_SECRET)  ← anti-CSRF
   - Salva state em cookie httpOnly de curta duração (10 min)
   - Redireciona para:
     https://accounts.google.com/o/oauth2/v2/auth?
       client_id={GOOGLE_CLIENT_ID}
       &redirect_uri={BASE_URL}/api/auth/youtube/callback
       &scope=https://www.googleapis.com/auth/yt-analytics.readonly
               https://www.googleapis.com/auth/youtube.readonly
       &response_type=code
       &access_type=offline
       &prompt=consent     ← obrigatório para emitir refresh_token
       &state={state}

3. Usuário autoriza no Google consent screen

4. Google redireciona para:
   GET /api/auth/youtube/callback?code=XXX&state=XXX

5. callback route:
   - Valida state via HMAC (proteção CSRF)
   - Recupera account_id do cookie
   - POST https://oauth2.googleapis.com/token com o code
     → recebe {access_token, refresh_token, expires_in}
   - GET https://www.googleapis.com/youtube/v3/channels?part=id&mine=true
     (com access_token) → obtém channel_id automaticamente
   - Atualiza dash_gestao_accounts.credentials com:
     {client_id, client_secret, refresh_token, access_token,
      access_token_expiry, channel_id, history_start_date}
   - Redireciona para /dashboard/settings
```

**Variáveis de ambiente novas:**
- `GOOGLE_CLIENT_ID` — do Google Cloud Console
- `GOOGLE_CLIENT_SECRET` — do Google Cloud Console
- `NEXT_PUBLIC_BASE_URL` — domínio base para o redirect_uri

---

## 3. Camada de Autenticação — `src/lib/youtube/auth.ts`

Exporta:
```typescript
getValidAccessToken(account: Account): Promise<string>
buildOAuthUrl(accountId: string, state: string): string
exchangeCodeForTokens(code: string): Promise<{access_token, refresh_token, expires_in}>
detectChannelId(accessToken: string): Promise<string>
```

**`getValidAccessToken`:**
1. Lê `access_token` e `access_token_expiry` das credenciais
2. Se o token expira em mais de 5 minutos → retorna token atual
3. Caso contrário → POST `oauth2.googleapis.com/token` com `refresh_token`
4. Atualiza credenciais no banco (service client)
5. Retorna novo `access_token`

---

## 4. Analytics Engine — `src/lib/youtube/analytics.ts`

### Endpoint da API
`GET https://youtubeanalytics.googleapis.com/v2/reports`

### Funções exportadas

```typescript
queryChannelDaily(
  accessToken: string,
  channelId: string,
  startDate: string,   // YYYY-MM-DD
  endDate: string
): Promise<ChannelDailyRow[]>

queryVideoDaily(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
): Promise<VideoDailyRow[]>

fetchVideoMetadata(
  accessToken: string,
  videoIds: string[]
): Promise<VideoMetadataRow[]>
```

### Transformação de resposta

A Analytics API retorna formato colunar:
```json
{
  "columnHeaders": [{"name": "day"}, {"name": "views"}, ...],
  "rows": [["2024-01-01", 1234, ...], ...]
}
```

`analytics.ts` transforma isso em arrays de objetos tipados indexando pelo nome de cada coluna.

### Paginação e throttle

- A API permite máximo 365 dias por query
- Períodos maiores são quebrados automaticamente em chunks anuais
- `queryVideoDaily` pagina via `pageToken` (max 200 rows/página)
- Delay de 200ms entre páginas durante backfill para preservar cota diária (10.000 unidades)

### Métricas coletadas

**Canal:**
`views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost,likes,comments,shares`  
dimensions: `day`

**Vídeo:**
`views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments`  
dimensions: `video,day`

---

## 5. Orquestração — `src/lib/services/youtube.ts`

### `collectYouTube(account: Account)`

```
1. accessToken = getValidAccessToken(account)

2. syncRange = detectSyncRange(account):
   - Sem dados no banco → {start: history_start_date, end: hoje}     [backfill]
   - Com dados → {start: max(date) - 3 dias, end: hoje}              [incremental]
   - Gap detection: datas faltando antes do max(date) são adicionadas ao range

3. channelRows = queryChannelDaily(accessToken, channelId, syncRange)

4. videoRows = queryVideoDaily(accessToken, channelId, syncRange)

5. newVideoIds = video_ids em videoRows não presentes em dash_gestao_youtube_videos
   videoMetadata = fetchVideoMetadata(accessToken, newVideoIds)

6. UPSERT channel_daily ON CONFLICT (account_id, date) DO UPDATE SET ...
7. UPSERT video_metadata ON CONFLICT (account_id, video_id) DO UPDATE SET ...
8. UPSERT video_daily ON CONFLICT (account_id, video_id, date) DO UPDATE SET ...

Return: { channelRecords: channelRows.length, videoRecords: videoRows.length }
```

A função `detectSyncRange` é responsável por toda a lógica de "o que buscar" — deixando o fluxo principal enxuto.

---

## 6. API Routes Atualizadas

### `GET /api/youtube/channel`
- Lê `channel_daily` em vez de `channel_snapshots`
- Retorna array de linhas diárias ordenadas por data (uma linha por dia no período solicitado)
- O frontend recebe as linhas diárias brutas e calcula os agregados para os KPI cards:
  - `SUM(views)` → KPI "Views no Período"
  - `SUM(subscribers_gained) - SUM(subscribers_lost)` → KPI "Inscritos Ganhos"
  - `AVG(average_view_percentage)` → KPI "Retenção Média Real"
  - `AVG(average_view_duration)` → KPI "Duração Média de Visualização"
  - `SUM(estimated_minutes_watched)` → KPI "Watch Time"
- O gráfico temporal usa as linhas diárias diretamente (x = date, y = views ou watch_min)
- Para o KPI "Total de Inscritos" e "Total de Vídeos" (valores absolutos atuais), o frontend chama adicionalmente `GET /api/youtube/stats?account_id=X`, que faz 1 chamada à Data API v3 (`channels?part=statistics&mine=true` com o OAuth token) e cacheia o resultado por 1 hora em memória.

### `GET /api/youtube/videos`
- JOIN `dash_gestao_youtube_videos` (metadata) com GROUP BY de `video_daily`
- Agrega métricas por `video_id` dentro do período solicitado
- Retorna: `{video_id, title, thumbnail_url, duration, published_at, total_views, total_watch_min, avg_view_percentage, total_likes, total_comments}`

---

## 7. Dashboard YouTube — Mudanças de KPIs

| KPI atual | Novo KPI | Cálculo |
|---|---|---|
| Inscritos (cumulative) | Inscritos Ganhos | SUM(subscribers_gained - subscribers_lost) |
| Views Totais (cumulative) | Views no Período | SUM(views) |
| Vídeos | (mantido via Data API v3) | `channels?part=statistics&mine=true` |
| "Retenção" (likes/views — proxy) | **Retenção Média Real** | AVG(average_view_percentage) % |
| Duração Média (ISO parse) | Duração Média de Visualização | AVG(average_view_duration) em segundos |
| — | Watch Time | SUM(estimated_minutes_watched) min |

O gráfico temporal mostrará `views` diárias e `estimated_minutes_watched` por dia.

> Para o total absoluto de inscritos atual, mantém-se 1 chamada à Data API v3 com token OAuth.

---

## 8. Settings UI — Conta YouTube

### Formulário modificado

O formulário atual (`{api_key, channel_id}`) é substituído por:

- **Client ID** — campo de texto (obtido no Google Cloud Console)
- **Client Secret** — campo de texto (obtido no Google Cloud Console)
- **Data de início do histórico** — date picker (`history_start_date`)
- **[Salvar e Conectar com Google]** — botão único que:
  1. Faz `PATCH /api/accounts/[id]` salvando `{client_id, client_secret, history_start_date}` nas credenciais
  2. Imediatamente redireciona para `/api/auth/youtube/connect?account_id=X`
- Status de conexão: "✓ Conectado como @channel\_id" ou "○ Não conectado"

O `channel_id` é auto-detectado no callback OAuth e não é um campo editável pelo usuário.

> **Importante:** `client_id` e `client_secret` precisam existir no banco **antes** do callback retornar, pois o callback precisa deles para salvar as credenciais completas. O fluxo de "Salvar primeiro, depois redirecionar" garante isso.

---

## 9. Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/003_youtube_analytics.sql` | Novo |
| `src/types/accounts.ts` | Atualizar `YouTubeCredentials` |
| `src/lib/youtube/auth.ts` | Novo |
| `src/lib/youtube/analytics.ts` | Novo |
| `src/lib/services/youtube.ts` | Reescrever |
| `src/app/api/auth/youtube/connect/route.ts` | Novo |
| `src/app/api/auth/youtube/callback/route.ts` | Novo |
| `src/app/api/youtube/channel/route.ts` | Atualizar (lê channel_daily) |
| `src/app/api/youtube/stats/route.ts` | Novo (Data API v3: subscriber_count total, video_count) |
| `src/app/api/youtube/videos/route.ts` | Atualizar (JOIN video_metadata + GROUP BY video_daily) |
| `src/app/dashboard/youtube/page.tsx` | Atualizar KPIs e chart |
| `src/app/dashboard/settings/page.tsx` (ou componente interno) | Atualizar form YouTube |

---

## 10. Verificação (End-to-End)

1. Adicionar conta YouTube nas Configurações → formulário exibe Client ID/Secret/date picker
2. Clicar "Conectar com Google" → redireciona para Google consent screen
3. Autorizar → callback salva tokens, `channel_id` auto-detectado, redireciona para Settings
4. Status exibe "✓ Conectado como @channel_id"
5. Disparar sync manual via painel Dados → `collectYouTube` executa backfill completo
6. Verificar no Supabase: linhas em `channel_daily` e `video_daily` com datas a partir de `history_start_date`
7. Segunda execução (incremental): apenas os últimos 3 dias são re-buscados, sem duplicatas (upsert)
8. Dashboard YouTube exibe KPIs com novos valores, gráfico mostra curva diária
9. Acessar `/api/auth/youtube/connect` sem login → 401
10. Tentar callback com state inválido → 400 (proteção CSRF)
