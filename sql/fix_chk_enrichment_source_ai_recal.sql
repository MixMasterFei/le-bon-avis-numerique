-- Fix: chk_enrichment_source rejects 'AI_RECAL'
--
-- The recalibrate sweep (enrich route, recalibrate:true — added 2026-06-15 #31)
-- marks processed rows enrichment_source = 'AI_RECAL' so repeated batches drain
-- the set. But the check constraint (add_enrichment_v2_fields.sql) predates it
-- and only allows METADATA_ONLY / AI_BASIC / AI_DEEP / EXPERT, so every
-- recalibrate upsert failed with 23514 — the sweep re-processed the same 40
-- titles nightly (wasted LLM calls) and the supervisor flagged enrich as
-- repeated-partial every day since. Extend the allowed set.

ALTER TABLE content_metrics DROP CONSTRAINT IF EXISTS chk_enrichment_source;
ALTER TABLE content_metrics ADD CONSTRAINT chk_enrichment_source
  CHECK (enrichment_source IN ('METADATA_ONLY', 'AI_BASIC', 'AI_DEEP', 'AI_RECAL', 'EXPERT'));

SELECT 'chk_enrichment_source now allows AI_RECAL' AS status;
