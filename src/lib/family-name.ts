import { sanitizePlainText } from "@/lib/security"

/**
 * The display family name (« Famille Manza ») shown in the header pill and the
 * homepage greeting. Kept deliberately constrained so it can't break those
 * layouts: ONE word (a surname, no spaces) and a hard character cap.
 *
 * Shared by the profile dialog (client, applied on input) and the profile API
 * (server, applied on save) so the two can never diverge.
 */
export const MAX_FAMILY_NAME_LENGTH = 20

export function normalizeFamilyName(input: unknown): string {
  // Strip control chars, collapse whitespace, trim.
  const clean = sanitizePlainText(input, 100)
  if (!clean) return ""
  // One word only — a family surname. Keep the first whitespace-delimited
  // token (hyphens/apostrophes inside it are fine: "Beaumont-Delatour").
  const firstWord = clean.split(" ")[0]
  return firstWord.slice(0, MAX_FAMILY_NAME_LENGTH)
}
