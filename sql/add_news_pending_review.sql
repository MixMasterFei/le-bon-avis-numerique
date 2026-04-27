-- Quality judge gate (pre-publish) for /apercudecouverte-v3 articles.
-- Articles below threshold on source-fidelity / neutrality / structural
-- cleanliness / length are persisted with PENDING_REVIEW so they're
-- hidden from public surfaces but surfaced in /admin for human review.
--
-- Postgres requires ALTER TYPE in its own statement, not inside a
-- transaction with other DDL.

ALTER TYPE "NewsStoryStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
