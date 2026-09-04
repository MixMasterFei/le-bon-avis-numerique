import type { NextAuthConfig } from "next-auth"
import { decode as decodeJwt, type JWTDecodeParams } from "next-auth/jwt"
import { prisma } from "./db"

type AuthState = {
  id: string
  email: string
  password: string | null
  createdAt: Date
}

/**
 * Bind a session to the credentials that existed when authentication succeeded.
 * Only this keyed digest enters the JWT, never the password hash itself. Profile,
 * role and onboarding changes deliberately do not change the digest.
 */
export async function createSessionVersion(user: AuthState): Promise<string> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("An auth secret is required to validate sessions")

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(JSON.stringify([
      "totem-session-v1", user.id, user.createdAt.toISOString(), user.email, user.password,
    ])),
  )
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

type JwtCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>
type CallbackInput = Pick<Parameters<JwtCallback>[0], "token"> & Partial<Omit<Parameters<JwtCallback>[0], "token">>

export const validateSessionToken = async ({ token, user, account, trigger }: CallbackInput) => {
  const isSignIn = (trigger === "signIn" || trigger === "signUp") && !!user?.id
  const id = isSignIn ? user.id : token.id || token.sub
  if (!id || typeof id !== "string") return null

  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      password: true,
      createdAt: true,
      role: true,
      name: true,
      image: true,
      onboardingCompleted: true,
    },
  })
  if (!dbUser) return null

  const currentVersion = await createSessionVersion(dbUser)
  if (isSignIn) {
    // Credentials may change between password comparison and JWT issuance.
    // Preserve the auth state actually verified by authorize(), not a newer one.
    if (account?.provider === "credentials" && user.authVersion !== currentVersion) return null
    token.authVersion = currentVersion
  } else if (token.authVersion !== currentVersion) {
    // Includes pre-deployment JWTs with no version. They must sign in once:
    // silently upgrading them would also revive a session after a reset.
    // An explicit client session update must never bypass this check.
    return null
  }

  // Authorization uses current database state on EVERY session check. Do not
  // catch DB errors and return the previous role: Auth.js fails closed on errors.
  token.id = dbUser.id
  token.sub = dbUser.id
  token.role = dbUser.role
  token.name = dbUser.name
  token.email = dbUser.email
  token.picture = dbUser.image
  token.onboardingCompleted = dbUser.onboardingCompleted
  return token
}

/**
 * Auth.js also decodes JWTs directly during OAuth account linking, without
 * running the jwt callback. Validate that path too so a revoked cookie cannot
 * attach a new Google identity to the former session's account.
 */
export async function decodeSessionToken(params: JWTDecodeParams) {
  const token = await decodeJwt(params)
  return token ? validateSessionToken({ token }) : null
}
