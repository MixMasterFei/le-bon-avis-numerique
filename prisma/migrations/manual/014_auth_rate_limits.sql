-- Apply before deploying shared authentication and paid-AI request throttles.
-- Only the server's Prisma connection may access these ephemeral counters.
CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" > 0),
  "expires_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_rate_limits_expires_at_idx"
  ON "auth_rate_limits" ("expires_at");
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "auth_rate_limits" FROM anon, authenticated;
