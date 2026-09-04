import type { Account, Profile, User } from "next-auth"
import { prisma } from "./db"

const ACCOUNT_NOT_LINKED = "/connexion?error=OAuthAccountNotLinked"

/** Claims must come from the Google profile validated by Auth.js, never a request body.
 * https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
 */
export function hasAuthoritativeGoogleEmail(profile: Profile): boolean {
  if (profile.email_verified !== true || typeof profile.email !== "string") return false
  const email = profile.email.trim().toLowerCase()
  return email.endsWith("@gmail.com") || (typeof profile.hd === "string" && profile.hd.trim().length > 0)
}

export async function handleGoogleAccountLinking({
  user,
  account,
  profile,
  getAuthenticatedUserId,
}: {
  user: User
  account: Account
  profile?: Profile
  getAuthenticatedUserId: () => Promise<string | null>
}): Promise<boolean | string> {
  // A previously linked Google subject is the identity. Email claims may
  // legitimately change, so they must not replace or relink that subject.
  const linkedAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
    select: { userId: true },
  })
  if (linkedAccount) return true

  if (!profile || profile.sub !== account.providerAccountId ||
      profile.email_verified !== true || typeof profile.email !== "string") return false

  const email = profile.email.trim().toLowerCase()
  if (!email || email !== user.email?.trim().toLowerCase()) return false

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  })
  if (!existingUser) return true // Auth.js handles new accounts and authenticated linking.

  const authenticatedUserId = await getAuthenticatedUserId()
  if (authenticatedUserId) {
    // Let Auth.js link only after the existing account has actually signed in.
    return authenticatedUserId === existingUser.id ? true : ACCOUNT_NOT_LINKED
  }

  // email_verified alone is insufficient for third-party mailboxes: Google may
  // have verified a previous owner. Gmail / Workspace are Google's authority.
  if (!hasAuthoritativeGoogleEmail(profile) || existingUser.accounts.some((a) => a.provider === "google")) {
    return ACCOUNT_NOT_LINKED
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.create({
      data: {
        userId: existingUser.id,
        type: account.type,
        provider: "google",
        providerAccountId: account.providerAccountId,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
      },
    })
    if (!existingUser.emailVerified || (!existingUser.image && user.image)) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          // A stranger may have registered this address before its real owner
          // arrived via Google. Never preserve that unverified password.
          ...(!existingUser.emailVerified ? { emailVerified: new Date(), password: null } : {}),
          ...(!existingUser.image && user.image ? { image: user.image } : {}),
        },
      })
    }
  })
  return true
}
