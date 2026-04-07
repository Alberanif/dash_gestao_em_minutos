# YouTube Analytics API Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate YouTube data collection from Data API v3 (point-in-time snapshots) to Analytics API (daily time-series), including full OAuth2 flow, historical backfill, and incremental sync.

**Architecture:** Three new backend layers — `src/lib/youtube/auth.ts` (OAuth2 token lifecycle), `src/lib/youtube/analytics.ts` (Analytics API client), and a rewritten `src/lib/services/youtube.ts` (orchestration). The OAuth handshake happens in two new API routes (`/api/auth/youtube/connect` + `/api/auth/youtube/callback`). Three new Supabase tables replace the old snapshot tables, with `UNIQUE` constraints guaranteeing idempotent upserts.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + service_role client), Google OAuth2, YouTube Analytics API v2, YouTube Data API v3 (OAuth token — no API key), TypeScript 5, `crypto` (Node built-in HMAC).

**Verification after each task:** `npx tsc --noEmit` — must produce zero errors.

---

## File Map

| File | Action |
|---|---|
| `supabase/migrations/003_youtube_analytics.sql` | Create |
| `src/types/accounts.ts` | Modify — update `YouTubeCredentials`, add daily row types |
| `src/lib/supabase/middleware.ts` | Modify — exempt callback route from auth |
| `src/lib/youtube/auth.ts` | Create |
| `src/lib/youtube/analytics.ts` | Create |
| `src/lib/services/youtube.ts` | Rewrite |
| `src/app/api/auth/youtube/connect/route.ts` | Create |
| `src/app/api/auth/youtube/callback/route.ts` | Create |
| `src/app/api/youtube/channel/route.ts` | Rewrite |
| `src/app/api/youtube/stats/route.ts` | Create |
| `src/app/api/youtube/videos/route.ts` | Rewrite |
| `src/components/settings/account-form.tsx` | Modify — YouTube section |
| `src/app/dashboard/youtube/page.tsx` | Rewrite |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/003_youtube_analytics.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/003_youtube_analytics.sql

-- Drop old snapshot tables (data will be replaced by backfill)
drop table if exists dash_gestao_youtube_video_snapshots;
drop table if exists dash_gestao_youtube_channel_snapshots;

-- Channel daily metrics (one row per account per day)
create table dash_gestao_youtube_channel_daily (
  id                        uuid primary key default uuid_generate_v4(),
  account_id                uuid not null references dash_gestao_accounts(id) on delete cascade,
  date                      date not null,
  views                     bigint not null default 0,
  estimated_minutes_watched bigint not null default 0,
  average_view_duration     integer not null default 0,      -- seconds
  average_view_percentage   numeric(5,2) not null default 0, -- 0–100 %
  subscribers_gained        integer not null default 0,
  subscribers_lost          integer not null default 0,
  likes                     bigint not null default 0,
  comments                  bigint not null default 0,
  shares                    bigint not null default 0,
  unique (account_id, date)
);
create index idx_yt_channel_daily_account_date
  on dash_gestao_youtube_channel_daily (account_id, date desc);

-- Video metadata (fetched once, updated on new videos)
create table dash_gestao_youtube_videos (
  id            uuid primary key default uuid_generate_v4(),
  account_id    uuid not null references dash_gestao_accounts(id) on delete cascade,
  video_id      text not null,
  title         text,
  published_at  timestamptz,
  thumbnail_url text,
  duration      text,       -- ISO 8601 e.g. PT4M33S
  updated_at    timestamptz not null default now(),
  unique (account_id, video_id)
);
create index idx_yt_videos_account
  on dash_gestao_youtube_videos (account_id);

-- Video daily metrics (one row per account+video+day)
create table dash_gestao_youtube_video_daily (
  id                        uuid primary key default uuid_generate_v4(),
  account_id                uuid not null references dash_gestao_accounts(id) on delete cascade,
  video_id                  text not null,
  date                      date not null,
  views                     bigint not null default 0,
  estimated_minutes_watched bigint not null default 0,
  average_view_duration     integer not null default 0,
  average_view_percentage   numeric(5,2) not null default 0,
  likes                     bigint not null default 0,
  comments                  bigint not null default 0,
  unique (account_id, video_id, date)
);
create index idx_yt_video_daily_account_date
  on dash_gestao_youtube_video_daily (account_id, date desc);

-- RLS: enable on all new tables
alter table dash_gestao_youtube_channel_daily enable row level security;
alter table dash_gestao_youtube_videos        enable row level security;
alter table dash_gestao_youtube_video_daily   enable row level security;

create policy "Authenticated users can read youtube channel daily"
  on dash_gestao_youtube_channel_daily for select to authenticated using (true);

create policy "Authenticated users can read youtube videos"
  on dash_gestao_youtube_videos for select to authenticated using (true);

create policy "Authenticated users can read youtube video daily"
  on dash_gestao_youtube_video_daily for select to authenticated using (true);
-- Writes happen via service_role_key which bypasses RLS.
```

- [ ] **Step 2: Apply migration in Supabase**

Run this in the Supabase SQL editor or via CLI:
```bash
supabase db push
# or paste the file contents directly into the Supabase SQL editor
```

Expected: No errors. Three new tables visible in the Supabase table editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_youtube_analytics.sql
git commit -m "feat(db): add youtube analytics daily tables, drop old snapshots"
```

---

## Task 2: Update Type Definitions

**Files:**
- Modify: `src/types/accounts.ts`

