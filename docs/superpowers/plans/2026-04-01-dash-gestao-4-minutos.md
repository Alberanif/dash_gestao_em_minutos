# Dashboard "Gestao em 4 Minutos" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a management dashboard that collects YouTube and Instagram KPIs daily via cron jobs, stores them in Supabase, and displays them for quick 4-minute analysis.

**Architecture:** Monolith Next.js (App Router) with API Routes as backend. cron-job.org calls protected endpoints for data collection. Supabase handles database, auth, and RLS. All API keys server-only.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Supabase (JS v2 + SSR), Recharts 2

**Spec:** `docs/superpowers/specs/2026-04-01-dash-gestao-4-minutos-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/supabase/server.ts` | Server-side Supabase client (service_role_key) |
| `src/lib/supabase/client.ts` | Client-side Supabase client (anon key) |
| `src/lib/supabase/middleware.ts` | Supabase auth middleware for Next.js |
| `src/lib/utils/cron-auth.ts` | Validate CRON_SECRET from request headers |
| `src/lib/utils/api-auth.ts` | Validate Supabase JWT from request headers |
| `src/lib/services/youtube.ts` | YouTube Data API v3 collection logic |
| `src/lib/services/instagram.ts` | Instagram Graph API collection logic |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Redirect to /dashboard or /login |
| `src/app/login/page.tsx` | Login page |
| `src/app/dashboard/layout.tsx` | Protected dashboard layout with sidebar |
| `src/app/dashboard/page.tsx` | Main "4 minutes" overview |
| `src/app/dashboard/youtube/page.tsx` | YouTube detailed KPIs |
| `src/app/dashboard/instagram/page.tsx` | Instagram detailed KPIs |
| `src/app/api/cron/youtube/route.ts` | Cron endpoint for YouTube collection |
| `src/app/api/cron/instagram/route.ts` | Cron endpoint for Instagram collection |
| `src/app/api/youtube/channel/route.ts` | Serve YouTube channel data to frontend |
| `src/app/api/youtube/videos/route.ts` | Serve YouTube videos data to frontend |
| `src/app/api/instagram/profile/route.ts` | Serve Instagram profile data to frontend |
| `src/app/api/instagram/media/route.ts` | Serve Instagram media data to frontend |
| `src/components/ui/kpi-card.tsx` | Reusable KPI card with delta indicator |
| `src/components/ui/line-chart.tsx` | Reusable Recharts line chart wrapper |
| `src/components/ui/data-table.tsx` | Reusable sortable data table |
| `src/components/dashboard/youtube-overview.tsx` | YouTube KPI block for main page |
| `src/components/dashboard/instagram-overview.tsx` | Instagram KPI block for main page |
| `src/components/dashboard/cron-status.tsx` | Cron health status block |
| `src/components/auth/login-form.tsx` | Login form component |
| `src/middleware.ts` | Next.js middleware for auth redirect |
| `supabase/migrations/001_create_tables.sql` | All tables, indexes, RLS policies |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `.env.local`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /home/alberani/Documentos/IGT/DASH_GESTAO
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

Select defaults when prompted. This creates the full Next.js scaffold.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr recharts
```

- [ ] **Step 3: Configure environment variables**

Create `.env.local` with all server-only keys:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://lnuaxahcyfleoykkjehk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudWF4YWhjeWZsZW95a2tqZWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTI4NzUsImV4cCI6MjA4ODYyODg3NX0.tMwFnGDM76h9_-HdXRHFOCBhJzARrL88oLWc1MqYpgA

# Server-only keys (NEVER use NEXT_PUBLIC_ prefix)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here
YOUTUBE_CHANNEL_ID=your_channel_id_here
INSTAGRAM_ACCESS_TOKEN=your_instagram_token_here
INSTAGRAM_USER_ID=your_instagram_user_id_here
CRON_SECRET=generate_a_random_32_char_string_here
```

- [ ] **Step 4: Update .gitignore**

Ensure `.env.local` is in `.gitignore` (create-next-app includes it by default). Verify:

```bash
grep ".env.local" .gitignore
```

Expected: `.env*.local` or `.env.local` present.

