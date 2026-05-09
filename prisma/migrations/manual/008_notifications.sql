-- ============================================
-- Migration: Add in-app notifications
-- Run this in Supabase SQL Editor
-- Table: notifications
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_created_idx
  ON notifications(user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_type_idx
  ON notifications(type);

DO $$ BEGIN
  ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
