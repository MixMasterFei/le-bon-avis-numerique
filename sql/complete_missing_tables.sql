-- Complete Migration: All missing tables
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. MediaCorrection table
-- ============================================

CREATE TABLE IF NOT EXISTS media_corrections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    field TEXT,
    current_value TEXT,
    suggested_value TEXT,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    admin_notes TEXT,
    reviewed_at TIMESTAMP(3),
    reviewed_by TEXT,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_corrections_media_id ON media_corrections(media_id);
CREATE INDEX IF NOT EXISTS idx_media_corrections_user_id ON media_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_media_corrections_status ON media_corrections(status);
CREATE INDEX IF NOT EXISTS idx_media_corrections_created_at ON media_corrections(created_at);

-- ============================================
-- 2. ReviewReport table
-- ============================================

CREATE TABLE IF NOT EXISTS review_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    review_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);

-- ============================================
-- 3. ContentRequest table
-- ============================================

CREATE TABLE IF NOT EXISTS content_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    media_type TEXT NOT NULL,
    external_id TEXT,
    description TEXT,
    status TEXT DEFAULT 'PENDING',
    priority INTEGER DEFAULT 0,
    admin_notes TEXT,
    resolved_at TIMESTAMP(3),
    resolved_by TEXT,
    media_id TEXT REFERENCES media_items(id) ON DELETE SET NULL,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_requests_status ON content_requests(status);
CREATE INDEX IF NOT EXISTS idx_content_requests_created_at ON content_requests(created_at);

-- ============================================
-- 4. UserContentMetrics table
-- ============================================

CREATE TABLE IF NOT EXISTS user_content_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    violence INTEGER DEFAULT 0,
    sex_nudity INTEGER DEFAULT 0,
    language INTEGER DEFAULT 0,
    consumerism INTEGER DEFAULT 0,
    substance_use INTEGER DEFAULT 0,
    positive_messages INTEGER DEFAULT 0,
    role_models INTEGER DEFAULT 0,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_content_metrics_media_id ON user_content_metrics(media_id);

-- ============================================
-- 5. AdminActivity table
-- ============================================

CREATE TABLE IF NOT EXISTS admin_activities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_activities_created_at ON admin_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activities_user_id ON admin_activities(user_id);

-- ============================================
-- 6. FamilySettings table
-- ============================================

CREATE TABLE IF NOT EXISTS family_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    default_sensitivity_violence INTEGER DEFAULT 2,
    default_sensitivity_scary INTEGER DEFAULT 2,
    default_sensitivity_sexual INTEGER DEFAULT 3,
    default_sensitivity_language INTEGER DEFAULT 2,
    default_sensitivity_substances INTEGER DEFAULT 2,
    default_prefer_positive_messages INTEGER DEFAULT 1,
    default_prefer_role_models INTEGER DEFAULT 1,
    default_prefer_educational INTEGER DEFAULT 1,
    blocked_topics TEXT[] DEFAULT '{}',
    available_platforms TEXT[] DEFAULT '{}',
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_family_settings_user_id ON family_settings(user_id);

-- ============================================
-- 7. Add missing columns to family_members
-- ============================================

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_violence INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_scary INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_sexual INTEGER DEFAULT 3;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_language INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sensitivity_substances INTEGER DEFAULT 2;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS prefer_positive_messages INTEGER DEFAULT 1;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS prefer_role_models INTEGER DEFAULT 1;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS prefer_educational INTEGER DEFAULT 1;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS avoid_topics TEXT[] DEFAULT '{}';
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS use_custom_settings BOOLEAN DEFAULT false;

-- ============================================
-- Success
-- ============================================

SELECT 'All tables created successfully!' as status;
