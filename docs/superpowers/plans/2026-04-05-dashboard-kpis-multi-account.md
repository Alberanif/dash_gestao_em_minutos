# Dashboard KPIs Multi-Account — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar o dashboard para suporte a múltiplas contas por plataforma com schema limpo no Supabase, tela de configurações, cron unificado e navegação por plataforma → conta → seção.

**Architecture:** Nova migration SQL (`002`) descarta tabelas antigas e cria `dash_gestao_accounts` + 5 tabelas de snapshots com `account_id` FK. Services de coleta recebem `Account` por parâmetro. Navegação usa 3 níveis: plataforma (layout) → conta (AccountTabs por página) → seção (SectionTabs dentro da página).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, Supabase (PostgreSQL + Auth)

---

## File Map

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/002_multi_account.sql` |
| Criar | `src/types/accounts.ts` |
| Criar | `src/app/api/accounts/route.ts` |
| Criar | `src/app/api/accounts/[id]/route.ts` |
| Criar | `src/app/api/cron/collect/route.ts` |
| Reescrever | `src/lib/services/youtube.ts` |
| Reescrever | `src/lib/services/instagram.ts` |
| Modificar | `src/app/api/youtube/channel/route.ts` |
| Modificar | `src/app/api/youtube/videos/route.ts` |
| Modificar | `src/app/api/instagram/profile/route.ts` |
| Modificar | `src/app/api/instagram/media/route.ts` |
| Criar | `src/components/layout/nav-links.tsx` |
| Modificar | `src/app/dashboard/layout.tsx` |
| Modificar | `src/app/dashboard/page.tsx` |
| Criar | `src/components/dashboard/account-tabs.tsx` |
| Criar | `src/components/dashboard/section-tabs.tsx` |
| Criar | `src/components/settings/account-form.tsx` |
| Criar | `src/components/settings/account-list.tsx` |
| Criar | `src/app/dashboard/settings/page.tsx` |
| Reescrever | `src/app/dashboard/youtube/page.tsx` |
| Reescrever | `src/app/dashboard/instagram/page.tsx` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_multi_account.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/002_multi_account.sql

-- Drop old tables (ordem importa por causa de dependências implícitas)
drop table if exists dash_gestao_cron_logs;
drop table if exists dash_gestao_instagram_media;
drop table if exists dash_gestao_instagram_profile;
drop table if exists dash_gestao_youtube_videos;
drop table if exists dash_gestao_youtube_channel;

-- Enable UUID extension (idempotente)
create extension if not exists "uuid-ossp";

-- Central accounts table
create table dash_gestao_accounts (
  id          uuid primary key default uuid_generate_v4(),
  platform    text not null check (platform in ('youtube', 'instagram')),
  name        text not null,
  credentials jsonb not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- YouTube channel snapshots
create table dash_gestao_youtube_channel_snapshots (
  id               uuid primary key default uuid_generate_v4(),
  account_id       uuid not null references dash_gestao_accounts(id) on delete cascade,
  subscriber_count bigint,
  view_count       bigint,
  video_count      integer,
  collected_at     timestamptz not null default now()
);
create index idx_yt_channel_account_collected
  on dash_gestao_youtube_channel_snapshots (account_id, collected_at desc);

-- YouTube video snapshots
create table dash_gestao_youtube_video_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  account_id    uuid not null references dash_gestao_accounts(id) on delete cascade,
  video_id      text not null,
  title         text,
  published_at  timestamptz,
  view_count    bigint,
  like_count    bigint,
  comment_count bigint,
  duration      text,
  thumbnail_url text,
  collected_at  timestamptz not null default now()
);
create index idx_yt_video_account_collected
  on dash_gestao_youtube_video_snapshots (account_id, collected_at desc);

-- Instagram profile snapshots
create table dash_gestao_instagram_profile_snapshots (
  id              uuid primary key default uuid_generate_v4(),
  account_id      uuid not null references dash_gestao_accounts(id) on delete cascade,
  followers_count bigint,
  follows_count   bigint,
  media_count     integer,
  impressions     bigint,
  reach           bigint,
  collected_at    timestamptz not null default now()
);
create index idx_ig_profile_account_collected
  on dash_gestao_instagram_profile_snapshots (account_id, collected_at desc);

-- Instagram media snapshots
create table dash_gestao_instagram_media_snapshots (
  id             uuid primary key default uuid_generate_v4(),
  account_id     uuid not null references dash_gestao_accounts(id) on delete cascade,
  media_id       text not null,
  media_type     text not null check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL', 'REEL', 'STORY')),
  caption        text,
  permalink      text,
  like_count     bigint,
  comments_count bigint,
  reach          bigint,
  impressions    bigint,
  saved          bigint,
  shares         bigint,
  plays          bigint,
  published_at   timestamptz,
  collected_at   timestamptz not null default now()
);
create index idx_ig_media_account_collected
  on dash_gestao_instagram_media_snapshots (account_id, collected_at desc);

-- Cron execution logs
create table dash_gestao_cron_logs (
  id                uuid primary key default uuid_generate_v4(),
  account_id        uuid references dash_gestao_accounts(id) on delete set null,
  job_name          text not null,
  status            text not null check (status in ('success', 'error')),
  records_collected integer,
  error_message     text,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);

-- RLS: enable on all tables
alter table dash_gestao_accounts enable row level security;
alter table dash_gestao_youtube_channel_snapshots enable row level security;
alter table dash_gestao_youtube_video_snapshots enable row level security;
alter table dash_gestao_instagram_profile_snapshots enable row level security;
alter table dash_gestao_instagram_media_snapshots enable row level security;
alter table dash_gestao_cron_logs enable row level security;

-- RLS policies: authenticated users can read all rows
create policy "Authenticated users can read accounts"
  on dash_gestao_accounts for select to authenticated using (true);

create policy "Authenticated users can read youtube channel snapshots"
  on dash_gestao_youtube_channel_snapshots for select to authenticated using (true);

create policy "Authenticated users can read youtube video snapshots"
  on dash_gestao_youtube_video_snapshots for select to authenticated using (true);

create policy "Authenticated users can read instagram profile snapshots"
  on dash_gestao_instagram_profile_snapshots for select to authenticated using (true);

create policy "Authenticated users can read instagram media snapshots"
  on dash_gestao_instagram_media_snapshots for select to authenticated using (true);

create policy "Authenticated users can read cron logs"
  on dash_gestao_cron_logs for select to authenticated using (true);
-- Writes happen via service_role_key which bypasses RLS.
```

