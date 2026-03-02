-- Migration: Add enrichment v2 fields to content_metrics
-- Adds confidence scoring, tone/pacing/visual/emotional metadata, and pass tracking

-- Enrichment confidence (0.0 to 1.0, null = legacy item not yet scored)
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS enrichment_confidence FLOAT DEFAULT NULL;

-- Enrichment source tracking
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS enrichment_source TEXT DEFAULT 'METADATA_ONLY';

-- Pass 2 flag: true means this item should be deep-enriched
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS needs_deep_enrich BOOLEAN DEFAULT false;

-- Tone/atmosphere tags (stored as array, max 3)
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS tone_tags TEXT[] DEFAULT '{}';

-- Pacing descriptor (single value)
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS pacing TEXT DEFAULT NULL;

-- Visual style descriptor (single value)
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS visual_style TEXT DEFAULT NULL;

-- Emotional themes (stored as array, max 4)
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS emotional_themes TEXT[] DEFAULT '{}';

-- Timestamps for pass tracking
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS pass1_at TIMESTAMP(3) DEFAULT NULL;
ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS pass2_at TIMESTAMP(3) DEFAULT NULL;

-- Add check constraint for enrichment_source (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_enrichment_source'
  ) THEN
    ALTER TABLE content_metrics ADD CONSTRAINT chk_enrichment_source
      CHECK (enrichment_source IN ('METADATA_ONLY', 'AI_BASIC', 'AI_DEEP', 'EXPERT'));
  END IF;
END $$;

-- Indexes for finding items needing deep enrichment and confidence queries
CREATE INDEX IF NOT EXISTS idx_content_metrics_needs_deep ON content_metrics(needs_deep_enrich) WHERE needs_deep_enrich = true;
CREATE INDEX IF NOT EXISTS idx_content_metrics_confidence ON content_metrics(enrichment_confidence);

SELECT 'Migration: enrichment v2 fields added successfully!' as status;
