import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"

// POST /api/admin/seed-admin
// Creates or updates the default admin account
// Requires ADMIN_SEED_SECRET environment variable for security
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret, email, password, name } = body

    // Security check - require secret to create admin
    const seedSecret = process.env.ADMIN_SEED_SECRET
    if (!seedSecret || secret !== seedSecret) {
      return NextResponse.json(
        { error: "Invalid secret. Set ADMIN_SEED_SECRET in your environment." },
        { status: 401 }
      )
    }

    // Validate inputs
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Hash the password
    const hashedPassword = await hash(password, 12)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // Update existing user to admin
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          role: "ADMIN",
          password: hashedPassword,
          name: name || existingUser.name,
        },
      })

      return NextResponse.json({
        success: true,
        message: "User updated to ADMIN",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
        },
      })
    }

    // Create new admin user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || "Admin",
        role: "ADMIN",
      },
    })

    return NextResponse.json({
      success: true,
      message: "Admin user created",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
    })
  } catch (error) {
    console.error("Seed admin error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed admin" },
      { status: 500 }
    )
  }
}

// GET - Check if admin exists
export async function GET() {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" },
  })

  const totalUsers = await prisma.user.count()

  return NextResponse.json({
    hasAdmin: adminCount > 0,
    adminCount,
    totalUsers,
  })
}
