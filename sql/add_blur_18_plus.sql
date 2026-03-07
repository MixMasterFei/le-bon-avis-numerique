-- Add missing blur_18_plus column to family_settings
-- This column exists in the Prisma schema but was missing from the original CREATE TABLE migration
ALTER TABLE family_settings ADD COLUMN IF NOT EXISTS blur_18_plus BOOLEAN DEFAULT true;
