/**
 * Security utilities for input sanitization and rate limiting
 */

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return ""

  return input
    // Remove null bytes
    .replace(/\0/g, "")
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, "")
    // Limit length
    .slice(0, 1000)
}

/**
 * Sanitize search query for external API calls
 * More permissive than full sanitization but still safe
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== "string") return ""

  return query
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, "")
    // Remove potentially dangerous characters for API queries
    .replace(/[<>{}[\]\\]/g, "")
    // Limit length
    .slice(0, 200)
    .trim()
}

/**
 * Escape special characters for IGDB query language
 */
export function escapeIGDBQuery(query: string): string {
  if (typeof query !== "string") return ""

  return query
    // Escape double quotes (IGDB uses them for string literals)
    .replace(/"/g, '\\"')
    // Escape backslashes
    .replace(/\\/g, "\\\\")
    // Remove semicolons (IGDB query separator)
    .replace(/;/g, "")
    // Remove null bytes
    .replace(/\0/g, "")
    // Limit length
    .slice(0, 200)
    .trim()
}

/**
 * Validate and sanitize numeric input
 */
export function sanitizeNumber(
  input: unknown,
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  const num = Number(input)
  if (isNaN(num)) return null
  return Math.min(Math.max(Math.floor(num), min), max)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean every minute

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export const RATE_LIMITS = {
  // Standard API endpoints
  api: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
  // Search endpoints (more expensive)
  search: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
  // Auth endpoints (strict)
  auth: { maxRequests: 5, windowMs: 60000 }, // 5 requests per minute
  // Admin endpoints
  admin: { maxRequests: 50, windowMs: 60000 }, // 50 requests per minute
} as const

/**
 * Check if request should be rate limited
 * Returns remaining requests or -1 if rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const key = identifier

  const entry = rateLimitStore.get(key)

  // No existing entry or expired
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    }
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  }
}

/**
 * Get client identifier for rate limiting
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")

  const ip =
    cfConnectingIp ||
    realIp ||
    forwarded?.split(",")[0]?.trim() ||
    "unknown"

  return ip
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(
  remaining: number,
  resetIn: number
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(resetIn / 1000).toString(),
  }
}
