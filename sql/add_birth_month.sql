-- Add birth_month column to family_members for precise age calculation
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS birth_month INTEGER;

-- Constraint: 1-12
ALTER TABLE family_members ADD CONSTRAINT check_birth_month CHECK (birth_month IS NULL OR (birth_month >= 1 AND birth_month <= 12));
