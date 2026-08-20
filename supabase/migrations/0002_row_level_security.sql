-- Deny-by-default row level security.
--
-- This application never talks to Supabase from the browser: every read and
-- write goes through Next.js server code holding the service role key, which
-- bypasses RLS. Enabling RLS with no permissive policies therefore means the
-- anon and authenticated keys can read nothing, even if one leaks.

alter table public.channels             enable row level security;
alter table public.channel_credentials  enable row level security;
alter table public.videos               enable row level security;
alter table public.analytics_snapshots  enable row level security;
alter table public.daily_metrics        enable row level security;
alter table public.insights             enable row level security;
alter table public.sync_runs            enable row level security;
alter table public.reporting_jobs       enable row level security;

-- Extra belt-and-braces on the credential table: revoke direct grants from the
-- client-facing roles entirely.
revoke all on public.channel_credentials from anon, authenticated;
