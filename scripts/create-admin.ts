/**
 * Script to create an admin user
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts
 *
 * Or set environment variables:
 *   ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword npx tsx scripts/create-admin.ts
 */

// Load .env file
import { config } from "dotenv"
config()

import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"
import * as readline from "readline"

const prisma = new PrismaClient()

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  console.log("\n🔐 Le Bon Sens Numérique - Admin Creation\n")

  // Check for existing admins
  const existingAdmins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true, name: true },
  })

  if (existingAdmins.length > 0) {
    console.log("Existing admin accounts:")
    existingAdmins.forEach((admin) => {
      console.log(`  - ${admin.email} (${admin.name})`)
    })
    console.log("")
  }

  // Get credentials from environment or prompt
  let email = process.env.ADMIN_EMAIL
  let password = process.env.ADMIN_PASSWORD
  let name = process.env.ADMIN_NAME

  if (!email) {
    email = await prompt("Admin email: ")
  }

  if (!password) {
    password = await prompt("Admin password (min 8 chars): ")
  }

  if (!name) {
    name = await prompt("Admin name (optional, press Enter to skip): ")
  }

  // Validate
  if (!email || !email.includes("@")) {
    console.error("❌ Invalid email address")
    process.exit(1)
  }

  if (!password || password.length < 8) {
    console.error("❌ Password must be at least 8 characters")
    process.exit(1)
  }

  // Hash password
  const hashedPassword = await hash(password, 12)

  // Create or update user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      name: name || undefined,
    },
    create: {
      email,
      password: hashedPassword,
      role: "ADMIN",
      name: name || "Admin",
    },
  })

  console.log("\n✅ Admin account ready!")
  console.log(`   Email: ${user.email}`)
  console.log(`   Name: ${user.name}`)
  console.log(`   Role: ${user.role}`)
  console.log("\n📝 You can now log in at /connexion")
}

main()
  .catch((e) => {
    console.error("Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
