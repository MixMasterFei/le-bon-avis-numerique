# Enrichment Pipeline

Three-phase pipeline for generating content analysis (age ratings, metrics, tags, tone, etc.) on media items.

## Phase 1 — Confidence Scoring (free)

```bash
npx tsx scripts/backfill-enrichment.ts --confidence-only
```

- **No AI call** — pure heuristic scoring on already-enriched items
- Assigns `enrichmentConfidence` (0.1-1.0) based on data quality signals:
  - Positive: long synopsis, multiple genres, official rating, high vote count
  - Negative: short/missing synopsis, no genres, few parent tips
- Items with confidence < 0.6 are flagged `needsDeepEnrich: true`
- Sets `enrichmentSource: "AI_BASIC"` and `pass1At`
- **Cost:** $0

## Phase 2 — Full Re-enrichment with V2 prompt

```bash
npx tsx scripts/backfill-enrichment.ts --full-reenrich [--limit N] [--dry-run]
```

- **Model:** `gpt-5-mini` via `chat.completions.create`
- **Targets:** Items missing V2 fields (`toneTags` empty OR `enrichmentConfidence` null)
- Re-runs the full enrichment prompt to add V2 metadata:
  - `toneTags` (1-3): tone/mood of the content
  - `pacing` (1): rhythm
  - `visualStyle` (1): animation type or live action
  - `emotionalThemes` (1-4): what the viewer feels
- Also recalculates all metrics, synopsis, tags, and confidence
- Items still below 0.6 confidence get flagged `needsDeepEnrich: true`
- Sets `enrichmentSource: "AI_BASIC"` and `pass1At`
- **Cost:** ~$0.0013/item

## Phase 3 — Deep Enrichment with web search

```bash
npx tsx scripts/backfill-enrichment.ts --deep --limit 500 [--dry-run]
```

- **Model:** `gpt-5` (full) via `responses.create` with `web_search_preview` tool
- **Targets:** Only items where `needsDeepEnrich: true` (low confidence after Phase 2)
- Verifies and corrects Phase 2's analysis using the model's knowledge + web search
- Produces a `corrections[]` list documenting what changed
- Sets `enrichmentSource: "AI_DEEP"`, `needsDeepEnrich: false`, and `pass2At`
- **Cost:** ~$0.02/item

## Automated (Cron)

The cron workflow (`cron.yml`) runs enrichment automatically:

| Day | What | Endpoint |
|---|---|---|
| Monday + Thursday | Phase 2 (new items) | `POST /api/admin/enrich` — 30 movies + 20 TV + 10 games per batch |
| Thursday | Phase 3 (low confidence) | `POST /api/admin/enrich-deep` — 2 batches of 5 items |

Phase 1 (confidence scoring) is only run manually since it's a one-time backfill operation.

## Key Database Fields (ContentMetrics)

| Field | Description |
|---|---|
| `enrichmentConfidence` | 0.0-1.0, AI self-reported + heuristic adjustments |
| `enrichmentSource` | `"AI_BASIC"` (Phase 1/2) or `"AI_DEEP"` (Phase 3) |
| `needsDeepEnrich` | `true` if confidence < 0.6, cleared by Phase 3 |
| `pass1At` | Timestamp of last Phase 1/2 enrichment |
| `pass2At` | Timestamp of last Phase 3 deep enrichment |
| `toneTags` | V2 field — mood/tone tags |
| `pacing` | V2 field — rhythm |
| `visualStyle` | V2 field — animation/live action style |
| `emotionalThemes` | V2 field — emotional themes |

## Valid Closed Lists

All V2 fields are validated against closed lists defined in both `scripts/backfill-enrichment.ts` and `src/app/api/admin/enrich/route.ts`. Values outside the list are filtered out. See those files for the full lists.
