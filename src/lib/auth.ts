import NextAuth, { CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { compare } from "bcryptjs"
import { prisma } from "./db"
import type { Adapter } from "next-auth/adapters"

// Custom credentials error whose `code` propagates to the client (Auth.js sets
// `?code=` on the redirect for any CredentialsSignin subclass). Lets the login
// page distinguish "email not verified" from a wrong password and offer to
// resend the verification link. A plain `throw new Error(...)` would surface as
// a generic CallbackRouteError with the message stripped, so the message never
// reaches the browser.
class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified"
}

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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  trustHost: true,
  session: { strategy: "jwt" },
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
        // Return null for invalid credentials → Auth.js surfaces the generic
        // CredentialsSignin error. Only the unverified-email case throws a
        // typed error so the client can react to it specifically.
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Normalize the email the same way registration does (lowercase +
        // trim) so a differently-cased login ("John@Example.com") still
        // matches the stored "john@example.com" row.
        const email = (credentials.email as string).toLowerCase().trim()

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError()
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Auto-link Google OAuth to existing accounts (Google verifies emails)
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        })
        if (existingUser) {
          // Check if this Google account is already linked
          const alreadyLinked = existingUser.accounts.some(
            (a) => a.provider === "google"
          )
          if (!alreadyLinked) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            })
            // Google has verified this email, so mark the (possibly still
            // unverified) credentials account as verified, and backfill the
            // avatar if we don't have one yet.
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                emailVerified: existingUser.emailVerified ?? new Date(),
                ...(!existingUser.image && user.image
                  ? { image: user.image }
                  : {}),
              },
            })
          }
        }
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as { role?: string }).role || "USER"
      }
      // Fetch user data if we have sub (from OAuth) but not id
      if (!token.id && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { id: true, role: true, name: true, onboardingCompleted: true },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
            token.name = dbUser.name
            token.onboardingCompleted = dbUser.onboardingCompleted
          }
        } catch (error) {
          console.error("[auth] JWT: failed to fetch user by sub:", error)
          // Safe default — don't block login
          token.onboardingCompleted = token.onboardingCompleted ?? true
        }
      }
      // Fetch onboardingCompleted on first sign-in if not yet set
      if (token.id && token.onboardingCompleted === undefined) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { onboardingCompleted: true },
          })
          if (dbUser) {
            token.onboardingCompleted = dbUser.onboardingCompleted
          }
        } catch (error) {
          console.error("[auth] JWT: failed to fetch onboardingCompleted:", error)
          token.onboardingCompleted = true
        }
      }
      // Refresh user data on update trigger
      if (trigger === "update" && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, role: true, image: true, onboardingCompleted: true },
          })
          if (dbUser) {
            token.name = dbUser.name
            token.role = dbUser.role
            token.picture = dbUser.image
            token.onboardingCompleted = dbUser.onboardingCompleted
          }
        } catch (error) {
          console.error("[auth] JWT: failed to refresh user data:", error)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id || token.sub) as string
        session.user.role = token.role as string
        session.user.onboardingCompleted = token.onboardingCompleted as boolean ?? true
        // Keep name and image in sync with token
        if (token.name) {
          session.user.name = token.name as string
        }
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