- [ ] **Step 2: Executar a migration no Supabase**

No painel do Supabase → SQL Editor, cole e execute o conteúdo do arquivo acima. Verifique que as 6 tabelas aparecem no Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_multi_account.sql
git commit -m "feat: add multi-account schema with accounts table and account_id FKs"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/accounts.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

```typescript
// src/types/accounts.ts

export interface YouTubeCredentials {
  api_key: string;
  channel_id: string;
}

export interface InstagramCredentials {
  access_token: string;
  user_id: string;
}

export interface Account {
  id: string;
  platform: "youtube" | "instagram";
  name: string;
  credentials: YouTubeCredentials | InstagramCredentials;
  is_active: boolean;
  created_at: string;
}

export interface ChannelSnapshot {
  id: string;
  account_id: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  collected_at: string;
}

export interface VideoSnapshot {
  id: string;
  account_id: string;
  video_id: string;
  title: string;
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration: string;
  thumbnail_url: string;
  collected_at: string;
  [key: string]: unknown;
}

export interface ProfileSnapshot {
  id: string;
  account_id: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  impressions: number;
  reach: number;
  collected_at: string;
}

export interface MediaSnapshot {
  id: string;
  account_id: string;
  media_id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL" | "STORY";
  caption: string | null;
  permalink: string | null;
  like_count: number;
  comments_count: number;
  reach: number;
  impressions: number;
  saved: number;
  shares: number;
  plays: number;
  published_at: string;
  collected_at: string;
  [key: string]: unknown;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/accounts.ts
git commit -m "feat: add TypeScript types for accounts and snapshots"
```

---

## Task 3: Accounts API Routes

**Files:**
- Create: `src/app/api/accounts/route.ts`
- Create: `src/app/api/accounts/[id]/route.ts`

- [ ] **Step 1: Criar a rota de coleção (GET e POST)**