- [ ] **Step 1: Replace `YouTubeCredentials` and add daily row types**

Replace the entire content of `src/types/accounts.ts` with:

```typescript
export interface YouTubeCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  channel_id: string;           // auto-detected via OAuth callback
  history_start_date: string;   // YYYY-MM-DD — backfill start
  // auto-managed by getValidAccessToken:
  access_token?: string;
  access_token_expiry?: string; // ISO timestamp
}

export interface InstagramCredentials {
  access_token: string;
  user_id: string;
}

export interface HotmartCredentials {
  client_id: string;
  client_secret: string;
}

export interface HotmartSale {
  id: string;
  account_id: string;
  transaction_code: string;
  product_id: string;
  product_name: string;
  offer_code: string | null;
  offer_name: string | null;
  status: string;
  price: number;
  currency: string;
  purchase_date: string;
  approved_date: string | null;
  buyer_email: string;
  collected_at: string;
  [key: string]: unknown;
}

export interface Account {
  id: string;
  platform: "youtube" | "instagram" | "hotmart";
  name: string;
  credentials: YouTubeCredentials | InstagramCredentials | HotmartCredentials;
  is_active: boolean;
  created_at: string;
}

// YouTube Analytics daily rows
export interface ChannelDailyRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  date: string;
  views: number;
  estimated_minutes_watched: number;
  average_view_duration: number;
  average_view_percentage: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface VideoMetadata {
  id: string;
  account_id: string;
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
}

export interface VideoAggregated extends Record<string, unknown> {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
  total_views: number;
  total_watch_min: number;
  avg_view_percentage: number;
  avg_view_duration: number;
  total_likes: number;
  total_comments: number;
}

// Instagram (unchanged)
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

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: Errors only in files that used the old `ChannelSnapshot`/`VideoSnapshot` types (those will be fixed in later tasks). Zero errors in `src/types/accounts.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/types/accounts.ts
git commit -m "feat(types): update YouTubeCredentials for OAuth2, add daily row types"
```

---

## Task 3: Middleware Exemption

**Files:**
- Modify: `src/lib/supabase/middleware.ts`

The OAuth callback route is called by Google's redirect — it has no user session. It must be exempt from the auth redirect.

- [ ] **Step 1: Add callback to the exemption list**

In `src/lib/supabase/middleware.ts`, change line 33–36 from:
```typescript
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api/cron")
  ) {
```

To:
```typescript
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api/cron") &&
    !request.nextUrl.pathname.startsWith("/api/auth/youtube/callback")
  ) {
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "fix(middleware): exempt youtube oauth callback from auth redirect"
```

---

## Task 4: OAuth2 Auth Layer

**Files:**
- Create: `src/lib/youtube/auth.ts`

- [ ] **Step 1: Create the auth module**

```typescript
// src/lib/youtube/auth.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, YouTubeCredentials } from "@/types/accounts";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function buildOAuthUrl(accountId: string, state: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/yt-analytics.readonly",
    "https://www.googleapis.com/auth/youtube.readonly",
  ].join(" ");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set(
    "redirect_uri",
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/youtube/callback`
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forces refresh_token issuance
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function detectChannelId(accessToken: string): Promise<string> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set("mine", "true");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Channel detection failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const channelId = data.items?.[0]?.id;
  if (!channelId) throw new Error("No YouTube channel found for this Google account");
  return channelId;
}

export async function getValidAccessToken(account: Account): Promise<string> {
  const creds = account.credentials as YouTubeCredentials;

  // Return current token if valid for at least 5 more minutes
  if (creds.access_token && creds.access_token_expiry) {
    const expiresAt = new Date(creds.access_token_expiry).getTime();
    if (expiresAt - Date.now() > 5 * 60 * 1000) {
      return creds.access_token;
    }
  }

  // Refresh
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  // Persist updated tokens
  const supabase = createSupabaseServiceClient();
  await supabase
    .from("dash_gestao_accounts")
    .update({
      credentials: {
        ...creds,
        access_token: data.access_token,
        access_token_expiry: newExpiry,
      },
    })
    .eq("id", account.id);

  return data.access_token as string;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/youtube/auth.ts
git commit -m "feat(youtube): add OAuth2 auth layer (token refresh, PKCE helpers)"
```

---

## Task 5: Analytics Engine

**Files:**
- Create: `src/lib/youtube/analytics.ts`

- [ ] **Step 1: Create the analytics module**

```typescript
// src/lib/youtube/analytics.ts

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";
const DATA_API_BASE = "https://www.googleapis.com/youtube/v3";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Transform columnar API response into array of typed objects
function columnarToObjects(
  data: { columnHeaders?: { name: string }[]; rows?: unknown[][] }
): Record<string, unknown>[] {
  if (!data.rows || !data.columnHeaders) return [];
  const keys = data.columnHeaders.map((h) => h.name);
  return data.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    keys.forEach((key, i) => {
      obj[key] = row[i];
    });
    return obj;
  });
}

// Split a date range into chunks of at most 365 days
function chunkDateRange(
  start: string,
  end: string
): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + 364);
    const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;
    chunks.push({
      start: current.toISOString().slice(0, 10),
      end: actualEnd.toISOString().slice(0, 10),
    });
    current = new Date(actualEnd);
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}

async function analyticsGet(
  accessToken: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const url = new URL(ANALYTICS_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Analytics API (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export interface ChannelDailyApiRow {
  date: string;
  views: number;
  estimated_minutes_watched: number;
  average_view_duration: number;
  average_view_percentage: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface VideoDailyApiRow {
  video_id: string;
  date: string;
  views: number;
  estimated_minutes_watched: number;
  average_view_duration: number;
  average_view_percentage: number;
  likes: number;
  comments: number;
}

export interface VideoMetadataApiRow {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
}

export async function queryChannelDaily(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
): Promise<ChannelDailyApiRow[]> {
  const chunks = chunkDateRange(startDate, endDate);
  const allRows: ChannelDailyApiRow[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const data = await analyticsGet(accessToken, {
      ids: `channel==${channelId}`,
      startDate: chunk.start,
      endDate: chunk.end,
      metrics:
        "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
        "subscribersGained,subscribersLost,likes,comments,shares",
      dimensions: "day",
    });

    const rows = columnarToObjects(data);
    for (const r of rows) {
      allRows.push({
        date: r.day as string,
        views: Number(r.views ?? 0),
        estimated_minutes_watched: Number(r.estimatedMinutesWatched ?? 0),
        average_view_duration: Number(r.averageViewDuration ?? 0),
        average_view_percentage: Number(r.averageViewPercentage ?? 0),
        subscribers_gained: Number(r.subscribersGained ?? 0),
        subscribers_lost: Number(r.subscribersLost ?? 0),
        likes: Number(r.likes ?? 0),
        comments: Number(r.comments ?? 0),
        shares: Number(r.shares ?? 0),
      });
    }

    if (i < chunks.length - 1) await sleep(200);
  }

  return allRows;
}

export async function queryVideoDaily(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
): Promise<VideoDailyApiRow[]> {
  const chunks = chunkDateRange(startDate, endDate);
  const allRows: VideoDailyApiRow[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let pageToken: string | undefined;

    do {
      const params: Record<string, string> = {
        ids: `channel==${channelId}`,
        startDate: chunk.start,
        endDate: chunk.end,
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments",
        dimensions: "video,day",
        maxResults: "200",
      };
      if (pageToken) params.pageToken = pageToken;

      const data = await analyticsGet(accessToken, params);
      const rows = columnarToObjects(data);

      for (const r of rows) {
        allRows.push({
          video_id: r.video as string,
          date: r.day as string,
          views: Number(r.views ?? 0),
          estimated_minutes_watched: Number(r.estimatedMinutesWatched ?? 0),
          average_view_duration: Number(r.averageViewDuration ?? 0),
          average_view_percentage: Number(r.averageViewPercentage ?? 0),
          likes: Number(r.likes ?? 0),
          comments: Number(r.comments ?? 0),
        });
      }

      pageToken = (data.nextPageToken as string) ?? undefined;
      if (pageToken) await sleep(200);
    } while (pageToken);

    if (i < chunks.length - 1) await sleep(200);
  }

  return allRows;
}

export async function fetchVideoMetadata(
  accessToken: string,
  videoIds: string[]
): Promise<VideoMetadataApiRow[]> {
  if (videoIds.length === 0) return [];

  const results: VideoMetadataApiRow[] = [];
  // Data API v3 accepts max 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL(`${DATA_API_BASE}/videos`);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", chunk.join(","));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Data API (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      results.push({
        video_id: item.id as string,
        title: item.snippet.title as string,
        published_at: item.snippet.publishedAt as string,
        thumbnail_url:
          (item.snippet.thumbnails?.medium?.url as string) ?? "",
        duration: item.contentDetails.duration as string,
      });
    }
    if (i + 50 < videoIds.length) await sleep(100);
  }

  return results;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/youtube/analytics.ts
git commit -m "feat(youtube): add analytics engine (channel/video daily queries, video metadata)"
```

---

## Task 6: Rewrite Collection Service

**Files:**
- Rewrite: `src/lib/services/youtube.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// src/lib/services/youtube.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/youtube/auth";
import {
  queryChannelDaily,
  queryVideoDaily,
  fetchVideoMetadata,
} from "@/lib/youtube/analytics";
import type { Account, YouTubeCredentials } from "@/types/accounts";

async function detectSyncRange(
  account: Account
): Promise<{ start: string; end: string }> {
  const creds = account.credentials as YouTubeCredentials;
  const today = new Date().toISOString().slice(0, 10);
  const supabase = createSupabaseServiceClient();

  const { data } = await supabase
    .from("dash_gestao_youtube_channel_daily")
    .select("date")
    .eq("account_id", account.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    // No existing data → full backfill from history_start_date
    return { start: creds.history_start_date, end: today };
  }

  // Incremental: re-fetch last 3 days to cover the data stabilisation window
  const lastDate = new Date(data.date);
  lastDate.setDate(lastDate.getDate() - 3);
  return { start: lastDate.toISOString().slice(0, 10), end: today };
}

export async function collectYouTube(account: Account): Promise<{
  channelRecords: number;
  videoRecords: number;
}> {
  const creds = account.credentials as YouTubeCredentials;
  const supabase = createSupabaseServiceClient();

  // 1. Ensure we have a valid access token (refreshes automatically if needed)
  const accessToken = await getValidAccessToken(account);

  // 2. Determine what date range to collect
  const syncRange = await detectSyncRange(account);

  // 3. Collect channel-level daily metrics
  const channelRows = await queryChannelDaily(
    accessToken,
    creds.channel_id,
    syncRange.start,
    syncRange.end
  );

  // 4. Collect video-level daily metrics
  const videoRows = await queryVideoDaily(
    accessToken,
    creds.channel_id,
    syncRange.start,
    syncRange.end
  );

  // 5. Fetch metadata only for video_ids not yet in the videos table
  if (videoRows.length > 0) {
    const allVideoIds = [...new Set(videoRows.map((r) => r.video_id))];

    const { data: existing } = await supabase
      .from("dash_gestao_youtube_videos")
      .select("video_id")
      .eq("account_id", account.id)
      .in("video_id", allVideoIds);

    const existingSet = new Set((existing ?? []).map((v) => v.video_id));
    const newVideoIds = allVideoIds.filter((id) => !existingSet.has(id));

    if (newVideoIds.length > 0) {
      const metadata = await fetchVideoMetadata(accessToken, newVideoIds);
      if (metadata.length > 0) {
        const { error } = await supabase
          .from("dash_gestao_youtube_videos")
          .upsert(
            metadata.map((m) => ({
              account_id: account.id,
              video_id: m.video_id,
              title: m.title,
              published_at: m.published_at,
              thumbnail_url: m.thumbnail_url,
              duration: m.duration,
            })),
            { onConflict: "account_id,video_id" }
          );
        if (error) throw new Error(`Video metadata upsert: ${error.message}`);
      }
    }
  }

  // 6. Upsert channel daily metrics (idempotent via UNIQUE on account_id, date)
  if (channelRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_youtube_channel_daily")
      .upsert(
        channelRows.map((r) => ({ account_id: account.id, ...r })),
        { onConflict: "account_id,date" }
      );
    if (error) throw new Error(`Channel daily upsert: ${error.message}`);
  }

  // 7. Upsert video daily metrics
  if (videoRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_youtube_video_daily")
      .upsert(
        videoRows.map((r) => ({ account_id: account.id, ...r })),
        { onConflict: "account_id,video_id,date" }
      );
    if (error) throw new Error(`Video daily upsert: ${error.message}`);
  }

  return {
    channelRecords: channelRows.length,
    videoRecords: videoRows.length,
  };
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/youtube.ts
git commit -m "feat(youtube): rewrite collection service using analytics engine"
```

---

## Task 7: OAuth Connect Route

**Files:**
- Create: `src/app/api/auth/youtube/connect/route.ts`

- [ ] **Step 1: Create the connect route**

```typescript
// src/app/api/auth/youtube/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildOAuthUrl } from "@/lib/youtube/auth";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id obrigatório" }, { status: 400 });
  }

  // Verify this account exists and is a YouTube account
  const supabase = createSupabaseServiceClient();
  const { data: account } = await supabase
    .from("dash_gestao_accounts")
    .select("id, platform")
    .eq("id", accountId)
    .eq("platform", "youtube")
    .maybeSingle();

  if (!account) {
    return NextResponse.json(
      { error: "Conta YouTube não encontrada" },
      { status: 404 }
    );
  }

  // Generate HMAC state for CSRF protection (reuses CRON_SECRET as signing key)
  const state = createHmac("sha256", process.env.CRON_SECRET!)
    .update(accountId)
    .digest("hex");

  const oauthUrl = buildOAuthUrl(accountId, state);

  // Store account_id in a short-lived httpOnly cookie for the callback
  const response = NextResponse.redirect(oauthUrl);
  response.cookies.set("yt_oauth_account_id", accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
    sameSite: "lax", // must be lax (not strict) for top-level redirects from Google
    path: "/",
  });
  return response;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/youtube/connect/route.ts
git commit -m "feat(youtube): add OAuth connect route"
```

---

## Task 8: OAuth Callback Route

**Files:**
- Create: `src/app/api/auth/youtube/callback/route.ts`

- [ ] **Step 1: Create the callback route**

```typescript
// src/app/api/auth/youtube/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, detectChannelId } from "@/lib/youtube/auth";
import type { YouTubeCredentials } from "@/types/accounts";

const SETTINGS_URL = "/dashboard/settings";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_missing_params`, request.url)
    );
  }

  // Recover account_id from short-lived cookie set during /connect
  const accountId = request.cookies.get("yt_oauth_account_id")?.value;
  if (!accountId) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_session_expired`, request.url)
    );
  }

  // Validate HMAC state to prevent CSRF
  const expectedState = createHmac("sha256", process.env.CRON_SECRET!)
    .update(accountId)
    .digest("hex");

  if (state !== expectedState) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=oauth_invalid_state`, request.url)
    );
  }

  const supabase = createSupabaseServiceClient();

  // Load existing credentials — client_id, client_secret, history_start_date
  // were saved by the settings form before redirecting to /connect
  const { data: account } = await supabase
    .from("dash_gestao_accounts")
    .select("credentials")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=account_not_found`, request.url)
    );
  }

  const existingCreds = account.credentials as Partial<YouTubeCredentials>;

  try {
    // Exchange authorisation code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      existingCreds.client_id!,
      existingCreds.client_secret!
    );

    // Auto-detect channel_id using the fresh access_token
    const channelId = await detectChannelId(tokens.access_token);

    const newExpiry = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    // Persist all credentials
    await supabase
      .from("dash_gestao_accounts")
      .update({
        credentials: {
          ...existingCreds,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expiry: newExpiry,
          channel_id: channelId,
        } as YouTubeCredentials,
      })
      .eq("id", accountId);

    const response = NextResponse.redirect(
      new URL(`${SETTINGS_URL}?connected=${encodeURIComponent(channelId)}`, request.url)
    );
    response.cookies.delete("yt_oauth_account_id");
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/youtube/callback/route.ts
git commit -m "feat(youtube): add OAuth callback route (token exchange + channel detection)"
```

