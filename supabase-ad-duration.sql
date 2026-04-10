-- Add per-ad display duration (seconds).
-- Valid values: 10, 20, 30. Default 10s to preserve existing behavior.
alter table public.ad_media
  add column if not exists display_duration_seconds integer not null default 10;

alter table public.ad_media
  drop constraint if exists ad_media_display_duration_check;

alter table public.ad_media
  add constraint ad_media_display_duration_check
  check (display_duration_seconds in (10, 20, 30));
