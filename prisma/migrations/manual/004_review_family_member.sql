-- Migration: Add family_member_id and edited_at to reviews table
-- This fixes the schema mismatch causing media page 404s

-- Add family_member_id column to reviews (nullable)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS family_member_id UUID;

-- Add edited_at column to reviews (nullable)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;

-- Add index on family_member_id for performance
CREATE INDEX IF NOT EXISTS reviews_family_member_id_idx ON reviews(family_member_id);

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_family_member_id_fkey'
  ) THEN
    ALTER TABLE reviews
    ADD CONSTRAINT reviews_family_member_id_fkey
    FOREIGN KEY (family_member_id)
    REFERENCES family_members(id)
    ON DELETE SET NULL;
  END IF;
END $$;