---

## Task 9: Update Channel API Route

**Files:**
- Rewrite: `src/app/api/youtube/channel/route.ts`

- [ ] **Step 1: Replace the route to read from `channel_daily`**

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

  const startDateStr = request.nextUrl.searchParams.get("start_date");
  const endDateStr = request.nextUrl.searchParams.get("end_date");

  let query = supabase
    .from("dash_gestao_youtube_channel_daily")
    .select("*")
    .eq("account_id", accountId)
    .order("date", { ascending: true });

  if (startDateStr) query = query.gte("date", startDateStr.slice(0, 10));
  if (endDateStr) query = query.lte("date", endDateStr.slice(0, 10));

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/youtube/channel/route.ts
git commit -m "feat(youtube): channel API now reads from channel_daily table"
```

---

## Task 10: New Stats API Route

**Files:**
- Create: `src/app/api/youtube/stats/route.ts`

This route provides current absolute values (subscriber count, video count) that the Analytics API doesn't return.

- [ ] **Step 1: Create the stats route**

```typescript
// src/app/api/youtube/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/youtube/auth";
import type { Account, YouTubeCredentials } from "@/types/accounts";

// Simple in-process cache: avoids hammering Data API on every page load
const cache = new Map<string, { data: { subscriber_count: number; video_count: number }; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  // Return cached result if still fresh (1 hour)
  const cached = cache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const supabase = createSupabaseServiceClient();
  const { data: account } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const creds = account.credentials as YouTubeCredentials;

  try {
    const accessToken = await getValidAccessToken(account as Account);

    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "statistics");
    url.searchParams.set("id", creds.channel_id);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Data API (${res.status}): ${await res.text()}`);
    }

    const json = await res.json();
    const stats = json.items?.[0]?.statistics ?? {};

    const result = {
      subscriber_count: parseInt(stats.subscriberCount ?? "0"),
      video_count: parseInt(stats.videoCount ?? "0"),
    };

    cache.set(accountId, { data: result, expiresAt: Date.now() + 3_600_000 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/youtube/stats/route.ts
git commit -m "feat(youtube): add stats route for subscriber/video count from Data API v3"
```

---

## Task 11: Update Videos API Route

**Files:**
- Rewrite: `src/app/api/youtube/videos/route.ts`

- [ ] **Step 1: Replace the route to aggregate `video_daily` joined with `videos`**

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

  const startDate = request.nextUrl.searchParams.get("start_date")?.slice(0, 10);
  const endDate = request.nextUrl.searchParams.get("end_date")?.slice(0, 10);

  // Fetch daily rows in the requested period
  let metricsQuery = supabase
    .from("dash_gestao_youtube_video_daily")
    .select(
      "video_id, views, estimated_minutes_watched, average_view_duration, average_view_percentage, likes, comments"
    )
    .eq("account_id", accountId);

  if (startDate) metricsQuery = metricsQuery.gte("date", startDate);
  if (endDate) metricsQuery = metricsQuery.lte("date", endDate);

  const { data: dailyRows, error: dailyError } = await metricsQuery;
  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 });
  }

  if (!dailyRows || dailyRows.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch metadata for the video_ids that appear in the period
  const videoIds = [...new Set(dailyRows.map((r) => r.video_id))];
  const { data: metaRows, error: metaError } = await supabase
    .from("dash_gestao_youtube_videos")
    .select("video_id, title, published_at, thumbnail_url, duration")
    .eq("account_id", accountId)
    .in("video_id", videoIds);

  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }

  const metaMap = new Map(
    (metaRows ?? []).map((m) => [m.video_id, m])
  );

  // Aggregate daily rows by video_id
  const videoMap = new Map<
    string,
    {
      video_id: string;
      title: string;
      published_at: string;
      thumbnail_url: string;
      duration: string;
      total_views: number;
      total_watch_min: number;
      sum_view_pct: number;
      sum_view_dur: number;
      total_likes: number;
      total_comments: number;
      days_count: number;
    }
  >();

  for (const row of dailyRows) {
    const meta = metaMap.get(row.video_id);
    if (!videoMap.has(row.video_id)) {
      videoMap.set(row.video_id, {
        video_id: row.video_id,
        title: meta?.title ?? row.video_id,
        published_at: meta?.published_at ?? "",
        thumbnail_url: meta?.thumbnail_url ?? "",
        duration: meta?.duration ?? "",
        total_views: 0,
        total_watch_min: 0,
        sum_view_pct: 0,
        sum_view_dur: 0,
        total_likes: 0,
        total_comments: 0,
        days_count: 0,
      });
    }
    const v = videoMap.get(row.video_id)!;
    v.total_views += Number(row.views ?? 0);
    v.total_watch_min += Number(row.estimated_minutes_watched ?? 0);
    v.sum_view_pct += Number(row.average_view_percentage ?? 0);
    v.sum_view_dur += Number(row.average_view_duration ?? 0);
    v.total_likes += Number(row.likes ?? 0);
    v.total_comments += Number(row.comments ?? 0);
    v.days_count += 1;
  }

  const videos = Array.from(videoMap.values())
    .map((v) => ({
      video_id: v.video_id,
      title: v.title,
      published_at: v.published_at,
      thumbnail_url: v.thumbnail_url,
      duration: v.duration,
      total_views: v.total_views,
      total_watch_min: v.total_watch_min,
      avg_view_percentage:
        v.days_count > 0 ? v.sum_view_pct / v.days_count : 0,
      avg_view_duration:
        v.days_count > 0 ? v.sum_view_dur / v.days_count : 0,
      total_likes: v.total_likes,
      total_comments: v.total_comments,
    }))
    .sort((a, b) => b.total_views - a.total_views);

  return NextResponse.json(videos);
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/youtube/videos/route.ts
git commit -m "feat(youtube): videos API aggregates video_daily with metadata join"
```

---

## Task 12: Update Account Form (Settings UI)

**Files:**
- Modify: `src/components/settings/account-form.tsx`

The YouTube section changes from `{api_key, channel_id}` fields to `{client_id, client_secret, history_start_date}` + an OAuth connect button. The form saves credentials first, then redirects to the connect route.

- [ ] **Step 1: Replace the full file**

```typescript
// src/components/settings/account-form.tsx
"use client";

