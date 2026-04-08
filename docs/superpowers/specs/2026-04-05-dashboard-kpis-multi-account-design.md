# Dashboard KPIs — Multi-Account (Primeira Etapa)

**Data:** 2026-04-05  
**Status:** Aprovado

---

## Contexto

O projeto já tem infraestrutura de coleta e exibição de dados para uma única conta do YouTube e uma do Instagram. O objetivo desta etapa é evoluir o dashboard para suportar múltiplas contas por plataforma, reorganizar a navegação por plataforma/conta/seção, e adicionar uma tela de gerenciamento de contas. Todos os dados coletados devem ser persistidos no Supabase com vínculo à conta de origem.

---

## Banco de Dados

Schema limpo a partir de uma nova migration (`002_multi_account.sql`). As tabelas antigas (`001`) são descartadas.

### Tabela `accounts`
Tabela central. Todas as outras tabelas de dados referenciam esta via `account_id`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `platform` | text | `'youtube'` ou `'instagram'` |
| `name` | text | Nome amigável (ex: "IGT Principal") |
| `credentials` | jsonb | Tokens e IDs da API (ver abaixo) |
| `is_active` | boolean | Se a conta deve ser coletada pelo cron |
| `created_at` | timestamptz | Data de cadastro |

**Estrutura de `credentials` por plataforma:**
```json
// YouTube
{ "api_key": "AIza...", "channel_id": "UCxx..." }

// Instagram
{ "access_token": "EAAx...", "user_id": "1234..." }
```

### Tabelas de snapshots

Todas têm `account_id uuid FK → accounts` e `collected_at timestamptz`.

- **`youtube_channel_snapshots`**: `subscriber_count`, `view_count`, `video_count`
- **`youtube_video_snapshots`**: `video_id`, `title`, `view_count`, `like_count`, `comment_count`, `duration`, `thumbnail_url`, `published_at`
- **`instagram_profile_snapshots`**: `followers_count`, `follows_count`, `media_count`, `impressions`, `reach`
- **`instagram_media_snapshots`**: `media_id`, `media_type`, `caption`, `permalink`, `like_count`, `comments_count`, `reach`, `impressions`, `saved`, `shares`, `plays`, `published_at`
- **`cron_logs`**: `account_id` (nullable), `job_name`, `status`, `records_collected`, `error_message`, `started_at`, `finished_at`

---

## Navegação

3 níveis hierárquicos:

```
Barra superior:   [ ▶ YouTube ]  [ 📷 Instagram ]  [ ⚙ Configurações ]
Sub-tabs de conta: [ IGT Principal ]  [ IGT Kids ]  [ + conta ]
Abas de seção:    [ Visão Geral ]  [ Vídeos / Posts ]  [ Tendências ]
```

- As sub-tabs de conta são carregadas dinamicamente do banco (`accounts WHERE platform = X AND is_active = true`)
- Cada plataforma tem suas próprias abas de seção:
  - **YouTube:** Visão Geral · Vídeos · Tendências
  - **Instagram:** Visão Geral · Posts/Reels · Tendências

---

## KPIs da Primeira Etapa

**YouTube (por conta):**
- Inscritos (`subscriber_count`)
- Views totais (`view_count`)
- Número de vídeos (`video_count`)

**Instagram (por conta):**
- Seguidores (`followers_count`)
- Alcance — 28d (`reach`)
- Impressões — 28d (`impressions`)

Todos exibidos via `KpiCard` existente com delta percentual vs snapshot anterior.

---

## Coleta de Dados (Cron)

O cron lê apenas contas **já cadastradas** na tabela `accounts` com `is_active = true`. Não descobre nem cria contas novas.

**Fluxo:**
1. `POST /api/cron/collect` (autenticado via `CRON_SECRET`)
2. Busca `SELECT * FROM accounts WHERE is_active = true`
3. Para cada conta: chama o service correspondente passando `account.credentials`
4. Cada service insere um snapshot com `account_id` no Supabase
5. Registra execução em `cron_logs` com `account_id`, status e contagem

Os services (`youtube.ts`, `instagram.ts`) são reescritos para receber as credentials como parâmetro em vez de ler do `.env`.

---

## Gerenciamento de Contas (Configurações)

Rota: `/dashboard/settings`

**Funcionalidades:**
- Listar contas cadastradas agrupadas por plataforma
- Adicionar nova conta via modal (nome + plataforma + credentials)
  - Formulário adapta os campos de credentials conforme plataforma selecionada
- Ativar/desativar conta (toggle `is_active`)
- Remover conta (com confirmação)

**API Routes:**
- `GET /api/accounts` — lista todas as contas
- `POST /api/accounts` — cria nova conta
- `PATCH /api/accounts/[id]` — atualiza (nome, credentials, is_active)
- `DELETE /api/accounts/[id]` — remove conta e todos os snapshots associados (CASCADE DELETE via FK na migration)

---

## Arquivos a Criar / Modificar

**Banco:**
- `supabase/migrations/002_multi_account.sql` — novo schema completo

**API Routes (novos):**
- `src/app/api/accounts/route.ts`
- `src/app/api/accounts/[id]/route.ts`
- `src/app/api/cron/collect/route.ts` — substitui os crons separados

**API Routes (modificados):**
- `src/app/api/youtube/channel/route.ts` — aceita `account_id`
- `src/app/api/youtube/videos/route.ts` — aceita `account_id`
- `src/app/api/instagram/profile/route.ts` — aceita `account_id`
- `src/app/api/instagram/media/route.ts` — aceita `account_id`

**Layout (modificado):**
- `src/app/dashboard/layout.tsx` — adiciona barra de plataformas (YouTube / Instagram / Configurações)

**Páginas (reescritas):**
- `src/app/dashboard/youtube/page.tsx` — sub-tabs de conta + abas de seção
- `src/app/dashboard/instagram/page.tsx` — sub-tabs de conta + abas de seção
- `src/app/dashboard/settings/page.tsx` — novo

**Componentes (novos):**
- `src/components/dashboard/account-tabs.tsx` — sub-tabs de conta dinâmicas
- `src/components/dashboard/section-tabs.tsx` — abas de seção (Visão Geral, Vídeos, Tendências)
- `src/components/settings/account-list.tsx` — lista de contas por plataforma
- `src/components/settings/account-form.tsx` — modal de cadastro/edição

**Services (reescritos):**
- `src/lib/services/youtube.ts` — recebe `credentials` como parâmetro
- `src/lib/services/instagram.ts` — recebe `credentials` como parâmetro

**Types:**
- `src/types/accounts.ts` — tipos `Account`, `YouTubeCredentials`, `InstagramCredentials`

**Componentes mantidos sem alteração:**
- `src/components/ui/kpi-card.tsx`
- `src/components/ui/line-chart.tsx`
- `src/components/ui/data-table.tsx`

---

## Verificação

1. Executar migration `002` no Supabase e confirmar criação das tabelas
2. Cadastrar uma conta YouTube e uma Instagram via tela de Configurações
3. Disparar `POST /api/cron/collect` manualmente e confirmar:
   - Snapshots criados com `account_id` correto
   - Log registrado em `cron_logs`
4. Abrir dashboard: verificar que as sub-tabs exibem as contas cadastradas
5. Verificar KPIs exibidos corretamente para cada conta
6. Testar adicionar segunda conta e confirmar que aparece nova sub-tab
7. Desativar uma conta (`is_active = false`) e confirmar que some das sub-tabs e não é coletada no próximo cron
