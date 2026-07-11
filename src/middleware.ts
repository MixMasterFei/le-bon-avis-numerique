import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Security headers applied to all responses
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  // geolocation=(self) — same-origin only. Required for the Météo
  // widget's "Activer la localisation" prompt on /apercudecouverte-v3.
  // camera and microphone stay fully denied (no feature uses them).
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  return response
}

// Routes that require authentication
const protectedRoutes = ["/profil", "/mes-avis", "/ma-liste", "/mes-favoris"]

// Routes that require admin role (both UI and API)
const adminRoutes = ["/admin", "/api/admin"]
// Note: /studio is NOT protected here — Sanity Studio has its own auth (Sanity accounts)

// API routes with their rate limit types.
// Auth-bucket routes (5/min) cover anything an attacker can abuse for
// email enumeration, token brute-forcing, or transactional-email spam:
// signin (callback), signup (register), password reset request +
// completion, email-verification resend, and email-verification token
// confirmation. Any new auth endpoint should land here, not in the
// generic 100/min "api" fallback.
const rateLimitedRoutes: Record<string, string> = {
  "/api/auth/register": "auth",
  "/api/auth/callback": "auth",
  "/api/auth/forgot-password": "auth",
  "/api/auth/reset-password": "auth",
  "/api/auth/resend-verification": "auth",
  "/api/auth/verify-email": "auth",
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

// E2E suites drive every request from a single localhost IP, so the whole
// run shares one bucket — the per-test sign-ins alone (auth: 5/min) and the
// seed calls quickly trip the limiter and fail unrelated specs. ALLOW_TEST_SEED
// is only ever set in the isolated CI test environment (it also gates the
// dev-only seed route), so it doubles as a safe "skip rate limiting here"
// signal. It is NEVER set on public production.
const RATE_LIMIT_DISABLED = process.env.ALLOW_TEST_SEED === "true"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting for API routes
  if (pathname.startsWith("/api/") && !RATE_LIMIT_DISABLED) {
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

  // Onboarding redirect — force new users to complete onboarding
  // Skip for: API routes, auth routes, onboarding page itself, static files
  // A media fiche carrying ?fit=1 is the intentional quick family-fit funnel:
  // OAuth returns there, the user creates one minimal member inline, then that
  // flow marks onboarding complete. Keep every other page on the full wizard.
  const isMediaFamilyFitReturn =
    pathname.startsWith("/media/") &&
    request.nextUrl.searchParams.get("fit") === "1"
  const skipOnboarding =
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/connexion") ||
    pathname.startsWith("/inscription") ||
    pathname.startsWith("/mot-de-passe-oublie") ||
    pathname.startsWith("/reinitialiser-mot-de-passe") ||
    pathname.startsWith("/verifier-email") ||
    isMediaFamilyFitReturn ||
    pathname.includes(".")

  if (!skipOnboarding) {
    try {
      const { getToken } = await import("next-auth/jwt")
      // NextAuth v5's getToken does NOT read AUTH_SECRET from the environment
      // on its own — without an explicit `secret` it THROWS ("Must pass
      // `secret`"), which the catch below used to swallow, leaving this whole
      // redirect silently dead (new users never saw /onboarding at all).
      const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })
      if (token && token.onboardingCompleted === false) {
        return NextResponse.redirect(new URL("/onboarding", request.url))
      }
    } catch (error) {
      // Token parsing failed — don't block the request, but never fail
      // silently again (a swallowed throw here is how the redirect died).
      console.error("[middleware] onboarding getToken failed:", error instanceof Error ? error.message : error)
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
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)",
  ],
}