import { useState } from "react";
import type { Account, YouTubeCredentials } from "@/types/accounts";

interface AccountFormProps {
  account?: Account;
  onSave: () => void;
  onCancel: () => void;
}

export function AccountForm({ account, onSave, onCancel }: AccountFormProps) {
  const isEditing = !!account;
  const [name, setName] = useState(account?.name ?? "");
  const [platform, setPlatform] = useState<"youtube" | "instagram" | "hotmart">(
    account?.platform ?? "youtube"
  );

  // YouTube OAuth fields
  const ytCreds = isEditing && account.platform === "youtube"
    ? (account.credentials as YouTubeCredentials)
    : null;
  const [ytClientId, setYtClientId] = useState(ytCreds?.client_id ?? "");
  const [ytClientSecret, setYtClientSecret] = useState(ytCreds?.client_secret ?? "");
  const [ytHistoryStart, setYtHistoryStart] = useState(
    ytCreds?.history_start_date ?? new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString().slice(0, 10)
  );

  // Instagram fields
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

  // Hotmart fields
  const [hmClientId, setHmClientId] = useState(
    isEditing && account.platform === "hotmart"
      ? (account.credentials as { client_id: string }).client_id
      : ""
  );
  const [hmClientSecret, setHmClientSecret] = useState(
    isEditing && account.platform === "hotmart"
      ? (account.credentials as { client_secret: string }).client_secret
      : ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildCredentials() {
    if (platform === "youtube") {
      return { client_id: ytClientId, client_secret: ytClientSecret, history_start_date: ytHistoryStart };
    }
    if (platform === "instagram") {
      return { access_token: accessToken, user_id: userId };
    }
    return { client_id: hmClientId, client_secret: hmClientSecret };
  }

  // Save account and redirect to Google OAuth
  async function handleYouTubeConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/accounts/${account.id}` : "/api/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, credentials: buildCredentials() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      const saved = await res.json();
      const savedId = isEditing ? account.id : saved.id;

      // Redirect to OAuth flow (full page navigation)
      window.location.href = `/api/auth/youtube/connect?account_id=${savedId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setSaving(false);
    }
  }

  // Save account normally (Instagram/Hotmart)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/accounts/${account.id}` : "/api/accounts";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform, credentials: buildCredentials() }),
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

  const isYouTubeConnected =
    isEditing && account.platform === "youtube" && !!ytCreds?.channel_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-semibold mb-4">
          {isEditing ? "Editar conta" : "Nova conta"}
        </h3>

        <form
          onSubmit={platform === "youtube" ? handleYouTubeConnect : handleSave}
          className="space-y-4"
        >
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
                setPlatform(e.target.value as "youtube" | "instagram" | "hotmart")
              }
              disabled={isEditing}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="hotmart">Hotmart</option>
            </select>
          </div>

          {/* YouTube OAuth fields */}
          {platform === "youtube" && (
            <>
              {isYouTubeConnected && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <span>●</span>
                  <span>Conectado — canal: {ytCreds?.channel_id}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Client ID
                </label>
                <input
                  type="text"
                  value={ytClientId}
                  onChange={(e) => setYtClientId(e.target.value)}
                  placeholder="123456789-abc....apps.googleusercontent.com"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Client Secret
                </label>
                <input
                  type="password"
                  value={ytClientSecret}
                  onChange={(e) => setYtClientSecret(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de início do histórico
                </label>
                <input
                  type="date"
                  value={ytHistoryStart}
                  onChange={(e) => setYtHistoryStart(e.target.value)}
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Define até onde o backfill vai buscar dados históricos.
                </p>
              </div>
            </>
          )}

          {/* Instagram fields */}
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

          {/* Hotmart fields */}
          {platform === "hotmart" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                </label>
                <input
                  type="text"
                  value={hmClientId}
                  onChange={(e) => setHmClientId(e.target.value)}
                  placeholder="Ex: a1b2c3d4-..."
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={hmClientSecret}
                  onChange={(e) => setHmClientSecret(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? "Salvando..."
                : platform === "youtube"
                ? isYouTubeConnected
                  ? "Reconectar com Google"
                  : "Salvar e Conectar com Google"
                : "Salvar conta"}
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

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/account-form.tsx
git commit -m "feat(settings): update YouTube form to OAuth2 (client_id, history_start_date, connect button)"
```

---

## Task 13: Rewrite YouTube Dashboard Page

**Files:**
- Rewrite: `src/app/dashboard/youtube/page.tsx`

- [ ] **Step 1: Replace the entire page**

```typescript
// src/app/dashboard/youtube/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AccountTabs } from "@/components/dashboard/account-tabs";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonCard, SkeletonChart, SkeletonTable } from "@/components/ui/skeleton";
import type { Account, ChannelDailyRow, VideoAggregated } from "@/types/accounts";

const SECTIONS = ["Visão Geral", "Vídeos"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseIsoDuration(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return iso;
  const h = parseInt(m[1] ?? "0");
  const min = parseInt(m[2] ?? "0");
  const sec = parseInt(m[3] ?? "0");
  if (h > 0) return `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatCompact(n: number): string {
  return Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

// SVG icons (unchanged from original)
const IconUsers = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconEye = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IconVideo = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
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
const IconClock = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconTrendingUp = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

interface ChannelStats {
  subscriber_count: number;
  video_count: number;
}

export default function YouTubePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedSection, setSelectedSection] = useState("Visão Geral");
  const [channelData, setChannelData] = useState<ChannelDailyRow[]>([]);
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [videos, setVideos] = useState<VideoAggregated[]>([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [appliedStart, setAppliedStart] = useState(daysAgo(30));
  const [appliedEnd, setAppliedEnd] = useState(today());

  function applyDateFilter() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  useEffect(() => {
    fetch("/api/accounts?platform=youtube")
      .then((r) => r.json())
      .then((accs: Account[]) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedId(accs[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    setChannelData([]);
    setChannelStats(null);
    setVideos([]);

    const params = new URLSearchParams({
      account_id: selectedId,
      start_date: appliedStart,
      end_date: appliedEnd,
    });

    Promise.all([
      fetch(`/api/youtube/channel?${params}`).then((r) => r.json()),
      fetch(`/api/youtube/stats?account_id=${selectedId}`).then((r) => r.json()),
      fetch(`/api/youtube/videos?${params}`).then((r) => r.json()),
    ])
      .then(([daily, stats, vids]) => {
        setChannelData(Array.isArray(daily) ? daily : []);
        setChannelStats(stats?.subscriber_count != null ? stats : null);
        setVideos(Array.isArray(vids) ? vids : []);
      })
      .finally(() => setLoading(false));
  }, [selectedId, appliedStart, appliedEnd]);

  // Aggregate period metrics from daily rows
  const periodViews = channelData.reduce((s, d) => s + d.views, 0);
  const periodWatchMin = channelData.reduce((s, d) => s + d.estimated_minutes_watched, 0);
  const netSubsChange = channelData.reduce(
    (s, d) => s + d.subscribers_gained - d.subscribers_lost,
    0
  );
  const avgRetention =
    channelData.length > 0
      ? channelData.reduce((s, d) => s + d.average_view_percentage, 0) / channelData.length
      : 0;
  const avgViewDuration =
    channelData.length > 0
      ? channelData.reduce((s, d) => s + d.average_view_duration, 0) / channelData.length
      : 0;

  function exportCsv() {
    const headers = "Titulo,Views,RetencaoMedia%,DuracaoMediaVis,WatchMin,Likes,Comentarios,Publicado\n";
    const rows = videos
      .map((v) =>
        [
          `"${v.title}"`,
          v.total_views,
          v.avg_view_percentage.toFixed(2),
          `"${formatSeconds(v.avg_view_duration)}"`,
          v.total_watch_min,
          v.total_likes,
          v.total_comments,
          `"${v.published_at}"`,
        ].join(",")
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
      <div className="flex flex-col items-center justify-center h-64" style={{ color: "var(--color-text-muted)" }}>
        <p className="text-lg mb-2">Nenhuma conta YouTube cadastrada</p>
        <a href="/dashboard/settings" style={{ color: "var(--color-primary)" }} className="text-sm hover:underline">
          Cadastrar conta em Configurações →
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>YouTube</h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Métricas e desempenho do canal</p>
      </div>

      {/* Account tabs */}
      <div className="px-8 pt-4">
        <AccountTabs
          accounts={accounts}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setSelectedSection("Visão Geral");
          }}
        />
      </div>

      {/* Date range filter */}
      <div className="px-8 pt-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>De:</span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>Até:</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={applyDateFilter}
          className="px-4 py-1.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--color-primary)" }}
        >
          Aplicar
        </button>
      </div>

      {/* Section tabs */}
      <div className="px-8 pt-4">
        <SectionTabs sections={SECTIONS} selected={selectedSection} onSelect={setSelectedSection} />
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* === VISÃO GERAL === */}
        {selectedSection === "Visão Geral" && (
          <>
            {loading ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
                </div>
                <SkeletonChart />
              </>
            ) : (
              <>
                {/* Primary KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard
                    title="Inscritos (Total)"
                    value={channelStats?.subscriber_count ?? 0}
                    format="compact"
                    icon={IconUsers}
                    accentColor="#2563EB"
                  />
                  <KpiCard
                    title="Views no Período"
                    value={periodViews}
                    format="compact"
                    icon={IconEye}
                    accentColor="#7C3AED"
                    sparklineData={channelData.map((d) => d.views)}
                  />
                  <KpiCard
                    title="Watch Time (min)"
                    value={formatCompact(periodWatchMin)}
                    icon={IconVideo}
                    accentColor="#0EA5E9"
                    sparklineData={channelData.map((d) => d.estimated_minutes_watched)}
                  />
                </div>

                {/* Secondary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard
                    title="Retenção Média"
                    value={`${avgRetention.toFixed(2)}%`}
                    icon={IconThumbUp}
                    accentColor="#16A34A"
                  />
                  <KpiCard
                    title="Duração Média Vis."
                    value={formatSeconds(avgViewDuration)}
                    icon={IconClock}
                    accentColor="#0EA5E9"
                  />
                  <KpiCard
                    title="Inscritos Ganhos"
                    value={netSubsChange >= 0 ? `+${formatCompact(netSubsChange)}` : formatCompact(netSubsChange)}
                    icon={IconTrendingUp}
                    accentColor={netSubsChange >= 0 ? "#16A34A" : "#DC2626"}
                  />
                  <KpiCard
                    title="Vídeos Publicados"
                    value={channelStats?.video_count ?? 0}
                    icon={IconVideo}
                    accentColor="#D97706"
                  />
                </div>

                {/* Chart */}
                {channelData.length > 1 ? (
                  <LineChart
                    data={channelData}
                    xKey="date"
                    lines={[
                      { key: "views", color: "#2563EB", label: "Views" },
                      { key: "estimated_minutes_watched", color: "#7C3AED", label: "Watch Time (min)" },
                    ]}
                    height={280}
                    title="Evolução Diária do Canal"
                    subtitle="Views e watch time no período selecionado"
                    hideRangeSelector={true}
                  />
                ) : (
                  <div
                    className="rounded-[10px] p-8 text-center text-sm"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "white" }}
                  >
                    Sem dados para o período. Execute a sincronização no painel Dados.
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === VÍDEOS === */}
        {selectedSection === "Vídeos" && (
          <>
            {loading ? (
              <SkeletonTable />
            ) : (
              <DataTable<VideoAggregated>
                data={videos}
                columns={[
                  {
                    key: "title",
                    label: "Título",
                    render: (_, row) => (
                      <div className="flex items-center gap-3 min-w-[220px]">
                        {row.thumbnail_url && (
                          <img
                            src={row.thumbnail_url as string}
                            alt=""
                            className="rounded flex-shrink-0 object-cover"
                            style={{ width: 72, height: 40 }}
                            loading="lazy"
                          />
                        )}
                        <span className="text-sm font-medium line-clamp-2" style={{ color: "var(--color-text)" }}>
                          {row.title as string}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "total_views",
                    label: "Views",
                    render: (v) => (
                      <span className="text-sm font-medium tabular-nums">
                        {formatCompact(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "avg_view_percentage",
                    label: "Retenção",
                    render: (v) => (
                      <span className="text-sm tabular-nums font-medium" style={{ color: "var(--color-text)" }}>
                        {(v as number).toFixed(1)}%
                      </span>
                    ),
                  },
                  {
                    key: "avg_view_duration",
                    label: "Duração Média Vis.",
                    render: (v) => (
                      <span className="text-sm font-mono tabular-nums">
                        {formatSeconds(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "total_watch_min",
                    label: "Watch Time (min)",
                    render: (v) => (
                      <span className="text-sm tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        {formatCompact(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "total_likes",
                    label: "Likes",
                    render: (v) => (
                      <span className="text-sm tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                        {formatCompact(v as number)}
                      </span>
                    ),
                  },
                  {
                    key: "duration",
                    label: "Duração",
                    render: (v) => (
                      <span className="text-sm font-mono tabular-nums">
                        {parseIsoDuration(v as string)}
                      </span>
                    ),
                  },
                  {
                    key: "published_at",
                    label: "Publicado",
                    render: (v) =>
                      v ? (
                        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                          {new Date(v as string).toLocaleDateString("pt-BR")}
                        </span>
                      ) : "—",
                  },
                ]}
                onExportCsv={exportCsv}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: **Zero errors across the entire project.**

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/youtube/page.tsx
git commit -m "feat(dashboard): update YouTube page for Analytics API daily metrics"
```

---

## Task 14: Environment Variables

- [ ] **Step 1: Add required env vars to `.env.local`**

Add the following keys (do **not** commit the actual values):

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

For production (Vercel), set `NEXT_PUBLIC_BASE_URL` to the actual deployed domain.

- [ ] **Step 2: Verify the dev server starts**

```bash
npm run dev
```

Expected: No startup errors.

---

## Verification Checklist (End-to-End)

After all tasks are complete:

- [ ] Navigate to `/dashboard/settings` → YouTube account form shows "Google Client ID", "Client Secret", date picker (no `api_key` or `channel_id` fields)
- [ ] Fill form and click "Salvar e Conectar com Google" → page redirects to Google consent screen
- [ ] Authorize → redirected to `/dashboard/settings?connected=UCxxx`, status badge shows "● Conectado"
- [ ] Open Supabase → `dash_gestao_youtube_channel_daily` and `dash_gestao_youtube_video_daily` tables exist
- [ ] Trigger manual sync via painel Dados → cron log shows success, channel_daily rows appear
- [ ] Check second sync → row count changes by ~3 days of data (incremental), no duplicates
- [ ] Navigate to `/dashboard/youtube` → KPIs show "Views no Período", "Retenção Média", "Watch Time"
- [ ] Chart shows daily curve (multiple data points)
- [ ] Videos table shows `avg_view_percentage`, `avg_view_duration`, `total_watch_min` columns
- [ ] `/api/auth/youtube/connect` without login → redirected to `/login`
- [ ] `/api/auth/youtube/callback?code=x&state=bad` → redirected to settings with `?error=oauth_invalid_state`
