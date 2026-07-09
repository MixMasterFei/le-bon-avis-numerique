-- Store the FR availability date the "Bientôt" card shows, so the alert cron
-- fires on that (not the TMDB primary MediaItem.releaseDate, which is often a
-- different/earlier date). See src/lib/release-alerts.ts.
ALTER TABLE release_alerts ADD COLUMN IF NOT EXISTS notify_at timestamp(3);
CREATE INDEX IF NOT EXISTS release_alerts_notify_at_idx ON release_alerts(notify_at);
