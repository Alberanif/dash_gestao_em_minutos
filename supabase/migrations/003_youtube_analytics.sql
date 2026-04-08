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
