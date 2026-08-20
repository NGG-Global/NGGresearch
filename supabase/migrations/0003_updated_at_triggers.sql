-- Keep updated_at honest without relying on application code.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists channels_touch_updated_at on public.channels;
create trigger channels_touch_updated_at
  before update on public.channels
  for each row execute function public.touch_updated_at();

drop trigger if exists videos_touch_updated_at on public.videos;
create trigger videos_touch_updated_at
  before update on public.videos
  for each row execute function public.touch_updated_at();

drop trigger if exists analytics_snapshots_touch_updated_at on public.analytics_snapshots;
create trigger analytics_snapshots_touch_updated_at
  before update on public.analytics_snapshots
  for each row execute function public.touch_updated_at();

drop trigger if exists daily_metrics_touch_updated_at on public.daily_metrics;
create trigger daily_metrics_touch_updated_at
  before update on public.daily_metrics
  for each row execute function public.touch_updated_at();

drop trigger if exists channel_credentials_touch_updated_at on public.channel_credentials;
create trigger channel_credentials_touch_updated_at
  before update on public.channel_credentials
  for each row execute function public.touch_updated_at();
