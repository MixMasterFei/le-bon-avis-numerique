import { createAvatar } from "@dicebear/core"
import * as funEmoji from "@dicebear/fun-emoji"
import * as adventurer from "@dicebear/adventurer"
import * as bigSmile from "@dicebear/big-smile"
import * as lorelei from "@dicebear/lorelei"
import * as notionists from "@dicebear/notionists"
import * as bottts from "@dicebear/bottts"
import * as pixelArt from "@dicebear/pixel-art"
import * as thumbs from "@dicebear/thumbs"

export interface AvatarStyleInfo {
  id: string
  label: string
  description: string
  style: Parameters<typeof createAvatar>[0]
}

export const AVATAR_STYLES: AvatarStyleInfo[] = [
  { id: "fun-emoji", label: "Emojis rigolos", description: "Amusant et expressif", style: funEmoji },
  { id: "adventurer", label: "Aventurier", description: "Personnages illustrés", style: adventurer },
  { id: "big-smile", label: "Sourire", description: "Joyeux et chaleureux", style: bigSmile },
  { id: "lorelei", label: "Élégant", description: "Raffiné et moderne", style: lorelei },
  { id: "notionists", label: "Moderne", description: "Épuré et contemporain", style: notionists },
  { id: "bottts", label: "Robots", description: "Fun et futuriste", style: bottts },
  { id: "pixel-art", label: "Rétro", description: "Style jeu vidéo", style: pixelArt },
  { id: "thumbs", label: "Pouces", description: "Minimaliste et fun", style: thumbs },
]

const STYLE_MAP: Record<string, Parameters<typeof createAvatar>[0]> = Object.fromEntries(
  AVATAR_STYLES.map((s) => [s.id, s.style])
)

export const VALID_STYLE_IDS = new Set(AVATAR_STYLES.map((s) => s.id))

export const DEFAULT_STYLE = "fun-emoji"

export const MAX_SEED_LENGTH = 50

export const BACKGROUND_COLORS = [
  "e8d5f5", // violet pastel
  "fce7f3", // pink pastel
  "fef3c7", // amber pastel
  "d1fae5", // emerald pastel
  "dbeafe", // blue pastel
  "fef9c3", // yellow pastel
  "ffe4e6", // rose pastel
  "e0e7ff", // indigo pastel
]

/**
 * Validate avatar style ID against whitelist.
 */
export function isValidStyle(style: string): boolean {
  return VALID_STYLE_IDS.has(style)
}

/**
 * Sanitize avatar inputs for API persistence.
 */
export function sanitizeAvatarInput(input: {
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
}): { avatarStyle: string | null; avatarSeed: string | null; avatarOptions: Record<string, unknown> | null } {
  const style = input.avatarStyle && isValidStyle(input.avatarStyle) ? input.avatarStyle : null
  const seed = input.avatarSeed ? input.avatarSeed.slice(0, MAX_SEED_LENGTH) : null
  // Cap options JSON size to 1KB
  let options: Record<string, unknown> | null = null
  if (input.avatarOptions && JSON.stringify(input.avatarOptions).length <= 1024) {
    options = input.avatarOptions
  }
  return { avatarStyle: style, avatarSeed: seed, avatarOptions: options }
}

/**
 * Generate a DiceBear avatar as a data URI string.
 */
export function getAvatarDataUri(
  style: string,
  seed: string,
  options?: Record<string, unknown>,
  size = 128
): string {
  const styleObj = STYLE_MAP[style] ?? STYLE_MAP[DEFAULT_STYLE]
  const avatar = createAvatar(styleObj, {
    seed,
    size,
    ...options,
  })
  return avatar.toDataUri()
}

/**
 * Convert a legacy emoji to a deterministic seed for DiceBear migration.
 */
export function emojiToSeed(emoji: string): string {
  return Array.from(emoji)
    .map((char) => char.codePointAt(0)?.toString(16) ?? "0")
    .join("-")
}

/**
 * Generate a random seed string for a new avatar.
 */
export function randomSeed(): string {
  return Math.random().toString(36).substring(2, 12)
}

/**
 * Resolve avatar params: if DiceBear fields exist use them,
 * otherwise auto-migrate from legacy emoji.
 */
export function resolveAvatar(params: {
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  avatarEmoji?: string | null
  name?: string | null
}): { style: string; seed: string; options?: Record<string, unknown> } {
  if (params.avatarStyle && params.avatarSeed) {
    return {
      style: params.avatarStyle,
      seed: params.avatarSeed,
      options: params.avatarOptions ?? undefined,
    }
  }

  // Auto-migrate from legacy emoji
  if (params.avatarEmoji) {
    return {
      style: DEFAULT_STYLE,
      seed: emojiToSeed(params.avatarEmoji),
    }
  }

  // Fallback: use name or default
  return {
    style: DEFAULT_STYLE,
    seed: params.name ?? "default",
  }
}
