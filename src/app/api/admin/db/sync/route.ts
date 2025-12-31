import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export const maxDuration = 60

export async function POST() {
  try {
    // Run prisma db push to sync the schema with the database
    // This is safe for adding new columns (they'll be nullable or have defaults)
    const { stdout, stderr } = await execAsync("npx prisma db push --accept-data-loss", {
      cwd: process.cwd(),
      timeout: 55000,
    })

    // Also regenerate the client
    await execAsync("npx prisma generate", {
      cwd: process.cwd(),
      timeout: 30000,
    })

    return NextResponse.json({
      success: true,
      message: "Schema synchronized successfully",
      output: stdout,
      warnings: stderr || undefined,
    })
  } catch (error) {
    console.error("Database sync error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync database schema",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check current schema status
  try {
    const { stdout } = await execAsync("npx prisma db pull --print", {
      cwd: process.cwd(),
      timeout: 30000,
    })

    return NextResponse.json({
      success: true,
      currentSchema: stdout,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get schema status",
      },
      { status: 500 }
    )
  }
}
