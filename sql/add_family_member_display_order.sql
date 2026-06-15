-- Family member card-priority ordering.
-- Lower display_order = shown first in the limited card slots (FamilyFitMeter);
-- the rest collapse into the "+N" overflow. Parents reorder from /profil.
-- Applied to prod via `prisma db execute` (manual-migration convention).
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
