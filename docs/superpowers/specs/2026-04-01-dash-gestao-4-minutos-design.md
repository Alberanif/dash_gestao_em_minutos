# Dashboard "Gestao em 4 Minutos" - Design Spec

## Contexto

A empresa precisa de um dashboard de gestao que permita analise rapida (4 minutos) dos principais KPIs de presenca digital: YouTube (canal + videos) e Instagram (perfil + posts + stories + reels). Os dados sao coletados via API e armazenados no Supabase, com coleta automatizada via cron jobs externos.

## Decisoes de Arquitetura

- **Stack**: Next.js (App Router) + Tailwind CSS + TypeScript
- **Backend**: API Routes do Next.js (monolito)
- **Banco**: Supabase (PostgreSQL + Auth + RLS)
- **Cron**: cron-job.org chamando endpoints protegidos
- **Graficos**: Recharts
- **Auth**: Supabase Auth (multi-usuario)
- **Deploy**: A definir (arquitetura flexivel)

## Estrutura do Projeto

```
dash-gestao/
├── .env.local                      # Chaves sensiveis (server-only)
├── next.config.js
├── package.json
├── tailwind.config.js
├── tsconfig.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Layout raiz com Supabase Auth provider
│   │   ├── page.tsx                # Redirect para /dashboard ou /login
│   │   ├── login/page.tsx          # Pagina de login
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx          # Layout protegido (verifica auth)
│   │   │   ├── page.tsx            # Visao geral "4 minutos"
│   │   │   ├── youtube/page.tsx    # KPIs detalhados YouTube
│   │   │   └── instagram/page.tsx  # KPIs detalhados Instagram
│   │   │
│   │   └── api/
│   │       ├── cron/
│   │       │   ├── youtube/route.ts    # Endpoint para cron-job.org
│   │       │   └── instagram/route.ts  # Endpoint para cron-job.org
│   │       │
│   │       ├── youtube/
│   │       │   ├── channel/route.ts    # Dados canal para frontend
│   │       │   └── videos/route.ts     # Dados videos para frontend
│   │       │
│   │       └── instagram/
│   │           ├── profile/route.ts    # Dados perfil para frontend
│   │           ├── posts/route.ts      # Dados posts para frontend
│   │           ├── stories/route.ts    # Dados stories
│   │           └── reels/route.ts      # Dados reels
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Client-side Supabase (anon key)
│   │   │   └── server.ts           # Server-side Supabase (service role key)
│   │   │
│   │   ├── services/
│   │   │   ├── youtube.ts          # Logica de coleta YouTube API v3
│   │   │   └── instagram.ts        # Logica de coleta Instagram Graph API
│   │   │
│   │   └── utils/
│   │       ├── cron-auth.ts        # Validacao do secret dos cron jobs
│   │       └── api-auth.ts         # Middleware de auth para API routes
│   │
│   └── components/
│       ├── ui/                     # Componentes base (cards, charts)
│       ├── dashboard/              # Componentes especificos do dashboard
│       └── auth/                   # Componentes de login/logout
```

## Modelo de Dados (Supabase)

Todas as tabelas usam prefixo `dash_gestao_`. PKs sao UUID auto-gerados. Todas possuem `collected_at timestamptz` para historico.

### dash_gestao_youtube_channel

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Auto-gerado |
| channel_id | text NOT NULL | ID do canal YouTube |
| subscriber_count | bigint | Total de inscritos |
| view_count | bigint | Views totais do canal |
| video_count | integer | Total de videos |
| collected_at | timestamptz NOT NULL | Data/hora da coleta |

Indice: `(channel_id, collected_at DESC)` para queries por periodo.

### dash_gestao_youtube_videos

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Auto-gerado |
| video_id | text NOT NULL | ID do video |
| title | text | Titulo |
| published_at | timestamptz | Data de publicacao |
| view_count | bigint | Views |
| like_count | bigint | Likes |
| comment_count | bigint | Comentarios |
| duration | text | Duracao ISO 8601 |
| thumbnail_url | text | URL da thumbnail |
| collected_at | timestamptz NOT NULL | Data/hora da coleta |

Indice: `(video_id, collected_at DESC)`.

### dash_gestao_instagram_profile

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Auto-gerado |
| ig_user_id | text NOT NULL | ID do usuario IG |
| followers_count | bigint | Seguidores |
| follows_count | bigint | Seguindo |
| media_count | integer | Total de midias |
| impressions | bigint | Impressoes (periodo) |
| reach | bigint | Alcance (periodo) |
| collected_at | timestamptz NOT NULL | Data/hora da coleta |

Indice: `(ig_user_id, collected_at DESC)`.

### dash_gestao_instagram_media

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Auto-gerado |
| media_id | text NOT NULL | ID da midia |
| media_type | text NOT NULL | 'IMAGE', 'VIDEO', 'CAROUSEL', 'REEL', 'STORY' |
| caption | text | Legenda |
| permalink | text | URL do post |
| like_count | bigint | Curtidas |
| comments_count | bigint | Comentarios |
| reach | bigint | Alcance |
| impressions | bigint | Impressoes |
| saved | bigint | Salvos |
| shares | bigint | Compartilhamentos |
| plays | bigint | Plays (videos/reels) |
| published_at | timestamptz | Data de publicacao |
| collected_at | timestamptz NOT NULL | Data/hora da coleta |

