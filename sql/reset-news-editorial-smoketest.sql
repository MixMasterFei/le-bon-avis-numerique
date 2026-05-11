-- Reset the 5 rows the local smoke test of the editorial-judge
-- tagged with the fail-open default ({ tone:"neutral", cluster:null })
-- because the local environment was missing ANTHROPIC_API_KEY.
--
-- Without this reset, the backfill script (which skips rows that
-- already have a non-null tone) would never re-classify them.
--
-- Safe to re-run: matches only rows tagged exactly to the fail-open
-- shape, leaves legitimate "neutral"/null verdicts alone if any
-- exist (very rare — most stories get a real cluster).

UPDATE news_stories
SET editorial_tone = NULL,
    topic_cluster = NULL,
    updated_at = NOW()
WHERE editorial_tone = 'neutral'
  AND topic_cluster IS NULL;
