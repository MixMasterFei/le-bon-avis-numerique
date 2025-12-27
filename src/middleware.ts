import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

// Routes that require authentication
const protectedRoutes = ["/profil", "/mes-avis"]

// Routes that require admin role
const adminRoutes = ["/admin"]

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const clientIp = getClientIp(request)
    const limitType = getRateLimitType(pathname)

    // Simple in-memory rate limiting for middleware
    // For production, use Redis or Upstash
    const rateLimitResult = await checkMiddlewareRateLimit(
      clientIp,
      limitType,
      pathname
    )

    if (!rateLimitResult.allowed) {
      return new NextResponse(
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
      )
    }
  }

  // Check admin routes
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    // Development-only bypass - NEVER works in production
    const isDev = process.env.NODE_ENV === "development"
    const bypassAuth = isDev && process.env.ADMIN_BYPASS_AUTH === "true"

    if (!bypassAuth) {
      const session = await auth()

      if (!session?.user) {
        const url = new URL("/connexion", request.url)
        url.searchParams.set("callbackUrl", pathname)
        return NextResponse.redirect(url)
      }

      if (session.user.role !== "ADMIN") {
        return new NextResponse(
          JSON.stringify({ error: "Acces non autorise" }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        )
      }
    }
  }

  // Check protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    const session = await auth()

    if (!session?.user) {
      const url = new URL("/connexion", request.url)
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
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

// Rate limit configuration
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  auth: { maxRequests: 5, windowMs: 60000 },
  search: { maxRequests: 30, windowMs: 60000 },
  api: { maxRequests: 100, windowMs: 60000 },
  admin: { maxRequests: 50, windowMs: 60000 },
}

// Simple in-memory rate limit store for edge runtime
// Note: This is per-instance. For production, use Redis/Upstash
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>()

async function checkMiddlewareRateLimit(
  clientIp: string,
  limitType: string,
  pathname: string
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
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
  ],
}