- [ ] **Step 5: Verify project runs**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, default Next.js page renders.

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_create_tables.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_create_tables.sql`:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- YouTube Channel snapshots
create table dash_gestao_youtube_channel (
  id uuid primary key default uuid_generate_v4(),
  channel_id text not null,
  subscriber_count bigint,
  view_count bigint,
  video_count integer,
  collected_at timestamptz not null default now()
);

create index idx_yt_channel_collected
  on dash_gestao_youtube_channel (channel_id, collected_at desc);

-- YouTube Videos snapshots
create table dash_gestao_youtube_videos (
  id uuid primary key default uuid_generate_v4(),
  video_id text not null,
  title text,
  published_at timestamptz,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  duration text,
  thumbnail_url text,
  collected_at timestamptz not null default now()
);

create index idx_yt_videos_collected
  on dash_gestao_youtube_videos (video_id, collected_at desc);

-- Instagram Profile snapshots
create table dash_gestao_instagram_profile (
  id uuid primary key default uuid_generate_v4(),
  ig_user_id text not null,
  followers_count bigint,
  follows_count bigint,
  media_count integer,
  impressions bigint,
  reach bigint,
  collected_at timestamptz not null default now()
);

create index idx_ig_profile_collected
  on dash_gestao_instagram_profile (ig_user_id, collected_at desc);

-- Instagram Media snapshots (posts, reels, stories)
create table dash_gestao_instagram_media (
  id uuid primary key default uuid_generate_v4(),
  media_id text not null,
  media_type text not null check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL', 'REEL', 'STORY')),
  caption text,
  permalink text,
  like_count bigint,
  comments_count bigint,
  reach bigint,
  impressions bigint,
  saved bigint,
  shares bigint,
  plays bigint,
  published_at timestamptz,
  collected_at timestamptz not null default now()
);

create index idx_ig_media_collected
  on dash_gestao_instagram_media (media_id, collected_at desc);

create index idx_ig_media_type_collected
  on dash_gestao_instagram_media (media_type, collected_at desc);

-- Cron execution logs
create table dash_gestao_cron_logs (
  id uuid primary key default uuid_generate_v4(),
  job_name text not null,
  status text not null check (status in ('success', 'error')),
  records_collected integer,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- RLS: enable on all tables
alter table dash_gestao_youtube_channel enable row level security;
alter table dash_gestao_youtube_videos enable row level security;
alter table dash_gestao_instagram_profile enable row level security;
alter table dash_gestao_instagram_media enable row level security;
alter table dash_gestao_cron_logs enable row level security;

-- RLS policies: authenticated users can read all rows
create policy "Authenticated users can read youtube channel"
  on dash_gestao_youtube_channel for select
  to authenticated
  using (true);

create policy "Authenticated users can read youtube videos"
  on dash_gestao_youtube_videos for select
  to authenticated
  using (true);

create policy "Authenticated users can read instagram profile"
  on dash_gestao_instagram_profile for select
  to authenticated
  using (true);

create policy "Authenticated users can read instagram media"
  on dash_gestao_instagram_media for select
  to authenticated
  using (true);

create policy "Authenticated users can read cron logs"
  on dash_gestao_cron_logs for select
  to authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies for authenticated role.
-- Writes happen via service_role_key which bypasses RLS.
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard > SQL Editor, paste and run the migration. Or if using Supabase CLI:

```bash
npx supabase db push
```

Verify: Check that all 5 tables exist in Table Editor with RLS enabled (lock icon).

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema with tables, indexes, and RLS policies"
```

---

## Task 3: Supabase Client Libraries

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Create server-side Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

export function createSupabaseServiceClient() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 2: Create client-side Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Create Supabase middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except for /login and /api/cron)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/api/cron")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 4: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: add Supabase client libs and auth middleware"
```

---

## Task 4: Auth Utilities

**Files:**
- Create: `src/lib/utils/cron-auth.ts`, `src/lib/utils/api-auth.ts`

- [ ] **Step 1: Create cron auth validator**

Create `src/lib/utils/cron-auth.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export function validateCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // Auth passed
}
```

- [ ] **Step 2: Create API auth validator**

Create `src/lib/utils/api-auth.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function validateApiAuth(): Promise<{
  error: NextResponse | null;
  userId: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
    };
  }

  return { error: null, userId: user.id };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils/
git commit -m "feat: add cron and API auth utilities"
```

---

## Task 5: Login Page

**Files:**
- Create: `src/app/login/page.tsx`, `src/components/auth/login-form.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create login form component**