Indice: `(media_id, collected_at DESC)`, `(media_type, collected_at DESC)`.

### dash_gestao_cron_logs

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Auto-gerado |
| job_name | text NOT NULL | 'youtube' ou 'instagram' |
| status | text NOT NULL | 'success' ou 'error' |
| records_collected | integer | Qtd de registros inseridos |
| error_message | text | Mensagem de erro (se houver) |
| started_at | timestamptz NOT NULL | Inicio da execucao |
| finished_at | timestamptz | Fim da execucao |

## Seguranca

### Variaveis de ambiente (`.env.local`, server-only)

```
YOUTUBE_API_KEY=...
INSTAGRAM_ACCESS_TOKEN=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Nenhuma usa prefixo `NEXT_PUBLIC_` — nunca expostas ao browser.

### Camadas de protecao

1. **Chaves no servidor**: Todas as API keys ficam apenas em `.env.local`, acessiveis apenas via API Routes (server-side)
2. **Auth dos cron jobs**: cron-job.org envia header `Authorization: Bearer <CRON_SECRET>`. Endpoint valida antes de executar
3. **Auth das API Routes**: Rotas `/api/youtube/*` e `/api/instagram/*` verificam JWT do Supabase Auth
4. **RLS no Supabase**: Tabelas `dash_gestao_*` com Row Level Security ativado. Leitura apenas para usuarios autenticados. Escrita apenas via `service_role_key`
5. **CORS**: API Routes nao aceitam requests de dominios externos
6. **Rate limiting nos cron endpoints**: Prevencao contra chamadas abusivas

## Fluxo de Coleta (Cron Jobs)

### Agendamento (cron-job.org)

| Job | Endpoint | Horario | Frequencia |
|-----|----------|---------|------------|
| YouTube | `POST /api/cron/youtube` | 02:00 UTC | Diario |
| Instagram | `POST /api/cron/instagram` | 02:30 UTC | Diario |

Espacados em 30 minutos para evitar sobrecarga.

### Fluxo YouTube

```
cron-job.org → POST /api/cron/youtube
  1. Valida CRON_SECRET no header Authorization
  2. Chama YouTube Data API v3:
     - channels.list (statistics do canal)
     - search.list (ultimos videos do canal)
     - videos.list (statistics de cada video)
  3. Transforma dados para formato das tabelas
  4. Insere no Supabase via service_role_key
  5. Registra log em dash_gestao_cron_logs
  6. Retorna 200 OK (ou 500 com erro logado)
```

### Fluxo Instagram

```
cron-job.org → POST /api/cron/instagram
  1. Valida CRON_SECRET no header Authorization
  2. Chama Instagram Graph API:
     - GET /me (dados do perfil)
     - GET /me/media (posts e reels recentes)
     - GET /me/stories (stories ativos)
     - GET /{media-id}/insights (metricas por midia)
  3. Transforma dados para formato das tabelas
  4. Insere no Supabase via service_role_key
  5. Registra log em dash_gestao_cron_logs
  6. Retorna 200 OK (ou 500 com erro logado)
```

### Tratamento de erros

- Falhas de API sao registradas no log com erro detalhado
- Coletas parciais sao salvas (se canal funciona mas videos falham, canal e salvo)
- cron-job.org possui notificacoes nativas de falha (email/webhook)

## Dashboard - Visao "Gestao em 4 Minutos"

### Pagina principal (`/dashboard`)

**Bloco YouTube:**
- Card principal: Inscritos (variacao vs dia anterior), Views totais, Total de videos
- Cards secundarios: Top 5 videos recentes por views (thumbnail + titulo + metricas)
- Grafico de linha: Evolucao de inscritos e views nos ultimos 30 dias

**Bloco Instagram:**
- Card principal: Seguidores (variacao), Alcance total, Impressoes
- Cards secundarios: Top 5 posts por alcance (preview + metricas)
- Grafico de linha: Evolucao de seguidores e alcance nos ultimos 30 dias
- Mini-secao: Stories ativos e performance de Reels recentes

**Bloco de Status:**
- Ultima coleta bem-sucedida de cada fonte
- Indicador visual (verde/vermelho) de saude dos cron jobs

### Paginas detalhadas

- `/dashboard/youtube` — Tabela completa de videos com filtros por periodo, graficos comparativos, exportacao CSV
- `/dashboard/instagram` — Tabela completa de midias com filtros por tipo e periodo, graficos comparativos, exportacao CSV

## Dependencias Principais

```json
{
  "next": "^15",
  "react": "^19",
  "@supabase/supabase-js": "^2",
  "@supabase/ssr": "^0",
  "recharts": "^2",
  "tailwindcss": "^4",
  "typescript": "^5"
}
```

## Verificacao

1. **Cron jobs**: Chamar manualmente os endpoints `/api/cron/youtube` e `/api/cron/instagram` com o CRON_SECRET e verificar que dados sao inseridos no Supabase
2. **Dashboard**: Verificar que os dados coletados aparecem nos cards e graficos
3. **Seguranca**: Tentar acessar API Routes sem auth (deve retornar 401), tentar acessar cron endpoints sem secret (deve retornar 401)
4. **RLS**: Tentar ler tabelas `dash_gestao_*` diretamente pelo Supabase client sem auth (deve falhar)
5. **Auth**: Login/logout funcional, redirecionamento correto para `/login` quando nao autenticado
