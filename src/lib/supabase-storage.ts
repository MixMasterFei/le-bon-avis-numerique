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
 * Quick dimension probe from JPEG/PNG/WebP/GIF magic bytes. Avoids
 * pulling in `sharp` or `probe-image-size` (both add 5-15MB to the
 * Lambda bundle). Returns null when format isn't recognized — caller
 * should treat that as "unknown, accept" rather than reject, since
 * some valid SVGs / odd CDN responses won't match any of these.
 */
function probeDimensions(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 24) return null
  // PNG: 8-byte signature, then IHDR with width(4) + height(4) at offset 16
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const view = new DataView(buf.buffer, buf.byteOffset)
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  // GIF: width/height little-endian at offsets 6/8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    const view = new DataView(buf.buffer, buf.byteOffset)
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }
  // JPEG: scan SOF marker (0xFFC0..C3) for dimensions. Most common case.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]
      if (marker >= 0xc0 && marker <= 0xc3) {
        const view = new DataView(buf.buffer, buf.byteOffset)
        return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) }
      }
      const segLen = (buf[i + 2] << 8) | buf[i + 3]
      i += 2 + segLen
    }
  }
  return null
}

/**
 * Mirrors a news story's lead image into Supabase. Tighter validation
 * than the generic upload: rejects content-types that aren't images,
 * payloads under 10KB (likely error/placeholder), and images too small
 * for the featured news cards. Idempotent — same source URL hashes to
 * same storage path.
 */
export async function uploadNewsImage(sourceUrl: string): Promise<string | null> {
  const result = await uploadNewsImageWithDiagnostics(sourceUrl)
  return result.url
}

export interface NewsImageUploadResult {
  url: string | null
  reason?: string
}

export async function uploadNewsImageWithDiagnostics(sourceUrl: string): Promise<NewsImageUploadResult> {
  // Our own generated fallback card (/api/news/fallback-card) is already
  // served from this app and is permanent — re-uploading it to Supabase
  // would just create one identical copy per story. Keep the route URL.
  if (sourceUrl.includes("/api/news/fallback-card")) return { url: sourceUrl }

  if (!isStorageEnabled()) return { url: null, reason: "storage_disabled" }
  const supabase = getSupabaseAdmin()
  if (!supabase) return { url: null, reason: "client_unavailable" }

  try {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return { url: null, reason: "source_http_error" }

    const contentType = response.headers.get("content-type") || ""
    if (!contentType.startsWith("image/")) {
      console.warn(`[uploadNewsImage] non-image content-type "${contentType}" for ${sourceUrl}`)
      return { url: null, reason: "non_image_content_type" }
    }

    const arrayBuffer = await response.arrayBuffer()
    // 10KB minimum — covers tracking pixels (1x1, ~70 bytes), tiny
    // favicons, and most placeholder/error responses.
    if (arrayBuffer.byteLength < 10_000) {
      console.warn(`[uploadNewsImage] payload too small (${arrayBuffer.byteLength}B) for ${sourceUrl}`)
      return { url: null, reason: "payload_too_small" }
    }

    const buf = new Uint8Array(arrayBuffer)
    const dims = probeDimensions(buf)
    // The dossier/hero cards render around 600-900px wide. Accepting
    // RSS thumbnails here makes them visibly blurry once stretched.
    // Unknown format → trust content-type and ship.
    if (dims && (dims.width < 640 || dims.height < 320)) {
      console.warn(`[uploadNewsImage] dimensions too small for news card (${dims.width}x${dims.height}) for ${sourceUrl}`)
      return { url: null, reason: "dimensions_too_small" }
    }

    const { createHash } = await import("crypto")
    const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 20)
    const storagePath = `news/${hash}.jpg`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      })
    if (error) {
      console.error(`[uploadNewsImage] storage upload error: ${error.message}`)
      return { url: null, reason: "storage_upload_error" }
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return { url: data.publicUrl }
  } catch (err) {
    console.error(`[uploadNewsImage] failed to upload ${sourceUrl}:`, err)
    return { url: null, reason: "fetch_or_upload_exception" }
  }
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

// ── Health probe ─────────────────────────────────────────────

export interface StorageHealth {
  ok: boolean
  /** Short machine-ish reason when not ok. */
  reason?: string
  /** Raw error message from the storage API, when there was one. */
  detail?: string
}

/**
 * Round-trip probe: upload a few bytes, then delete them.
 *
 * Exists because storage failures are INVISIBLE from the outside. Every call
 * site here returns null on error and its caller degrades gracefully — news
 * stories swap to the branded fallback card, imports keep the remote TMDB URL.
 * So the crons go on reporting `status:"success"` while nothing is being
 * mirrored at all. That is exactly how an upload outage starting 2026-06-16
 * ran for seven weeks before anyone noticed: 49 failed news images, plus
 * posters, backdrops and screenshots, every one of them swallowed.
 *
 * A real upload is the only honest check — the bucket can vanish or the
 * service-role key lose its grant without anything else changing, and both
 * surface only when you actually write.
 */
export async function checkStorageHealth(): Promise<StorageHealth> {
  if (!isStorageEnabled()) return { ok: false, reason: "env_missing" }
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, reason: "client_unavailable" }

  // Fixed path: upsert makes it idempotent, so concurrent probes can't clash
  // and no garbage accumulates if the delete below fails.
  const probePath = "_health/probe.txt"
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(probePath, new Uint8Array([0x6f, 0x6b]), {
        contentType: "text/plain",
        upsert: true,
        cacheControl: "0",
      })
    if (error) {
      return { ok: false, reason: "upload_failed", detail: error.message }
    }
    // Best-effort cleanup — a failure here doesn't make storage unhealthy.
    await supabase.storage.from(BUCKET).remove([probePath]).catch(() => {})
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: "exception", detail: err instanceof Error ? err.message : String(err) }
  }
}