Create `src/components/auth/login-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h1 className="text-2xl font-bold text-center">Gestao em 4 Minutos</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="border rounded px-3 py-2 text-sm"
      />
      <input
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="border rounded px-3 py-2 text-sm"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create login page**

Create `src/app/login/page.tsx`:

```typescript
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 3: Update root page to redirect**

Replace `src/app/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
```

- [ ] **Step 4: Verify login page renders**

```bash
npm run dev
```

Navigate to http://localhost:3000/login. Expected: login form with email/password fields.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/ src/components/auth/ src/app/page.tsx
git commit -m "feat: add login page with Supabase auth"
```

---

## Task 6: Dashboard Layout (Protected)

**Files:**
- Create: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Create protected dashboard layout**

Create `src/app/dashboard/layout.tsx`:

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">Gestao em 4 Minutos</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="hover:text-blue-600">
              Visao Geral
            </Link>
            <Link href="/dashboard/youtube" className="hover:text-blue-600">
              YouTube
            </Link>
            <Link href="/dashboard/instagram" className="hover:text-blue-600">
              Instagram
            </Link>
          </nav>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-gray-500 hover:text-gray-700">
            Sair
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create signout API route**

Create `src/app/api/auth/signout/route.ts`:

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 3: Create placeholder dashboard page**

Create `src/app/dashboard/page.tsx`:

```typescript
export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Visao Geral</h2>
      <p className="text-gray-500">Dashboard em construcao...</p>
    </div>
  );
}
```

- [ ] **Step 4: Verify protected layout works**

```bash
npm run dev
```

Navigate to http://localhost:3000/dashboard. Expected: redirects to /login if not authenticated.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ src/app/api/auth/
git commit -m "feat: add protected dashboard layout with navigation and signout"
```

---

## Task 7: YouTube Collection Service

**Files:**
- Create: `src/lib/services/youtube.ts`

- [ ] **Step 1: Implement YouTube service**

Create `src/lib/services/youtube.ts`:

```typescript
import { createSupabaseServiceClient } from "@/lib/supabase/server";

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

async function youtubeGet(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY!);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectYouTubeChannel(): Promise<{
  channelRecords: number;
  videoRecords: number;
}> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID!;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  // 1. Fetch channel statistics
  const channelData = await youtubeGet("channels", {
    part: "statistics",
    id: channelId,
  });

  const stats: YouTubeChannelStats = channelData.items[0].statistics;

  const { error: channelError } = await supabase
    .from("dash_gestao_youtube_channel")
    .insert({
      channel_id: channelId,
      subscriber_count: parseInt(stats.subscriberCount),
      view_count: parseInt(stats.viewCount),
      video_count: parseInt(stats.videoCount),
      collected_at: now,
    });

  if (channelError) throw new Error(`Channel insert error: ${channelError.message}`);

  // 2. Fetch recent videos (last 50 via search)
  const searchData = await youtubeGet("search", {
    part: "id",
    channelId: channelId,
    order: "date",
    maxResults: "50",
    type: "video",
  });

  const videoIds: string[] = searchData.items.map(
    (item: { id: { videoId: string } }) => item.id.videoId
  );

  if (videoIds.length === 0) {
    return { channelRecords: 1, videoRecords: 0 };
  }

  // 3. Fetch video details in batches of 50
  const videosData = await youtubeGet("videos", {
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
  });

  const videoRows = videosData.items.map((video: YouTubeVideoItem) => ({
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
    .from("dash_gestao_youtube_videos")
    .insert(videoRows);

  if (videosError) throw new Error(`Videos insert error: ${videosError.message}`);

  return { channelRecords: 1, videoRecords: videoRows.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/youtube.ts
git commit -m "feat: add YouTube Data API v3 collection service"
```

---

## Task 8: YouTube Cron Endpoint

**Files:**
- Create: `src/app/api/cron/youtube/route.ts`

- [ ] **Step 1: Implement cron endpoint**

Create `src/app/api/cron/youtube/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { collectYouTubeChannel } from "@/lib/services/youtube";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseServiceClient();
  const startedAt = new Date().toISOString();

  try {
    const result = await collectYouTubeChannel();

    await supabase.from("dash_gestao_cron_logs").insert({
      job_name: "youtube",
      status: "success",
      records_collected: result.channelRecords + result.videoRecords,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await supabase.from("dash_gestao_cron_logs").insert({
      job_name: "youtube",
      status: "error",
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test manually with curl**

```bash
curl -X POST http://localhost:3000/api/cron/youtube \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected: 200 with `{ "status": "ok", "channelRecords": 1, "videoRecords": N }` (after setting real API keys).

