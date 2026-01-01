-- Migration: Add Family Preferences and Settings
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Add new columns to family_members table
-- ============================================

-- Content sensitivity preferences (0 = don't care, 1 = low tolerance, 2 = moderate, 3 = strict)
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_violence INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_scary INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_sexual INTEGER DEFAULT 3;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_language INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_substances INTEGER DEFAULT 2;

-- Positive content preferences (0 = don't care, 1 = nice to have, 2 = prefer, 3 = must have)
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS prefer_positive_messages INTEGER DEFAULT 1;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS prefer_role_models INTEGER DEFAULT 1;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS prefer_educational INTEGER DEFAULT 1;

-- Topics/themes to avoid (explicit list)
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS avoid_topics TEXT[] DEFAULT '{}';

-- Use custom settings or inherit from account defaults
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS use_custom_settings BOOLEAN DEFAULT false;

-- ============================================
-- 2. Create family_settings table (account-wide defaults)
-- ============================================

CREATE TABLE IF NOT EXISTS family_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Default sensitivity levels for the whole family
    default_sensitivity_violence INTEGER DEFAULT 2,
    default_sensitivity_scary INTEGER DEFAULT 2,
    default_sensitivity_sexual INTEGER DEFAULT 3,
    default_sensitivity_language INTEGER DEFAULT 2,
    default_sensitivity_substances INTEGER DEFAULT 2,

    -- Default positive preferences
    default_prefer_positive_messages INTEGER DEFAULT 1,
    default_prefer_role_models INTEGER DEFAULT 1,
    default_prefer_educational INTEGER DEFAULT 1,

    -- Account-wide blocked topics
    blocked_topics TEXT[] DEFAULT '{}',

    -- Streaming platforms available in this family
    available_platforms TEXT[] DEFAULT '{}',

    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_family_settings_user_id ON family_settings(user_id);

-- ============================================
-- 3. Success message
-- ============================================

SELECT 'Migration completed successfully!' as status;
