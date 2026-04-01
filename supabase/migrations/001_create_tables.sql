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
