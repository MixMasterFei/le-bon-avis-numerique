import { prisma } from "./db"
import { randomBytes } from "crypto"

// Generate a secure random token
export function generateToken(): string {
  return randomBytes(32).toString("hex")
}

// Create a verification token for email verification
export async function createVerificationToken(email: string): Promise<string> {
  const token = generateToken()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  // Delete any existing tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  })

  // Create new token
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  return token
}

// Verify and consume a verification token
export async function verifyToken(
  token: string
): Promise<{ email: string } | null> {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!verificationToken) {
    return null
  }

  // Check if expired
  if (verificationToken.expires < new Date()) {
    // Delete expired token
    await prisma.verificationToken.delete({
      where: { token },
    })
    return null
  }

  // Delete the token (one-time use)
  await prisma.verificationToken.delete({
    where: { token },
  })

  return { email: verificationToken.identifier }
}

// Create a password reset token
export async function createPasswordResetToken(
  email: string
): Promise<string> {
  const token = generateToken()
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Delete any existing tokens for this email (using a specific identifier pattern)
  await prisma.verificationToken.deleteMany({
    where: { identifier: `reset:${email}` },
  })

  // Create new token
  await prisma.verificationToken.create({
    data: {
      identifier: `reset:${email}`,
      token,
      expires,
    },
  })

  return token
}

// Verify and consume a password reset token
export async function verifyPasswordResetToken(
  token: string
): Promise<{ email: string } | null> {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!verificationToken) {
    return null
  }

  // Check if it's a reset token
  if (!verificationToken.identifier.startsWith("reset:")) {
    return null
  }

  // Check if expired
  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { token },
    })
    return null
  }

  // Delete the token (one-time use)
  await prisma.verificationToken.delete({
    where: { token },
  })

  // Extract email from identifier
  const email = verificationToken.identifier.replace("reset:", "")

  return { email }
}
