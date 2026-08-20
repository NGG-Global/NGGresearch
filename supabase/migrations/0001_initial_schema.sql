-- Layla Lavan Analytics — initial schema (V1)
--
-- Single-channel, single-user YouTube intelligence store. All access happens
-- server-side with the service role key; see 0002 for the RLS posture.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- channels --

create table if not exists public.channels (
  id                      uuid primary key default gen_random_uuid(),
  youtube_channel_id      text not null unique,
  title                   text not null,
  avatar_url              text,
  subscriber_count        bigint,
  video_count             bigint,
  view_count              bigint,
  connected_at            timestamptz not null default now(),
  last_successful_sync_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- OAuth material lives in its own table so it is never selected by accident
-- alongside channel metadata. Tokens are stored encrypted (AES-256-GCM).
create table if not exists public.channel_credentials (
  channel_id             uuid primary key references public.channels (id) on delete cascade,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at       timestamptz,
  scope                  text,
  token_status           text not null default 'valid'
                           check (token_status in ('valid', 'expired', 'missing')),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------------ videos --

create table if not exists public.videos (
  id                        uuid primary key default gen_random_uuid(),
  channel_id                uuid not null references public.channels (id) on delete cascade,
  youtube_video_id          text not null unique,
  title                     text not null,
  description               text not null default '',
  thumbnail_url             text,
  published_at              timestamptz not null,
  duration_seconds          integer,
  privacy_status            text not null default 'unknown'
                              check (privacy_status in ('public', 'unlisted', 'private', 'unknown')),
  url                       text not null,
  -- Benchmark classification. `content_type_override` always wins and is the
  -- hook for future manual correction from the UI.
  content_type              text not null default 'unknown'
                              check (content_type in ('long_form', 'short', 'live', 'unknown')),
  content_type_override     text
                              check (content_type_override in ('long_form', 'short', 'live', 'unknown')),
  classification_source     text not null default 'unknown',
  classification_confidence text not null default 'low'
                              check (classification_confidence in ('high', 'medium', 'low')),
  benchmark_eligible        boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists videos_channel_published_idx
  on public.videos (channel_id, published_at desc);
create index if not exists videos_benchmark_idx
  on public.videos (channel_id, benchmark_eligible, content_type, published_at desc);

-- ------------------------------------------------------- analytics snapshots --

-- One row per (video, milestone, provenance). The unique constraint is what
-- makes sync idempotent: re-running a sync updates a snapshot in place instead
-- of appending a near-duplicate.
create table if not exists public.analytics_snapshots (
  id                            uuid primary key default gen_random_uuid(),
  video_id                      uuid not null references public.videos (id) on delete cascade,
  captured_at                   timestamptz not null default now(),
  -- Real age of the video when the measurement was taken. Stored so we never
  -- have to pretend a capture happened exactly on the milestone.
  video_age_hours               numeric(10, 2) not null,
  snapshot_target               text not null
                                  check (snapshot_target in ('h6', 'h24', 'h72', 'd7', 'd14', 'd30', 'current')),
  -- milestone_capture = measured inside the milestone tolerance window
  -- daily_backfill    = reconstructed from YouTube daily rows (day granularity)
  -- current_state     = lifetime-to-date totals
  snapshot_source               text not null
                                  check (snapshot_source in ('milestone_capture', 'daily_backfill', 'current_state')),
  views                         bigint,
  watch_time_minutes            numeric(14, 2),
  average_view_duration_seconds numeric(10, 2),
  average_view_percentage       numeric(6, 2),
  subscribers_gained            integer,
  subscribers_lost              integer,
  likes                         integer,
  comments                      integer,
  impressions                   bigint,
  impressions_ctr               numeric(6, 3),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  constraint analytics_snapshots_unique_point
    unique (video_id, snapshot_target, snapshot_source)
);

create index if not exists analytics_snapshots_video_idx
  on public.analytics_snapshots (video_id, snapshot_target);

-- --------------------------------------------------------- daily metrics ----

-- Normalised daily analytics, used for the performance-over-time chart and as
-- the source for honest `daily_backfill` snapshots of older videos.
create table if not exists public.daily_metrics (
  video_id                      uuid not null references public.videos (id) on delete cascade,
  date                          date not null,
  views                         bigint not null default 0,
  watch_time_minutes            numeric(14, 2),
  average_view_duration_seconds numeric(10, 2),
  average_view_percentage       numeric(6, 2),
  subscribers_gained            integer,
  subscribers_lost              integer,
  likes                         integer,
  comments                      integer,
  impressions                   bigint,
  impressions_ctr               numeric(6, 3),
  updated_at                    timestamptz not null default now(),
  primary key (video_id, date)
);

-- ----------------------------------------------------------------- insights --

create table if not exists public.insights (
  id              uuid primary key default gen_random_uuid(),
  video_id        uuid not null references public.videos (id) on delete cascade,
  snapshot_target text not null,
  generated_at    timestamptz not null default now(),
  provider        text not null check (provider in ('anthropic', 'rules')),
  model           text,
  payload         jsonb not null,
  constraint insights_unique_target unique (video_id, snapshot_target)
);

-- ---------------------------------------------------------------- sync runs --

create table if not exists public.sync_runs (
  id                uuid primary key default gen_random_uuid(),
  channel_id        uuid references public.channels (id) on delete cascade,
  trigger           text not null check (trigger in ('initial', 'manual', 'scheduled')),
  status            text not null check (status in ('running', 'success', 'partial', 'failed')),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  duration_ms       integer,
  videos_processed  integer not null default 0,
  snapshots_created integer not null default 0,
  warnings          text[] not null default '{}',
  error             text
);

create index if not exists sync_runs_channel_started_idx
  on public.sync_runs (channel_id, started_at desc);

-- ----------------------------------------------------------- reporting jobs --

-- YouTube Reporting API jobs (thumbnail impressions / CTR reach reports).
-- Jobs are created once per channel per report type and then polled.
create table if not exists public.reporting_jobs (
  channel_id                uuid not null references public.channels (id) on delete cascade,
  report_type_id            text not null,
  job_id                    text not null,
  created_at                timestamptz not null default now(),
  last_report_downloaded_at timestamptz,
  last_report_id            text,
  primary key (channel_id, report_type_id)
);
