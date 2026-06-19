/**
 * Golden-set CSV helpers + loader (Plan B, Step 1).
 *
 * The golden set is a hand-labeled reference (`data/golden-set/golden-set-v1.csv`):
 * the *correct* family-recommended age + per-axis content levels for ~150 titles.
 * The eval harness scores Totem and the LLM providers against THIS, not just the
 * legal floor. Dependency-free CSV read/write so the sheet opens in Excel/Sheets.
 */
import { readFileSync } from "fs"

export const GOLDEN_SET_PATH = "data/golden-set/golden-set-v1.csv"

export const AXIS_COLUMNS = {
  violence: "gold_violence",
  sexNudity: "gold_sexNudity",
  language: "gold_language",
  substanceUse: "gold_substanceUse",
  consumerism: "gold_consumerism",
  positiveMessages: "gold_positiveMessages",
  roleModels: "gold_roleModels",
} as const

export type AxisKey = keyof typeof AXIS_COLUMNS

export interface GoldLabel {
  age: number
  axes: Partial<Record<AxisKey, number>>
  notes?: string
}

// ── CSV write ──────────────────────────────────────────────
export function csvEscape(field: string | number | null | undefined): string {
  const s = field == null ? "" : String(field)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsvLine(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvEscape).join(",")
}

// ── CSV read (handles quoted fields with commas/quotes/newlines) ──
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field); field = ""
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = ""
    } else if (c !== "\r") {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

/**
 * Loads the filled golden set → Map<mediaId, GoldLabel>. Rows with a blank
 * `gold_age` are skipped, so labeling can be done incrementally.
 */
export function loadGoldenSet(path: string = GOLDEN_SET_PATH): Map<string, GoldLabel> {
  const map = new Map<string, GoldLabel>()
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch {
    return map // not generated yet
  }
  const rows = parseCsv(text)
  if (rows.length < 2) return map
  const header = rows[0].map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)
  const idI = col("id")
  const ageI = col("gold_age")
  const notesI = col("notes")
  if (idI < 0 || ageI < 0) return map

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue
    const id = (row[idI] ?? "").trim()
    if (!id) continue
    const ageRaw = (row[ageI] ?? "").trim()
    if (ageRaw === "") continue
    const age = Number(ageRaw)
    if (!Number.isFinite(age)) continue

    const axes: Partial<Record<AxisKey, number>> = {}
    for (const [key, colName] of Object.entries(AXIS_COLUMNS) as [AxisKey, string][]) {
      const ci = col(colName)
      if (ci < 0) continue
      const v = (row[ci] ?? "").trim()
      if (v === "") continue
      const n = Number(v)
      if (Number.isFinite(n)) axes[key] = n
    }
    const notes = notesI >= 0 ? (row[notesI] ?? "").trim() : ""
    map.set(id, { age: Math.round(age), axes, notes: notes || undefined })
  }
  return map
}
