import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { compare } from "bcryptjs"
import { prisma } from "./db"
import type { Adapter } from "next-auth/adapters"
import { createSessionVersion, decodeSessionToken, validateSessionToken } from "./auth-session"
import { handleGoogleAccountLinking } from "./google-account-linking"

const googleClientId =
  process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET

const oauthProviders = []

if (googleClientId && googleClientSecret) {
  oauthProviders.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  )
} else {
  console.warn(
    "[auth] Google OAuth disabled: set AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET"
  )
}

// `updateSession` (NextAuth's unstable_update) re-issues the session JWT
// server-side — the jwt callback runs with trigger "update" and re-fetches the
// user from the DB. Used by the onboarding PATCH so the cookie's
// onboardingCompleted flips in the SAME response; relying on the client's
// useSession().update() proved flaky and left a stale cookie that the
// middleware then bounced back to /onboarding.
export const { handlers, signIn, signOut, auth, unstable_update: updateSession } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  trustHost: true,
  session: { strategy: "jwt" },
  jwt: { decode: decodeSessionToken },
  pages: {
    signIn: "/connexion",
    error: "/connexion",
  },
  providers: [
    ...oauthProviders,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (typeof credentials?.email !== "string" || typeof credentials?.password !== "string" || !credentials.email || !credentials.password) {
          throw new Error("Email et mot de passe requis")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user || !user.password) {
          throw new Error("Email ou mot de passe incorrect")
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Email ou mot de passe incorrect")
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          authVersion: await createSessionVersion(user),
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        return handleGoogleAccountLinking({
          user, account, profile,
          getAuthenticatedUserId: async () => (await auth())?.user?.id ?? null,
        })
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      // If the url is relative, prefix it with baseUrl
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // If the url is on the same origin, allow it
      if (new URL(url).origin === baseUrl) return url
      // Default post-login destination
      return `${baseUrl}/profil`
    },
    jwt: validateSessionToken,
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id || token.sub) as string
        session.user.role = token.role as string
        session.user.onboardingCompleted = token.onboardingCompleted as boolean ?? true
        // Keep name and image in sync with token
        session.user.name = token.name
        if (token.picture !== undefined) {
          session.user.image = token.picture as string | null
        }
      }
      return session
    },
  },
})

// Helper to check if user is admin
export async function isAdmin() {
  const session = await auth()
  return session?.user?.role === "ADMIN"
}

// Helper to check if user is authenticated
export async function isAuthenticated() {
  const session = await auth()
  return !!session?.user
}

// Helper to get current user
export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) return null

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  })
}
