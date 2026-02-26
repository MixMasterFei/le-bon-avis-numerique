import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Security headers applied to all responses
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  return response
}

// Routes that require authentication
const protectedRoutes = ["/profil", "/mes-avis", "/ma-liste", "/mes-favoris", "/chez-vous"]

// Routes that require admin role (both UI and API)
const adminRoutes = ["/admin", "/api/admin"]

// API routes with their rate limit types
const rateLimitedRoutes: Record<string, string> = {
  "/api/auth/register": "auth",
  "/api/auth/callback": "auth",
  "/api/movies/search": "search",
  "/api/tv/search": "search",
  "/api/games/search": "search",
  "/api/books/search": "search",
  "/api/movies": "api",
  "/api/tv": "api",
  "/api/games": "api",
  "/api/books": "api",
  "/api/media": "api",
}

// Rate limit configuration
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  auth: { maxRequests: 5, windowMs: 60000 },
  search: { maxRequests: 30, windowMs: 60000 },
  api: { maxRequests: 100, windowMs: 60000 },
  admin: { maxRequests: 50, windowMs: 60000 },
}

// In-memory rate limiting (per-instance only).
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>()

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const clientIp = getClientIp(request)
    const limitType = getRateLimitType(pathname)

    const rateLimitResult = await checkRateLimit(clientIp, limitType)

    if (!rateLimitResult.allowed) {
      return applySecurityHeaders(new NextResponse(
        JSON.stringify({
          error: "Trop de requetes. Veuillez reessayer plus tard.",
          retryAfter: Math.ceil(rateLimitResult.resetIn / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil(
              rateLimitResult.resetIn / 1000
            ).toString(),
            "Retry-After": Math.ceil(rateLimitResult.resetIn / 1000).toString(),
          },
        }
      ))
    }
  }

  // Check admin routes
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    // Allow cron/automation requests with valid CRON_SECRET
    const authHeader = request.headers.get("authorization")
    const isCronAuth = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

    // Development-only bypass - NEVER works in production
    const isDev = process.env.NODE_ENV === "development"
    const bypassAuth = isDev && process.env.ADMIN_BYPASS_AUTH === "true"

    if (!isCronAuth && !bypassAuth) {
      const { auth } = await import("@/lib/auth")
      const session = await auth()

      if (!session?.user) {
        // API routes get JSON response, UI routes get redirected
        if (pathname.startsWith("/api/")) {
          return applySecurityHeaders(new NextResponse(
            JSON.stringify({ error: "Authentification requise" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          ))
        }
        const url = new URL("/connexion", request.url)
        url.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(url)
      }

      if (session.user.role !== "ADMIN") {
        return applySecurityHeaders(new NextResponse(
          JSON.stringify({ error: "Acces non autorise" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        ))
      }
    }
  }

  // Check protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const { auth } = await import("@/lib/auth")
    const session = await auth()

    if (!session?.user) {
      const url = new URL("/connexion", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }
  }

  return applySecurityHeaders(NextResponse.next())
}

// Get client IP from request headers
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")

  return (
    cfConnectingIp ||
    realIp ||
    forwarded?.split(",")[0]?.trim() ||
    "unknown"
  )
}

// Determine rate limit type for a route
function getRateLimitType(pathname: string): string {
  for (const [route, type] of Object.entries(rateLimitedRoutes)) {
    if (pathname.startsWith(route)) {
      return type
    }
  }
  return "api"
}

// Unified rate limit check: in-memory only
async function checkRateLimit(
  clientIp: string,
  limitType: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  return checkInMemoryRateLimit(clientIp, limitType)
}

function checkInMemoryRateLimit(
  clientIp: string,
  limitType: string
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMITS[limitType] || RATE_LIMITS.api
  const now = Date.now()
  const key = `${clientIp}:${limitType}`

  const entry = rateLimitStore.get(key)

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k)
      }
    }
  }

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

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match admin routes
    "/admin/:path*",
    // Match protected routes
    "/profil/:path*",
    "/mes-avis/:path*",
    "/ma-liste/:path*",
    "/mes-favoris/:path*",
    "/chez-vous/:path*",
  ],
}
