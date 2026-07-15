-- Display family name ("Famille Dupont") chosen by the user; shown in the
-- header and homepage greeting. NULL = fall back to User.name.
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_name TEXT;
