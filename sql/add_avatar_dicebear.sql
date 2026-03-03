-- Add DiceBear avatar fields to family_members
-- These fields store the DiceBear style configuration for SVG avatar generation
-- Existing avatarEmoji column is kept for backward compatibility

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS avatar_style TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS avatar_seed TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS avatar_options JSONB;

-- Add DiceBear avatar fields to users (parent account avatars)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_style TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_seed TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_options JSONB;