Test without secret:

```bash
curl -X POST http://localhost:3000/api/cron/youtube
```

Expected: 401 `{ "error": "Unauthorized" }`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/youtube/
git commit -m "feat: add YouTube cron collection endpoint"
```

---

## Task 9: Instagram Collection Service

**Files:**
- Create: `src/lib/services/instagram.ts`

- [ ] **Step 1: Implement Instagram service**

Create `src/lib/services/instagram.ts`:

```typescript
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const IG_API_BASE = "https://graph.facebook.com/v21.0";

async function igGet(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${IG_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN!);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectInstagramProfile(): Promise<{
  profileRecords: number;
  mediaRecords: number;
}> {
  const userId = process.env.INSTAGRAM_USER_ID!;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  // 1. Fetch profile data
  const profile = await igGet(userId, {
    fields: "followers_count,follows_count,media_count",
  });

  // 2. Fetch profile insights (impressions, reach) for last 28 days
  let impressions = 0;
  let reach = 0;
  try {
    const insights = await igGet(`${userId}/insights`, {
      metric: "impressions,reach",
      period: "day",
      since: String(Math.floor(Date.now() / 1000) - 28 * 86400),
      until: String(Math.floor(Date.now() / 1000)),
    });
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
    .from("dash_gestao_instagram_profile")
    .insert({
      ig_user_id: userId,
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
      impressions,
      reach,
      collected_at: now,
    });

  if (profileError) throw new Error(`Profile insert error: ${profileError.message}`);

  // 3. Fetch recent media (posts + reels)
  const mediaList = await igGet(`${userId}/media`, {
    fields: "id,media_type,caption,permalink,timestamp",
    limit: "50",
  });

  // 4. Fetch stories
  let storyItems: Array<{ id: string; media_type: string; caption?: string; permalink?: string; timestamp: string }> = [];
  try {
    const stories = await igGet(`${userId}/stories`, {
      fields: "id,media_type,caption,permalink,timestamp",
    });
    storyItems = (stories.data || []).map((s: { id: string; media_type: string; caption?: string; permalink?: string; timestamp: string }) => ({
      ...s,
      media_type: "STORY",
    }));
  } catch {
    // Stories endpoint may fail if no active stories
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
      const mediaType = media.media_type === "REEL" ? "REEL" :
                         media.media_type === "STORY" ? "STORY" :
                         media.media_type === "VIDEO" ? "VIDEO" : "POST";

      let metrics = "impressions,reach";
      if (mediaType === "STORY") {
        metrics = "impressions,reach,replies";
      } else if (mediaType === "REEL") {
        metrics = "impressions,reach,saved,shares,plays,likes,comments";
      } else {
        metrics = "impressions,reach,saved,likes,comments,shares";
      }

      const insightsData = await igGet(`${media.id}/insights`, {
        metric: metrics,
      });

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
    .from("dash_gestao_instagram_media")
    .insert(mediaRows);

  if (mediaError) throw new Error(`Media insert error: ${mediaError.message}`);

  return { profileRecords: 1, mediaRecords: mediaRows.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/instagram.ts
git commit -m "feat: add Instagram Graph API collection service"
```

---

## Task 10: Instagram Cron Endpoint

**Files:**
- Create: `src/app/api/cron/instagram/route.ts`

- [ ] **Step 1: Implement cron endpoint**

Create `src/app/api/cron/instagram/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { collectInstagramProfile } from "@/lib/services/instagram";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseServiceClient();
  const startedAt = new Date().toISOString();

  try {
    const result = await collectInstagramProfile();

    await supabase.from("dash_gestao_cron_logs").insert({
      job_name: "instagram",
      status: "success",
      records_collected: result.profileRecords + result.mediaRecords,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await supabase.from("dash_gestao_cron_logs").insert({
      job_name: "instagram",
      status: "error",
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test manually with curl**

```bash
curl -X POST http://localhost:3000/api/cron/instagram \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected: 200 with `{ "status": "ok", "profileRecords": 1, "mediaRecords": N }`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/instagram/
git commit -m "feat: add Instagram cron collection endpoint"
```

---

## Task 11: YouTube API Routes (Frontend Data)

**Files:**
- Create: `src/app/api/youtube/channel/route.ts`, `src/app/api/youtube/videos/route.ts`

- [ ] **Step 1: Create channel data endpoint**

Create `src/app/api/youtube/channel/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_channel")
    .select("*")
    .gte("collected_at", since.toISOString())
    .order("collected_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create videos data endpoint**

Create `src/app/api/youtube/videos/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  // Get latest snapshot for each video (most recent collected_at)
  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_videos")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate: keep only the most recent snapshot per video_id
  const seen = new Set<string>();
  const unique = data.filter((row: { video_id: string }) => {
    if (seen.has(row.video_id)) return false;
    seen.add(row.video_id);
    return true;
  });

  return NextResponse.json(unique);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/youtube/
git commit -m "feat: add YouTube data API routes for frontend"
```

---

## Task 12: Instagram API Routes (Frontend Data)

**Files:**
- Create: `src/app/api/instagram/profile/route.ts`, `src/app/api/instagram/media/route.ts`

- [ ] **Step 1: Create profile data endpoint**

Create `src/app/api/instagram/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error: dbError } = await supabase
    .from("dash_gestao_instagram_profile")
    .select("*")
    .gte("collected_at", since.toISOString())
    .order("collected_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create media data endpoint**

Create `src/app/api/instagram/media/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const mediaType = request.nextUrl.searchParams.get("type"); // IMAGE, VIDEO, CAROUSEL, REEL, STORY

  let query = supabase
    .from("dash_gestao_instagram_media")
    .select("*")
    .order("collected_at", { ascending: false });

  if (mediaType) {
    query = query.eq("media_type", mediaType.toUpperCase());
  }

  const { data, error: dbError } = await query.limit(limit);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate: keep only the most recent snapshot per media_id
  const seen = new Set<string>();
  const unique = data.filter((row: { media_id: string }) => {
    if (seen.has(row.media_id)) return false;
    seen.add(row.media_id);
    return true;
  });

  return NextResponse.json(unique);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/instagram/
git commit -m "feat: add Instagram data API routes for frontend"
```

---

## Task 13: Reusable UI Components

**Files:**
- Create: `src/components/ui/kpi-card.tsx`, `src/components/ui/line-chart.tsx`, `src/components/ui/data-table.tsx`

- [ ] **Step 1: Create KPI card component**

Create `src/components/ui/kpi-card.tsx`:

```typescript
interface KpiCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  format?: "number" | "compact";
}

function formatNumber(n: number, format: "number" | "compact" = "number"): string {
  if (format === "compact") {
    return Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
  }
  return Intl.NumberFormat("pt-BR").format(n);
}

export function KpiCard({ title, value, previousValue, currentValue, format = "number" }: KpiCardProps) {
  let delta: number | null = null;
  if (previousValue !== undefined && currentValue !== undefined && previousValue > 0) {
    delta = ((currentValue - previousValue) / previousValue) * 100;
  }

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">
        {typeof value === "number" ? formatNumber(value, format) : value}
      </p>
      {delta !== null && (
        <p className={`text-xs mt-1 ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs anterior
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create line chart component**

Create `src/components/ui/line-chart.tsx`:

```typescript
"use client";

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{
    key: string;
    color: string;
    label: string;
  }>;
  height?: number;
}

export function LineChart({ data, xKey, lines, height = 300 }: LineChartProps) {
  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 12 }}
            tickFormatter={(value: string) =>
              new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            }
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(value: string) =>
              new Date(value).toLocaleDateString("pt-BR")
            }
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              name={line.label}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create data table component**

Create `src/components/ui/data-table.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onExportCsv?: () => void;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onExportCsv,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    return sortDir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {onExportCsv && (
        <div className="p-3 border-b flex justify-end">
          <button
            onClick={onExportCsv}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Exportar CSV
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                >
                  {col.label}
                  {sortKey === col.key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-4 py-2">
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add reusable UI components (KpiCard, LineChart, DataTable)"
```

---

## Task 14: Dashboard Overview Components

**Files:**
- Create: `src/components/dashboard/youtube-overview.tsx`, `src/components/dashboard/instagram-overview.tsx`, `src/components/dashboard/cron-status.tsx`

- [ ] **Step 1: Create YouTube overview component**

Create `src/components/dashboard/youtube-overview.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";

interface ChannelSnapshot {
  subscriber_count: number;
  view_count: number;
  video_count: number;
  collected_at: string;
}

interface VideoSnapshot {
  video_id: string;
  title: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  thumbnail_url: string;
}

export function YouTubeOverview() {
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/youtube/channel?days=30").then((r) => r.json()),
      fetch("/api/youtube/videos?limit=5").then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(channel);
        setVideos(vids);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Carregando YouTube...</div>;

  const latest = channelData[channelData.length - 1];
  const previous = channelData.length > 1 ? channelData[channelData.length - 2] : undefined;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">YouTube</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {latest && (
          <>
            <KpiCard
              title="Inscritos"
              value={latest.subscriber_count}
              format="compact"
              currentValue={latest.subscriber_count}
              previousValue={previous?.subscriber_count}
            />
            <KpiCard
              title="Views Totais"
              value={latest.view_count}
              format="compact"
              currentValue={latest.view_count}
              previousValue={previous?.view_count}
            />
            <KpiCard
              title="Videos"
              value={latest.video_count}
              currentValue={latest.video_count}
              previousValue={previous?.video_count}
            />
          </>
        )}
      </div>

      {channelData.length > 1 && (
        <div className="mb-4">
          <LineChart
            data={channelData}
            xKey="collected_at"
            lines={[
              { key: "subscriber_count", color: "#ef4444", label: "Inscritos" },
              { key: "view_count", color: "#3b82f6", label: "Views" },
            ]}
          />
        </div>
      )}

      {videos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">Top Videos</p>
          {videos.map((video) => (
            <div
              key={video.video_id}
              className="flex items-center gap-3 bg-white border rounded-lg p-2"
            >
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-24 h-14 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{video.title}</p>
                <p className="text-xs text-gray-500">
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(video.view_count)} views
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(video.like_count)} likes
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(video.comment_count)} comentarios
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create Instagram overview component**

Create `src/components/dashboard/instagram-overview.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";

interface ProfileSnapshot {
  followers_count: number;
  follows_count: number;
  media_count: number;
  impressions: number;
  reach: number;
  collected_at: string;
}

interface MediaItem {
  media_id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  reach: number;
  impressions: number;
  like_count: number;
  comments_count: number;
  plays: number;
}

export function InstagramOverview() {
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [topPosts, setTopPosts] = useState<MediaItem[]>([]);
  const [reels, setReels] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/instagram/profile?days=30").then((r) => r.json()),
      fetch("/api/instagram/media?limit=5").then((r) => r.json()),
      fetch("/api/instagram/media?type=REEL&limit=5").then((r) => r.json()),
    ])
      .then(([profile, posts, reelData]) => {
        setProfileData(profile);
        setTopPosts(posts);
        setReels(reelData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Carregando Instagram...</div>;

  const latest = profileData[profileData.length - 1];
  const previous = profileData.length > 1 ? profileData[profileData.length - 2] : undefined;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Instagram</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {latest && (
          <>
            <KpiCard
              title="Seguidores"
              value={latest.followers_count}
              format="compact"
              currentValue={latest.followers_count}
              previousValue={previous?.followers_count}
            />
            <KpiCard
              title="Alcance (28d)"
              value={latest.reach}
              format="compact"
              currentValue={latest.reach}
              previousValue={previous?.reach}
            />
            <KpiCard
              title="Impressoes (28d)"
              value={latest.impressions}
              format="compact"
              currentValue={latest.impressions}
              previousValue={previous?.impressions}
            />
          </>
        )}
      </div>

      {profileData.length > 1 && (
        <div className="mb-4">
          <LineChart
            data={profileData}
            xKey="collected_at"
            lines={[
              { key: "followers_count", color: "#e11d48", label: "Seguidores" },
              { key: "reach", color: "#8b5cf6", label: "Alcance" },
            ]}
          />
        </div>
      )}

      {topPosts.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-600 mb-2">Top Posts por Alcance</p>
          <div className="space-y-2">
            {topPosts.map((post) => (
              <div
                key={post.media_id}
                className="flex items-center gap-3 bg-white border rounded-lg p-2"
              >
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {post.media_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{post.caption || "(sem legenda)"}</p>
                  <p className="text-xs text-gray-500">
                    Alcance: {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(post.reach)}
                    {" · "}
                    {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(post.like_count)} likes
                    {" · "}
                    {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(post.comments_count)} comentarios
                  </p>
                </div>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reels.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Reels Recentes</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {reels.map((reel) => (
              <div key={reel.media_id} className="bg-white border rounded-lg p-2 text-sm">
                <p className="truncate">{reel.caption || "(sem legenda)"}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(reel.plays)} plays
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(reel.reach)} alcance
                  {" · "}
                  {Intl.NumberFormat("pt-BR", { notation: "compact" }).format(reel.shares)} shares
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Create cron status component**

Create `src/components/dashboard/cron-status.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface CronLog {
  job_name: string;
  status: string;
  records_collected: number;
  finished_at: string;
}

export function CronStatus() {
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function fetchLogs() {
      // Get latest log for each job
      const { data } = await supabase
        .from("dash_gestao_cron_logs")
        .select("job_name, status, records_collected, finished_at")
        .order("finished_at", { ascending: false })
        .limit(10);

      if (data) {
        // Deduplicate: latest per job
        const seen = new Set<string>();
        const unique = data.filter((log: CronLog) => {
          if (seen.has(log.job_name)) return false;
          seen.add(log.job_name);
          return true;
        });
        setLogs(unique);
      }
      setLoading(false);
    }

    fetchLogs();
  }, []);

  if (loading) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold mb-3">Status das Coletas</h3>
      <div className="flex gap-4">
        {["youtube", "instagram"].map((job) => {
          const log = logs.find((l) => l.job_name === job);
          const isOk = log?.status === "success";

          return (
            <div key={job} className="bg-white border rounded-lg p-3 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${isOk ? "bg-green-500" : "bg-red-500"}`}
              />
              <div>
                <p className="text-sm font-medium capitalize">{job}</p>
                {log ? (
                  <p className="text-xs text-gray-500">
                    {new Date(log.finished_at).toLocaleString("pt-BR")}
                    {" · "}
                    {log.records_collected} registros
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Sem coleta</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/
git commit -m "feat: add dashboard overview components (YouTube, Instagram, CronStatus)"
```

---

## Task 15: Main Dashboard Page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Wire up the dashboard page**

Replace `src/app/dashboard/page.tsx`:

```typescript
import { YouTubeOverview } from "@/components/dashboard/youtube-overview";
import { InstagramOverview } from "@/components/dashboard/instagram-overview";
import { CronStatus } from "@/components/dashboard/cron-status";

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <h2 className="text-xl font-semibold">Gestao em 4 Minutos</h2>
      <CronStatus />
      <YouTubeOverview />
      <InstagramOverview />
    </div>
  );
}
```

- [ ] **Step 2: Verify page renders**

```bash
npm run dev
```

Navigate to http://localhost:3000/dashboard (must be logged in). Expected: shows loading states, then data (or empty states if no data collected yet).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: wire up main dashboard page with all overview components"
```

---

## Task 16: YouTube Detail Page

**Files:**
- Create: `src/app/dashboard/youtube/page.tsx`

- [ ] **Step 1: Create YouTube detail page**

Create `src/app/dashboard/youtube/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";

interface ChannelSnapshot {
  subscriber_count: number;
  view_count: number;
  video_count: number;
  collected_at: string;
}

interface VideoRow {
  video_id: string;
  title: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration: string;
  published_at: string;
  thumbnail_url: string;
  [key: string]: unknown;
}

export default function YouTubeDetailPage() {
  const [channelData, setChannelData] = useState<ChannelSnapshot[]>([]);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/youtube/channel?days=90").then((r) => r.json()),
      fetch("/api/youtube/videos?limit=100").then((r) => r.json()),
    ])
      .then(([channel, vids]) => {
        setChannelData(channel);
        setVideos(vids);
      })
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-semibold">YouTube - Detalhes</h2>

      {channelData.length > 1 && (
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

      <DataTable
        data={videos}
        columns={[
          {
            key: "title",
            label: "Titulo",
            render: (_, row) => (
              <div className="flex items-center gap-2 max-w-xs">
                <img src={row.thumbnail_url} alt="" className="w-16 h-9 object-cover rounded" />
                <span className="truncate text-sm">{row.title}</span>
              </div>
            ),
          },
          { key: "view_count", label: "Views" },
          { key: "like_count", label: "Likes" },
          { key: "comment_count", label: "Comentarios" },
          { key: "duration", label: "Duracao" },
          {
            key: "published_at",
            label: "Publicado",
            render: (v) =>
              v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
          },
        ]}
        onExportCsv={exportCsv}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/youtube/
git commit -m "feat: add YouTube detail page with chart, table, and CSV export"
```

---

## Task 17: Instagram Detail Page

**Files:**
- Create: `src/app/dashboard/instagram/page.tsx`

- [ ] **Step 1: Create Instagram detail page**

Create `src/app/dashboard/instagram/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/ui/line-chart";
import { DataTable } from "@/components/ui/data-table";

interface ProfileSnapshot {
  followers_count: number;
  reach: number;
  impressions: number;
  collected_at: string;
}

interface MediaRow {
  media_id: string;
  media_type: string;
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
  [key: string]: unknown;
}

export default function InstagramDetailPage() {
  const [profileData, setProfileData] = useState<ProfileSnapshot[]>([]);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/instagram/profile?days=90")
      .then((r) => r.json())
      .then(setProfileData);
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = typeFilter
      ? `/api/instagram/media?limit=100&type=${typeFilter}`
      : "/api/instagram/media?limit=100";
    fetch(url)
      .then((r) => r.json())
      .then(setMedia)
      .finally(() => setLoading(false));
  }, [typeFilter]);

  function exportCsv() {
    const headers = "Tipo,Legenda,Likes,Comentarios,Alcance,Impressoes,Salvos,Shares,Plays,Publicado\n";
    const rows = media
      .map(
        (m) =>
          `"${m.media_type}","${(m.caption || "").replace(/"/g, '""')}",${m.like_count},${m.comments_count},${m.reach},${m.impressions},${m.saved},${m.shares},${m.plays},"${m.published_at}"`
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

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-xl font-semibold">Instagram - Detalhes</h2>

      {profileData.length > 1 && (
        <LineChart
          data={profileData}
          xKey="collected_at"
          lines={[
            { key: "followers_count", color: "#e11d48", label: "Seguidores" },
            { key: "reach", color: "#8b5cf6", label: "Alcance" },
            { key: "impressions", color: "#f59e0b", label: "Impressoes" },
          ]}
          height={350}
        />
      )}

      <div className="flex gap-2">
        {["", "IMAGE", "VIDEO", "CAROUSEL", "REEL", "STORY"].map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`text-xs px-3 py-1 rounded border ${
              typeFilter === type
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {type || "Todos"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : (
        <DataTable
          data={media}
          columns={[
            { key: "media_type", label: "Tipo" },
            {
              key: "caption",
              label: "Legenda",
              render: (v) => (
                <span className="truncate block max-w-xs text-sm">
                  {(v as string) || "(sem legenda)"}
                </span>
              ),
            },
            { key: "like_count", label: "Likes" },
            { key: "comments_count", label: "Coment." },
            { key: "reach", label: "Alcance" },
            { key: "impressions", label: "Impress." },
            { key: "saved", label: "Salvos" },
            { key: "plays", label: "Plays" },
            {
              key: "published_at",
              label: "Publicado",
              render: (v) =>
                v ? new Date(v as string).toLocaleDateString("pt-BR") : "",
            },
            {
              key: "permalink",
              label: "",
              render: (v) =>
                v ? (
                  <a
                    href={v as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    Ver
                  </a>
                ) : null,
            },
          ]}
          onExportCsv={exportCsv}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/instagram/
git commit -m "feat: add Instagram detail page with filters, chart, table, and CSV export"
```

---

## Task 18: End-to-End Verification

- [ ] **Step 1: Verify build compiles**

```bash
npm run build
```

Expected: No TypeScript or build errors.

- [ ] **Step 2: Test cron security**

```bash
# Without secret — should return 401
curl -X POST http://localhost:3000/api/cron/youtube
curl -X POST http://localhost:3000/api/cron/instagram

# With secret — should return 200 (or 500 if API keys not set)
curl -X POST http://localhost:3000/api/cron/youtube \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- [ ] **Step 3: Test API auth**

```bash
# Without auth — should return 401
curl http://localhost:3000/api/youtube/channel
curl http://localhost:3000/api/instagram/profile
```

- [ ] **Step 4: Test login flow**

Navigate to http://localhost:3000. Expected: redirect to /login.
Log in with a Supabase user. Expected: redirect to /dashboard.
Navigate to /dashboard/youtube and /dashboard/instagram. Expected: pages render.
Click "Sair". Expected: redirect to /login.

- [ ] **Step 5: Test data display**

After running cron jobs (or inserting test data manually), verify:
- KPI cards show numbers with delta indicators
- Charts render with 30-day data
- Tables show video/media rows
- CSV export downloads a file

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete Dashboard Gestao em 4 Minutos v1"
```
