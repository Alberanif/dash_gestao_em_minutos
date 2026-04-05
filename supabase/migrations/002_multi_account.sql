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
