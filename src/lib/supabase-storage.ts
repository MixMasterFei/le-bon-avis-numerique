import { createClient, SupabaseClient } from "@supabase/supabase-js"

const BUCKET = "media-images"

// ── Singleton Supabase admin client (server-side only) ───────

let supabaseAdmin: SupabaseClient | null = null

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin) return supabaseAdmin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn("[supabase-storage] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — image storage disabled")
    return null
  }

  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false },
  })
  return supabaseAdmin
}

// ── Check if storage is configured ───────────────────────────

export function isStorageEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ── Core: fetch remote image and upload to Supabase Storage ──

export async function uploadImageFromUrl(
  sourceUrl: string,
  storagePath: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  try {
    // Fetch the image from the external source
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const arrayBuffer = await response.arrayBuffer()

    // Skip empty or tiny responses (likely error pages)
    if (arrayBuffer.byteLength < 1000) return null

    // Upload to Supabase Storage (upsert to allow re-runs)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, new Uint8Array(arrayBuffer), {
        contentType,
        upsert: true,
        cacheControl: "31536000", // 1 year
      })

    if (error) {
      console.error(`[supabase-storage] Upload error for ${storagePath}:`, error.message)
      return null
    }

    // Return the public URL
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return data.publicUrl
  } catch (err) {
    console.error(`[supabase-storage] Failed to upload from ${sourceUrl}:`, err)
    return null
  }
}

// ── Specialized upload helpers ───────────────────────────────

export async function uploadPoster(
  mediaId: string,
  sourceUrl: string,
): Promise<string | null> {
  return uploadImageFromUrl(sourceUrl, `posters/${mediaId}.jpg`)
}

export async function uploadBackdrop(
  mediaId: string,
  sourceUrl: string,
): Promise<string | null> {
  return uploadImageFromUrl(sourceUrl, `backdrops/${mediaId}.jpg`)
}

export async function uploadScreenshot(
  screenshotId: string,
  sourceUrl: string,
): Promise<string | null> {
  return uploadImageFromUrl(sourceUrl, `screenshots/${screenshotId}.jpg`)
}

/**
 * Mirrors a news story's lead image into Supabase. The storage path
 * is keyed off a content hash of the source URL so the same image
 * referenced from multiple stories dedupes naturally and re-runs are
 * idempotent. Returns the Supabase public URL on success, null on
 * failure (caller should drop the story).
 */
export async function uploadNewsImage(sourceUrl: string): Promise<string | null> {
  if (!isStorageEnabled()) return null
  const { createHash } = await import("crypto")
  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 20)
  return uploadImageFromUrl(sourceUrl, `news/${hash}.jpg`)
}

// ── Upload TMDB images with fallback to original URL ─────────

export async function uploadTMDBPoster(
  mediaId: string,
  posterPath: string | null,
  size: string = "w500",
): Promise<string | null> {
  if (!posterPath) return null
  const tmdbUrl = `https://image.tmdb.org/t/p/${size}${posterPath}`
  if (!isStorageEnabled()) return tmdbUrl
  const stored = await uploadPoster(mediaId, tmdbUrl)
  return stored ?? tmdbUrl
}

export async function uploadTMDBBackdrop(
  mediaId: string,
  backdropPath: string | null,
  size: string = "w1280",
): Promise<string | null> {
  if (!backdropPath) return null
  const tmdbUrl = `https://image.tmdb.org/t/p/${size}${backdropPath}`
  if (!isStorageEnabled()) return tmdbUrl
  const stored = await uploadBackdrop(mediaId, tmdbUrl)
  return stored ?? tmdbUrl
}

// ── URL validation ───────────────────────────────────────────

export async function isImageUrlValid(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

// ── Check if a URL is already on Supabase Storage ────────────

export function isSupabaseUrl(url: string | null): boolean {
  if (!url) return false
  return url.includes("supabase.co/storage/")
}
