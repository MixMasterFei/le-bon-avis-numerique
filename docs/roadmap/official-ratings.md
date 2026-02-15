# Official Ratings Plan

**Status:** Next up (after Phase 1 polish)
**Goal:** Replace false "Tous publics" defaults with real official French classification data.

---

## Problem

The site currently labels most movies "Tous publics" because:

1. `mapCertificationToInternal()` in `src/lib/tmdb.ts` defaults `null` → `"TOUS_PUBLICS"`
2. TMDB rarely has French CSA data — their `release_dates` endpoint returns null for most films
3. Unknown ≠ "Tous publics" — this is misleading for a platform dedicated to accurate ratings

---

## Data Sources

### Primary: CNC (Centre national du cinema)

- **URL:** https://data.gouv.fr — search "visa exploitation cinematographique"
- **Records:** 95,000+ French film visa records (1945–present)
- **License:** Open license (Licence Ouverte)
- **Format:** CSV (~12MB)
- **Fields:** Titre, Realisation, Format, Date, Nationalite, N° de visa, Decision
- **Decision values:**
  - `Tout public` (85,692 records) → `TOUS_PUBLICS`
  - `Avertissement` (1,537) → `TOUS_PUBLICS` (warning but all-audiences)
  - `Interdit -12 ans` (2,008) → `CSA_12`
  - `Interdit -13 ans` (2,005) → `CSA_12` (old system, closest equivalent)
  - `Interdit -16 ans` (828) → `CSA_16`
  - `Interdit -18 ans` (1,178) → `CSA_18`
  - `Interdit mineurs` (2,128) → `CSA_18`
  - `Censure` (371) → `CSA_18`
  - Combined values (e.g. `Censure - Interdit -18 ans`) → `CSA_18`
- **Note:** Cinema only (no TV). No "-10" — that's a TV-only CSA rating.
- **API:** Tabular API at `https://tabular-api.data.gouv.fr/api/resources/1c5075ec-7ce1-49cb-ab89-94f507812daf/data/`

### Secondary: TMDB

- Already integrated via `getFrenchCertification()` and `getTVFrenchRating()`
- Useful for TV content (not covered by CNC) and recent films not yet in CNC data
- Community-contributed data — improves over time

---

## Implementation Steps

### Step 1: Stop Defaulting Unknown → "Tous Publics"

**File:** `src/lib/tmdb.ts`

Change `mapCertificationToInternal()` to return `null` instead of `"TOUS_PUBLICS"` when the cert is null or unrecognized.

```typescript
export function mapCertificationToInternal(cert: string | null): string | null {
  if (!cert) return null
  const certMap: Record<string, string> = {
    "U": "TOUS_PUBLICS", "TP": "TOUS_PUBLICS",
    "10": "CSA_10", "12": "CSA_12", "16": "CSA_16", "18": "CSA_18",
  }
  return certMap[cert] || null
}
```

**Also fix:** `src/app/api/admin/fix-certifications/route.ts` — map "NR" → `null` (not "TOUS_PUBLICS").

**Impact:** Movies with unknown classification will show "Non classe" badge instead of false "Tous publics". The `OfficialRatingBadge` component already handles `null` correctly.

---

### Step 2: Batch Reset False "Tous Publics" via TMDB Re-fetch

**New file:** `src/app/api/admin/fix-default-tp/route.ts`

Admin POST endpoint that:
1. Finds all MOVIE/TV items where `officialRating = "TOUS_PUBLICS"`
2. Re-fetches their TMDB certification via `getFrenchCertification()` using their `tmdbId`
3. If TMDB returns null → sets `officialRating` to `null` (was falsely marked TP)
4. If TMDB returns a real cert → updates to the correct value
5. Processes in batches of 20 with TMDB rate limiting (40 req/10s)
6. Returns stats: total checked, updated to null, updated to real cert, kept as TP

---

### Step 3: CNC Official Data Import

**New file:** `src/app/api/admin/import-cnc-ratings/route.ts`

Admin POST endpoint that:
1. Reads the CNC CSV (stored in `data/cnc-visas.csv`, gitignored)
2. Parses CSV fields: Titre, Realisation, Format, Date, Nationalite, N° de visa, Decision
3. Maps CNC "Decision" values to internal rating format (see Data Sources above)
4. Matches CNC records to database media items by:
   - Normalized title comparison (lowercase, remove accents, trim articles)
   - Year match (±1 year tolerance from CNC Date field)
   - Optional: director name confirmation
5. Updates `officialRating` for matched items
6. Stores `cncVisaNumber` for traceability (optional schema addition)
7. Returns stats: total CNC records, matched, updated, unmatched

**Schema change (optional):**
```prisma
model MediaItem {
  // ... existing fields
  cncVisaNumber  String?  @map("cnc_visa_number")
}
```

---

## Execution Order

| Step | What | Impact |
|------|------|--------|
| 1 | Fix default in `mapCertificationToInternal` | Unknown shows "Non classe" instead of false TP |
| 2 | Batch re-check TMDB + reset false TPs | Corrects items TMDB now has data for |
| 3 | CNC open data import (95K+ films) | Bulk-fills correct official classifications |

Steps 1 is a quick code fix. Steps 2-3 are admin data operations run once (and periodically for new data).

---

## Verification

1. **Build:** `npx next build` — no type errors
2. **Quick check:** Browse movies — "Non classe" for unknown ratings, correct ratings for known films
3. **Run TP cleanup:** `POST /api/admin/fix-default-tp` — resets false Tous Publics
4. **CNC import:** `POST /api/admin/import-cnc-ratings` — bulk import from official source
5. **Spot check:** Well-known French films:
   - "Intouchables" → Tous publics (correct)
   - "Irreversible" → -16 (correct)
   - "La Haine" → -12 (correct)
   - Random Hollywood film with no French data → "Non classe" (correct)
