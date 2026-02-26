-- Migration: Add interests field to family_members
-- Run: npx prisma db execute --file sql/add_interests_column.sql

ALTER TABLE family_members ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

SELECT 'Migration: interests column added successfully!' as status;
