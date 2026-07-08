-- "Prévenez-moi" subscriptions for upcoming titles. A daily cron turns each
-- un-notified alert into a MAJOR_RELEASE Notification on the media's release
-- date. Applied manually (project uses raw SQL migrations, not prisma migrate).
CREATE TABLE IF NOT EXISTS release_alerts (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id    text NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  created_at  timestamp(3) NOT NULL DEFAULT now(),
  notified_at timestamp(3),
  CONSTRAINT release_alerts_user_media_unique UNIQUE (user_id, media_id)
);
CREATE INDEX IF NOT EXISTS release_alerts_media_id_idx ON release_alerts(media_id);
CREATE INDEX IF NOT EXISTS release_alerts_notified_at_idx ON release_alerts(notified_at);
