-- PREPARED, NOT APPLIED — needs Xavier's OK before it touches production (F02).
--
-- « Amélie et la métaphysique des tubes » (2025, movie:e286693a-d577-4da7-8f3f-df2ff360bc28)
-- shows « Ce qui peut marquer » empty and an 8+ verdict with a reassuring quick
-- answer. The automated pass (AI_BASIC, 2026-08-04, confidence 0.72) only had
-- the premise synopsis of a 2025 film and flagged nothing.
--
-- Source — BBFC, « Little Amélie » (UK release title), rated PG for « mild
-- threat, upsetting scenes »:
--   https://www.bbfc.co.uk/release/little-amelie-q29sbgvjdglvbjpwwc0xmdq4mjq2
-- As read on 2026-11-07 (through search; the page itself was not reachable
-- from the agent's sandbox — re-read it verbatim before applying):
--   * two scenes in which a toddler falls into water and begins to drown
--     before being rescued;
--   * a woman who survived WWII as a child describes a bomb attack that killed
--     her family (minimal verbal detail);
--   * occasional scenes of complex feelings, emotional upset and bereavement
--     (the girl learns her grandmother has died), handled sensitively — the
--     tone is not dark or distressing;
--   * a fish is beheaded, without bloody detail; brief, mild sibling bullying.
-- The BBFC describes the near-drownings as falls into water. Do NOT word them
-- as a suicide attempt: the source doesn't say so.
--
-- What changes (content_metrics only; the age stays 8+ — a separate call):
--   * sensitive_warnings: closed-vocabulary categories (src/lib/sensitive-warnings.ts),
--     shown behind « afficher (peut divulgâcher) » on the fiche;
--   * what_parents_need_to_know: three spoiler-aware bullets APPENDED (existing
--     bullets kept, a bullet already present is not added twice);
--   * sensitive_warnings_at = now().
-- The content_metrics trigger then moves media_items.content_updated_at
-- (« Fiche mise à jour le », JSON-LD dateModified, /md); the fiche refreshes
-- within its 1 h ISR window.
--
-- Stability: no automatic sweep re-processes this title (recalibration targets
-- an axis ≥ 4 or an all-zero row; the legacy sweep targets sensitive_warnings_at
-- IS NULL). Only a forced re-enrichment of this one title would overwrite the
-- edit — don't force one afterwards.
--
-- How to apply: run STEP 0 and keep its output (it is the rollback), review the
-- strings, then run STEP 1 in one transaction and STEP 2 to check.

-- STEP 0 — current state (save the output).
SELECT m.id, m.title, m.expert_age_rec, cm.enrichment_source, cm.enrichment_confidence,
       cm.sensitive_warnings, cm.sensitive_warnings_at, cm.what_parents_need_to_know,
       m.content_updated_at
FROM media_items m
JOIN content_metrics cm ON cm.media_id = m.id
WHERE m.id = 'e286693a-d577-4da7-8f3f-df2ff360bc28';

-- STEP 1 — the correction. The guard (still empty) makes it a no-op if the
-- warnings were changed in the meantime; expect « UPDATE 1 ».
BEGIN;

UPDATE content_metrics
SET
  sensitive_warnings = ARRAY[
    'Noyade',
    'Thèmes de mort ou de deuil',
    'Guerre',
    'Détresse émotionnelle',
    'Mort d''un animal'
  ]::text[],
  sensitive_warnings_at = now(),
  what_parents_need_to_know = what_parents_need_to_know || ARRAY(
    SELECT bullet
    FROM unnest(ARRAY[
      'Deux scènes où Amélie, encore toute petite, tombe dans l''eau et commence à se noyer avant d''être secourue : elles peuvent impressionner les plus jeunes.',
      'Une femme raconte avoir perdu sa famille, enfant, dans un bombardement de la Seconde Guerre mondiale ; le récit est bref et peu détaillé.',
      'Le film aborde la mort d''un proche et le deuil, avec délicatesse et à hauteur d''enfant : le ton reste doux, jamais sombre.'
    ]::text[]) AS bullet
    WHERE bullet <> ALL (coalesce(what_parents_need_to_know, '{}'::text[]))
  )
WHERE media_id = 'e286693a-d577-4da7-8f3f-df2ff360bc28'
  AND sensitive_warnings = '{}'::text[];

COMMIT;

-- STEP 2 — check: five categories, the three bullets at the end, a fresh
-- sensitive_warnings_at and content_updated_at.
SELECT cm.sensitive_warnings, cm.sensitive_warnings_at, cm.what_parents_need_to_know, m.content_updated_at
FROM content_metrics cm
JOIN media_items m ON m.id = cm.media_id
WHERE cm.media_id = 'e286693a-d577-4da7-8f3f-df2ff360bc28';

-- ROLLBACK (only if needed) — put back the STEP 0 values, e.g.:
-- UPDATE content_metrics
-- SET sensitive_warnings = '{}'::text[],
--     sensitive_warnings_at = '<STEP 0 sensitive_warnings_at>',
--     what_parents_need_to_know = '<STEP 0 what_parents_need_to_know>'::text[]
-- WHERE media_id = 'e286693a-d577-4da7-8f3f-df2ff360bc28';
