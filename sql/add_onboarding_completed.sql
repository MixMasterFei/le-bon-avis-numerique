-- Add onboarding_completed flag to users table
-- Existing users are considered already onboarded
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Mark all existing users as onboarded (they don't need to go through onboarding)
UPDATE users SET onboarding_completed = true WHERE onboarding_completed = false;