```typescript
// src/app/api/accounts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const platform = request.nextUrl.searchParams.get("platform");

  let query = supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { name, platform, credentials } = body;

  if (!name || !platform || !credentials) {
    return NextResponse.json(
      { error: "name, platform e credentials são obrigatórios" },
      { status: 400 }
    );
  }

  if (!["youtube", "instagram"].includes(platform)) {
    return NextResponse.json(
      { error: "platform deve ser 'youtube' ou 'instagram'" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .insert({ name, platform, credentials })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Criar a rota de item individual (PATCH e DELETE)**

```typescript
// src/app/api/accounts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  // Permite atualizar apenas campos seguros
  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.credentials !== undefined) allowed.credentials = body.credentials;
  if (body.is_active !== undefined) allowed.is_active = body.is_active;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  // CASCADE DELETE via FK remove todos os snapshots associados automaticamente
  const { error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Verificar manualmente**

Com o servidor rodando (`npm run dev`), teste no terminal:
```bash
# Substitua TOKEN pelo seu cookie de sessão ou teste via browser autenticado
curl http://localhost:3000/api/accounts
# Esperado: [] (array vazio, pois não há contas ainda)
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/accounts/
git commit -m "feat: add accounts CRUD API routes"
```

---

## Task 4: Reescrever Services

**Files:**
- Rewrite: `src/lib/services/youtube.ts`
- Rewrite: `src/lib/services/instagram.ts`

- [ ] **Step 1: Reescrever o service do YouTube**

```typescript
// src/lib/services/youtube.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, YouTubeCredentials } from "@/types/accounts";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeChannelStats {
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails: { medium: { url: string } };
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails: {
    duration: string;
  };
}

async function youtubeGet(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string
) {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectYouTube(account: Account): Promise<{
  channelRecords: number;
  videoRecords: number;
}> {
  const { api_key, channel_id } = account.credentials as YouTubeCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  // 1. Fetch channel statistics
  const channelData = await youtubeGet(
    "channels",
    { part: "statistics", id: channel_id },
    api_key
  );

  const stats: YouTubeChannelStats = channelData.items[0].statistics;

  const { error: channelError } = await supabase
    .from("dash_gestao_youtube_channel_snapshots")
    .insert({
      account_id: account.id,
      subscriber_count: parseInt(stats.subscriberCount),
      view_count: parseInt(stats.viewCount),
      video_count: parseInt(stats.videoCount),
      collected_at: now,
    });

  if (channelError) throw new Error(`Channel insert error: ${channelError.message}`);

  // 2. Fetch recent videos (last 50)
  const searchData = await youtubeGet(
    "search",
    { part: "id", channelId: channel_id, order: "date", maxResults: "50", type: "video" },
    api_key
  );

  const videoIds: string[] = searchData.items.map(
    (item: { id: { videoId: string } }) => item.id.videoId
  );

  if (videoIds.length === 0) {
    return { channelRecords: 1, videoRecords: 0 };
  }

  // 3. Fetch video details
  const videosData = await youtubeGet(
    "videos",
    { part: "snippet,statistics,contentDetails", id: videoIds.join(",") },
    api_key
  );

  const videoRows = videosData.items.map((video: YouTubeVideoItem) => ({
    account_id: account.id,
    video_id: video.id,
    title: video.snippet.title,
    published_at: video.snippet.publishedAt,
    view_count: parseInt(video.statistics.viewCount || "0"),
    like_count: parseInt(video.statistics.likeCount || "0"),
    comment_count: parseInt(video.statistics.commentCount || "0"),
    duration: video.contentDetails.duration,
    thumbnail_url: video.snippet.thumbnails.medium.url,
    collected_at: now,
  }));

  const { error: videosError } = await supabase
    .from("dash_gestao_youtube_video_snapshots")
    .insert(videoRows);

  if (videosError) throw new Error(`Videos insert error: ${videosError.message}`);

  return { channelRecords: 1, videoRecords: videoRows.length };
}
```

- [ ] **Step 2: Reescrever o service do Instagram**

```typescript
// src/lib/services/instagram.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, InstagramCredentials } from "@/types/accounts";

const IG_API_BASE = "https://graph.facebook.com/v21.0";

async function igGet(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
) {
  const url = new URL(`${IG_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectInstagram(account: Account): Promise<{
  profileRecords: number;
  mediaRecords: number;
}> {
  const { access_token, user_id } = account.credentials as InstagramCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  // 1. Fetch profile data
  const profile = await igGet(
    user_id,
    { fields: "followers_count,follows_count,media_count" },
    access_token
  );

  // 2. Fetch profile insights (impressions, reach) — last 28 days
  let impressions = 0;
  let reach = 0;
  try {
    const insights = await igGet(
      `${user_id}/insights`,
      {
        metric: "impressions,reach",
        period: "day",
        since: String(Math.floor(Date.now() / 1000) - 28 * 86400),
        until: String(Math.floor(Date.now() / 1000)),
      },
      access_token
    );
    for (const metric of insights.data) {
      const total = metric.values.reduce(
        (sum: number, v: { value: number }) => sum + v.value,
        0
      );
      if (metric.name === "impressions") impressions = total;
      if (metric.name === "reach") reach = total;
    }
  } catch {
    // Insights may not be available — continue with zeros
  }

  const { error: profileError } = await supabase
    .from("dash_gestao_instagram_profile_snapshots")
    .insert({
      account_id: account.id,
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
      impressions,
      reach,
      collected_at: now,
    });

  if (profileError) throw new Error(`Profile insert error: ${profileError.message}`);

  // 3. Fetch recent media (posts + reels)
  const mediaList = await igGet(
    `${user_id}/media`,
    { fields: "id,media_type,caption,permalink,timestamp", limit: "50" },
    access_token
  );

  // 4. Fetch stories
  let storyItems: Array<{
    id: string;
    media_type: string;
    caption?: string;
    permalink?: string;
    timestamp: string;
  }> = [];
  try {
    const stories = await igGet(
      `${user_id}/stories`,
      { fields: "id,media_type,caption,permalink,timestamp" },
      access_token
    );
    storyItems = (stories.data || []).map(
      (s: { id: string; media_type: string; caption?: string; permalink?: string; timestamp: string }) => ({
        ...s,
        media_type: "STORY",
      })
    );
  } catch {
    // No active stories — continue
  }

  const allMedia = [...(mediaList.data || []), ...storyItems];

  if (allMedia.length === 0) {
    return { profileRecords: 1, mediaRecords: 0 };
  }

  // 5. Fetch insights for each media item
  const mediaRows = [];
  for (const media of allMedia) {
    let like_count = 0,
      comments_count = 0,
      reachVal = 0,
      impressionsVal = 0,
      saved = 0,
      shares = 0,
      plays = 0;

    try {
      let metrics = "impressions,reach";
      if (media.media_type === "STORY") {
        metrics = "impressions,reach,replies";
      } else if (media.media_type === "REEL") {
        metrics = "impressions,reach,saved,shares,plays,likes,comments";
      } else {
        metrics = "impressions,reach,saved,likes,comments,shares";
      }

      const insightsData = await igGet(
        `${media.id}/insights`,
        { metric: metrics },
        access_token
      );

      for (const m of insightsData.data) {
        const val = m.values[0]?.value || 0;
        if (m.name === "impressions") impressionsVal = val;
        if (m.name === "reach") reachVal = val;
        if (m.name === "saved") saved = val;
        if (m.name === "shares") shares = val;
        if (m.name === "plays") plays = val;
        if (m.name === "likes") like_count = val;
        if (m.name === "comments") comments_count = val;
      }
    } catch {
      // Insights may not be available for some media
    }

    const normalizedType =
      media.media_type === "IMAGE" ? "IMAGE" :
      media.media_type === "VIDEO" ? "VIDEO" :
      media.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL" :
      media.media_type === "REEL" ? "REEL" :
      media.media_type === "STORY" ? "STORY" : "IMAGE";

    mediaRows.push({
      account_id: account.id,
      media_id: media.id,
      media_type: normalizedType,
      caption: media.caption || null,
      permalink: media.permalink || null,
      like_count,
      comments_count,
      reach: reachVal,
      impressions: impressionsVal,
      saved,
      shares,
      plays,
      published_at: media.timestamp,
      collected_at: now,
    });
  }

  const { error: mediaError } = await supabase
    .from("dash_gestao_instagram_media_snapshots")
    .insert(mediaRows);

  if (mediaError) throw new Error(`Media insert error: ${mediaError.message}`);

  return { profileRecords: 1, mediaRecords: mediaRows.length };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/youtube.ts src/lib/services/instagram.ts
git commit -m "feat: rewrite services to accept Account param instead of reading from env"
```

---

## Task 5: Cron Route Unificado

**Files:**
- Create: `src/app/api/cron/collect/route.ts`

> Nota: As rotas antigas `/api/cron/youtube` e `/api/cron/instagram` podem ser deixadas em disco mas não serão mais usadas. A nova rota unificada substitui ambas.

- [ ] **Step 1: Criar a rota de cron unificada**

```typescript
// src/app/api/cron/collect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { collectYouTube } from "@/lib/services/youtube";
import { collectInstagram } from "@/lib/services/instagram";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseServiceClient();

  // Busca todas as contas ativas
  const { data: accounts, error: accountsError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("is_active", true);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  const results: Array<{
    account_id: string;
    account_name: string;
    platform: string;
    status: "success" | "error";
    records?: number;
    error?: string;
  }> = [];

  for (const account of (accounts as Account[])) {
    const startedAt = new Date().toISOString();

    try {
      let records = 0;

      if (account.platform === "youtube") {
        const result = await collectYouTube(account);
        records = result.channelRecords + result.videoRecords;
      } else if (account.platform === "instagram") {
        const result = await collectInstagram(account);
        records = result.profileRecords + result.mediaRecords;
      }

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: account.platform,
        status: "success",
        records_collected: records,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: account.platform,
        status: "error",
        error_message: message,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      results.push({
        account_id: account.id,
        account_name: account.name,
        platform: account.platform,
        status: "error",
        error: message,
      });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/collect/route.ts
git commit -m "feat: add unified cron route that loops through all active accounts"
```

---

## Task 6: Atualizar Data API Routes

**Files:**
- Modify: `src/app/api/youtube/channel/route.ts`
- Modify: `src/app/api/youtube/videos/route.ts`
- Modify: `src/app/api/instagram/profile/route.ts`
- Modify: `src/app/api/instagram/media/route.ts`

- [ ] **Step 1: Atualizar rota youtube/channel**

```typescript
// src/app/api/youtube/channel/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_channel_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .gte("collected_at", since.toISOString())
    .order("collected_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Atualizar rota youtube/videos**

```typescript
// src/app/api/youtube/videos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  // Deduplication: latest snapshot per video_id
  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_video_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate by video_id (keep most recent snapshot per video)
  const seen = new Set<string>();
  const deduplicated = (data || []).filter((row) => {
    if (seen.has(row.video_id)) return false;
    seen.add(row.video_id);
    return true;
  });

  return NextResponse.json(deduplicated);
}
```

- [ ] **Step 3: Atualizar rota instagram/profile**

```typescript
// src/app/api/instagram/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error: dbError } = await supabase
    .from("dash_gestao_instagram_profile_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .gte("collected_at", since.toISOString())
    .order("collected_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 4: Atualizar rota instagram/media**

```typescript
// src/app/api/instagram/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const type = request.nextUrl.searchParams.get("type");

  let query = supabase
    .from("dash_gestao_instagram_media_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("media_type", type);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate by media_id (keep most recent snapshot per media)
  const seen = new Set<string>();
  const deduplicated = (data || []).filter((row) => {
    if (seen.has(row.media_id)) return false;
    seen.add(row.media_id);
    return true;
  });

  return NextResponse.json(deduplicated);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/youtube/ src/app/api/instagram/
git commit -m "feat: update data API routes to require and filter by account_id"
```

---

## Task 7: Dashboard Layout e Navegação

**Files:**
- Create: `src/components/layout/nav-links.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Criar NavLinks como client component (precisa de usePathname)**

```typescript
// src/components/layout/nav-links.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard/youtube", label: "▶ YouTube" },
  { href: "/dashboard/instagram", label: "📷 Instagram" },
  { href: "/dashboard/settings", label: "⚙ Configurações" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            pathname.startsWith(href)
              ? "bg-blue-600 text-white"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Atualizar layout do dashboard**

```typescript
// src/app/dashboard/layout.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/layout/nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">IGT Dashboard</h1>
          <NavLinks />
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-gray-500 hover:text-gray-700">
            Sair
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Redirecionar page.tsx para youtube**

```typescript
// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/dashboard/youtube");
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ src/app/dashboard/layout.tsx src/app/dashboard/page.tsx
git commit -m "feat: update dashboard layout with platform tabs navigation"
```

---

## Task 8: Página de Configurações

**Files:**
- Create: `src/components/settings/account-form.tsx`
- Create: `src/components/settings/account-list.tsx`
- Create: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Criar o formulário de conta**

```typescript
// src/components/settings/account-form.tsx
"use client";

import { useState } from "react";
import type { Account } from "@/types/accounts";

interface AccountFormProps {
  account?: Account;
  onSave: () => void;
  onCancel: () => void;
}

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const isEditing = !!account;
  const [name, setName] = useState(account?.name ?? "");
  const [platform, setPlatform] = useState<"youtube" | "instagram">(
    account?.platform ?? "youtube"
  );
  const [apiKey, setApiKey] = useState(
    isEditing && account.platform === "youtube"
      ? (account.credentials as { api_key: string }).api_key
      : ""
  );
  const [channelId, setChannelId] = useState(
    isEditing && account.platform === "youtube"
      ? (account.credentials as { channel_id: string }).channel_id
      : ""
  );
  const [accessToken, setAccessToken] = useState(
    isEditing && account.platform === "instagram"
      ? (account.credentials as { access_token: string }).access_token
      : ""
  );
  const [userId, setUserId] = useState(
    isEditing && account.platform === "instagram"
      ? (account.credentials as { user_id: string }).user_id
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const credentials =
      platform === "youtube"
        ? { api_key: apiKey, channel_id: channelId }
        : { access_token: accessToken, user_id: userId };

    try {
      const url = isEditing
        ? `/api/accounts/${account.id}`
        : "/api/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, credentials }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">
          {isEditing ? "Editar conta" : "Nova conta"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da conta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: IGT Principal"
              required
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plataforma
            </label>
            <select
              value={platform}
              onChange={(e) =>
                setPlatform(e.target.value as "youtube" | "instagram")
              }
              disabled={isEditing}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          {platform === "youtube" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel ID
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="UCxx..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {platform === "instagram" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Access Token
                </label>
                <input
                  type="text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAx..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="1234567890"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar conta"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar o componente de lista de contas**

```typescript
// src/components/settings/account-list.tsx
"use client";

import { useState } from "react";
import type { Account } from "@/types/accounts";
import { AccountForm } from "./account-form";

interface AccountListProps {
  initialAccounts: Account[];
}

const PLATFORM_ICONS: Record<string, string> = {
  youtube: "▶",
  instagram: "📷",
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube: "bg-red-100 text-red-700",
  instagram: "bg-pink-100 text-pink-700",
};

export function AccountList({ initialAccounts }: AccountListProps) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();

  async function loadAccounts() {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data);
  }

  async function toggleActive(account: Account) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !account.is_active }),
    });
    await loadAccounts();
  }

  async function deleteAccount(account: Account) {
    if (
      !confirm(
        `Remover "${account.name}"? Todos os dados coletados desta conta serão apagados permanentemente.`
      )
    )
      return;

    await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    await loadAccounts();
  }

  function handleSave() {
    setShowForm(false);
    setEditingAccount(undefined);
    loadAccounts();
  }

  const byPlatform = {
    youtube: accounts.filter((a) => a.platform === "youtube"),
    instagram: accounts.filter((a) => a.platform === "instagram"),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Contas registradas</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + Nova conta
        </button>
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          Nenhuma conta cadastrada. Clique em &ldquo;+ Nova conta&rdquo; para começar.
        </div>
      )}

      {(["youtube", "instagram"] as const).map((platform) => {
        const platformAccounts = byPlatform[platform];
        if (platformAccounts.length === 0) return null;

        return (
          <div key={platform} className="mb-8">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              {PLATFORM_ICONS[platform]} {platform === "youtube" ? "YouTube" : "Instagram"}
            </h3>
            <div className="space-y-2">
              {platformAccounts.map((account) => (
                <div
                  key={account.id}
                  className="bg-white border rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[platform]}`}
                  >
                    {PLATFORM_ICONS[platform]}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-gray-400">
                      {platform} ·{" "}
                      {account.is_active ? (
                        <span className="text-green-600">● ativo</span>
                      ) : (
                        <span className="text-gray-400">○ inativo</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      onClick={() => toggleActive(account)}
                      className="text-gray-400 hover:text-gray-700"
                    >
                      {account.is_active ? "desativar" : "ativar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingAccount(account);
                        setShowForm(true);
                      }}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => deleteAccount(account)}
                      className="text-red-400 hover:text-red-600"
                    >
                      remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {showForm && (
        <AccountForm
          account={editingAccount}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingAccount(undefined);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Criar a página de configurações**

```typescript
// src/app/dashboard/settings/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountList } from "@/components/settings/account-list";
import type { Account } from "@/types/accounts";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto p-6">
      <AccountList initialAccounts={(accounts as Account[]) ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar manualmente**

```
1. Abra http://localhost:3000/dashboard/settings
2. Clique em "+ Nova conta"
3. Preencha: nome "IGT Principal", plataforma YouTube, API Key e Channel ID reais do .env
4. Clique em "Salvar conta" — deve aparecer na lista
5. Repita para Instagram com Access Token e User ID do .env
```

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ src/app/dashboard/settings/
git commit -m "feat: add settings page with account management UI"
```

---

## Task 9: Página YouTube

**Files:**
- Create: `src/components/dashboard/account-tabs.tsx`
- Create: `src/components/dashboard/section-tabs.tsx`
- Rewrite: `src/app/dashboard/youtube/page.tsx`

- [ ] **Step 1: Criar AccountTabs**

```typescript
// src/components/dashboard/account-tabs.tsx
"use client";

import type { Account } from "@/types/accounts";

interface AccountTabsProps {
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AccountTabs({ accounts, selectedId, onSelect }: AccountTabsProps) {
  if (accounts.length === 0) return null;

  return (
    <div className="flex gap-2 px-6 py-2 border-b bg-white">
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => onSelect(account.id)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            account.id === selectedId
              ? "bg-blue-600 text-white"
              : "text-gray-500 border hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          {account.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar SectionTabs**

```typescript
// src/components/dashboard/section-tabs.tsx
"use client";

interface SectionTabsProps {
  sections: string[];
  selected: string;
  onSelect: (section: string) => void;
}

export function SectionTabs({ sections, selected, onSelect }: SectionTabsProps) {
  return (
    <div className="flex border-b bg-white px-6">
      {sections.map((section) => (
        <button
          key={section}
          onClick={() => onSelect(section)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            section === selected
              ? "border-blue-600 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {section}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Reescrever a página do YouTube**

```typescript
// src/app/dashboard/youtube/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import type { Account, ChannelSnapshot, VideoSnapshot } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vídeos", "Tendências"];

export default function YouTubePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  // Load YouTube accounts
  useEffect(() => {
    fetch("/api/accounts?platform=youtube")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, []);

  // Load data when selected account changes
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/youtube/channel?account_id=${selectedId}&days=90`).then((r) => r.json()),
      fetch(`/api/youtube/videos?account_id=${selectedId}&limit=100`).then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(Array.isArray(channel) ? channel : []);
        setVideos(Array.isArray(vids) ? vids : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const latest = channelData[channelData.length - 1];
  const previous = channelData[channelData.length - 2];

  function exportCsv() {
    const headers = "Titulo,Views,Likes,Comentarios,Duracao,Publicado\n";
    const rows = videos
      .map(
        (v) =>
          `"${v.title}",${v.view_count},${v.like_count},${v.comment_count},"${v.duration}","${v.published_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube_videos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg mb-2">Nenhuma conta YouTube cadastrada</p>
        <a href="/dashboard/settings" className="text-blue-600 text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      <AccountTabs
        accounts={accounts}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setSelectedSection("Visão Geral");
        }}
      />
      <SectionTabs
        sections={SECTIONS}
        selected={selectedSection}
        onSelect={setSelectedSection}
      />

      <div className="p-6 max-w-5xl">
        {loading && <div className="text-gray-400">Carregando...</div>}

        {!loading && selectedSection === "Visão Geral" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Inscritos"
              value={latest?.subscriber_count ?? 0}
              format="compact"
              previousValue={previous?.subscriber_count}
              currentValue={latest?.subscriber_count}
            />
            <KpiCard
              title="Views Totais"
              value={latest?.view_count ?? 0}
              format="compact"
              previousValue={previous?.view_count}
              currentValue={latest?.view_count}
            />
            <KpiCard
              title="Vídeos"
              value={latest?.video_count ?? 0}
              previousValue={previous?.video_count}
              currentValue={latest?.video_count}
            />
          </div>
        )}

        {!loading && selectedSection === "Vídeos" && (
          <DataTable
            data={videos}
            columns={[
              {
                key: "title",
                label: "Título",
                render: (_, row) => (
                  <div className="flex items-center gap-2 max-w-xs">
                    <img
                      src={row.thumbnail_url as string}
                      alt=""
                      className="w-16 h-9 object-cover rounded"
                    />
                    <span className="truncate text-sm">{row.title as string}</span>
                  </div>
                ),
              },
              { key: "view_count", label: "Views" },
              { key: "like_count", label: "Likes" },
              { key: "comment_count", label: "Comentários" },
              { key: "duration", label: "Duração" },
              {
                key: "published_at",
                label: "Publicado",
                render: (v) =>
                  v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
              },
            ]}
            onExportCsv={exportCsv}
          />
        )}

        {!loading && selectedSection === "Tendências" && channelData.length > 1 && (
          <LineChart
            data={channelData}
            xKey="collected_at"
            lines={[
              { key: "subscriber_count", color: "#ef4444", label: "Inscritos" },
              { key: "view_count", color: "#3b82f6", label: "Views Totais" },
            ]}
            height={350}
          />
        )}

        {!loading && selectedSection === "Tendências" && channelData.length <= 1 && (
          <div className="text-gray-400 py-12 text-center">
            Dados insuficientes para exibir tendências. Execute o cron pelo menos 2 vezes.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/account-tabs.tsx \
        src/components/dashboard/section-tabs.tsx \
        src/app/dashboard/youtube/page.tsx
git commit -m "feat: rebuild YouTube page with account tabs and section tabs"
```

---

## Task 10: Página Instagram

**Files:**
- Rewrite: `src/app/dashboard/instagram/page.tsx`

- [ ] **Step 1: Reescrever a página do Instagram**

```typescript
// src/app/dashboard/instagram/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import type { Account, ProfileSnapshot, MediaSnapshot } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Posts/Reels", "Tendências"];

export default function InstagramPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [media, setMedia] = useState<MediaSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  // Load Instagram accounts
  useEffect(() => {
    fetch("/api/accounts?platform=instagram")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, []);

  // Load data when selected account changes
  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/instagram/profile?account_id=${selectedId}&days=90`).then((r) => r.json()),
      fetch(`/api/instagram/media?account_id=${selectedId}&limit=100`).then((r) => r.json()),
    ])
      .then(([profile, med]) => {
        setProfileData(Array.isArray(profile) ? profile : []);
        setMedia(Array.isArray(med) ? med : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId]);

  const latest = profileData[profileData.length - 1];
  const previous = profileData[profileData.length - 2];

  function exportCsv() {
    const headers = "Tipo,Legenda,Curtidas,Comentarios,Alcance,Impressoes,Plays,Publicado\n";
    const rows = media
      .map(
        (m) =>
          `"${m.media_type}","${(m.caption ?? "").replace(/"/g, "''")}",${m.like_count},${m.comments_count},${m.reach},${m.impressions},${m.plays},"${m.published_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "instagram_media.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg mb-2">Nenhuma conta Instagram cadastrada</p>
        <a href="/dashboard/settings" className="text-blue-600 text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      <AccountTabs
        accounts={accounts}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setSelectedSection("Visão Geral");
        }}
      />
      <SectionTabs
        sections={SECTIONS}
        selected={selectedSection}
        onSelect={setSelectedSection}
      />

      <div className="p-6 max-w-5xl">
        {loading && <div className="text-gray-400">Carregando...</div>}

        {!loading && selectedSection === "Visão Geral" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Seguidores"
              value={latest?.followers_count ?? 0}
              format="compact"
              previousValue={previous?.followers_count}
              currentValue={latest?.followers_count}
            />
            <KpiCard
              title="Alcance (28d)"
              value={latest?.reach ?? 0}
              format="compact"
              previousValue={previous?.reach}
              currentValue={latest?.reach}
            />
            <KpiCard
              title="Impressões (28d)"
              value={latest?.impressions ?? 0}
              format="compact"
              previousValue={previous?.impressions}
              currentValue={latest?.impressions}
            />
          </div>
        )}

        {!loading && selectedSection === "Posts/Reels" && (
          <DataTable
            data={media}
            columns={[
              {
                key: "media_type",
                label: "Tipo",
                render: (v) => (
                  <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                    {v as string}
                  </span>
                ),
              },
              {
                key: "caption",
                label: "Legenda",
                render: (v) => (
                  <span className="text-sm text-gray-600 line-clamp-2 max-w-xs">
                    {(v as string) || "—"}
                  </span>
                ),
              },
              { key: "like_count", label: "Curtidas" },
              { key: "comments_count", label: "Comentários" },
              { key: "reach", label: "Alcance" },
              { key: "plays", label: "Plays" },
              {
                key: "published_at",
                label: "Publicado",
                render: (v) =>
                  v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
              },
            ]}
            onExportCsv={exportCsv}
          />
        )}

        {!loading && selectedSection === "Tendências" && profileData.length > 1 && (
          <LineChart
            data={profileData}
            xKey="collected_at"
            lines={[
              { key: "followers_count", color: "#e1306c", label: "Seguidores" },
              { key: "reach", color: "#f59e0b", label: "Alcance" },
              { key: "impressions", color: "#8b5cf6", label: "Impressões" },
            ]}
            height={350}
          />
        )}

        {!loading && selectedSection === "Tendências" && profileData.length <= 1 && (
          <div className="text-gray-400 py-12 text-center">
            Dados insuficientes para exibir tendências. Execute o cron pelo menos 2 vezes.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/instagram/page.tsx
git commit -m "feat: rebuild Instagram page with account tabs and section tabs"
```

---

## Task 11: Verificação End-to-End

- [ ] **Step 1: Build sem erros**

```bash
npm run build
```
Esperado: sem erros de TypeScript nem de compilação.

- [ ] **Step 2: Executar o servidor e cadastrar contas**

```bash
npm run dev
```
1. Abra http://localhost:3000 → redireciona para `/login`
2. Faça login
3. Acesse Configurações → cadastre 1 conta YouTube com as credenciais do `.env`
4. Cadastre 1 conta Instagram com as credenciais do `.env`

- [ ] **Step 3: Disparar o cron manualmente**

```bash
curl -X POST http://localhost:3000/api/cron/collect \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```
Esperado: `{"results":[{"status":"success",...},{"status":"success",...}]}`

- [ ] **Step 4: Verificar dashboard YouTube**

1. Abra `/dashboard/youtube`
2. Confirme que a sub-tab da conta aparece
3. "Visão Geral" → 3 KPI cards com valores reais
4. "Vídeos" → tabela com vídeos coletados
5. "Tendências" → mensagem de dados insuficientes (precisará de 2+ coletas)

- [ ] **Step 5: Verificar dashboard Instagram**

1. Abra `/dashboard/instagram`
2. Confirme que a sub-tab da conta aparece
3. "Visão Geral" → 3 KPI cards
4. "Posts/Reels" → tabela com mídia coletada

- [ ] **Step 6: Testar múltiplas contas**

1. Cadastre uma segunda conta YouTube (mesmo ou outro canal)
2. Confirme que aparece nova sub-tab na página YouTube
3. Alterne entre as contas e verifique que os dados mudam

- [ ] **Step 7: Testar remoção de conta**

1. Em Configurações, clique em "remover" em uma conta de teste
2. Confirme que a sub-tab desaparece do dashboard
3. (Opcional) Verifique no Supabase que os snapshots foram deletados em cascata

- [ ] **Step 8: Commit final**

```bash
git add .
git commit -m "chore: finalize multi-account dashboard first stage"
```
