import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET: Get aggregated community metrics for a media item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get all user metrics for this media
    const userMetrics = await prisma.userContentMetrics.findMany({
      where: { mediaId: id },
    })

    if (userMetrics.length === 0) {
      return NextResponse.json({
        success: true,
        hasData: false,
        count: 0,
        averages: null,
      })
    }

    // Calculate averages
    const count = userMetrics.length
    const sum = userMetrics.reduce(
      (acc, m) => ({
        violence: acc.violence + m.violence,
        sexNudity: acc.sexNudity + m.sexNudity,
        language: acc.language + m.language,
        consumerism: acc.consumerism + m.consumerism,
        substanceUse: acc.substanceUse + m.substanceUse,
        positiveMessages: acc.positiveMessages + m.positiveMessages,
        roleModels: acc.roleModels + m.roleModels,
      }),
      {
        violence: 0,
        sexNudity: 0,
        language: 0,
        consumerism: 0,
        substanceUse: 0,
        positiveMessages: 0,
        roleModels: 0,
      }
    )

    const averages = {
      violence: Math.round((sum.violence / count) * 10) / 10,
      sexNudity: Math.round((sum.sexNudity / count) * 10) / 10,
      language: Math.round((sum.language / count) * 10) / 10,
      consumerism: Math.round((sum.consumerism / count) * 10) / 10,
      substanceUse: Math.round((sum.substanceUse / count) * 10) / 10,
      positiveMessages: Math.round((sum.positiveMessages / count) * 10) / 10,
      roleModels: Math.round((sum.roleModels / count) * 10) / 10,
    }

    return NextResponse.json({
      success: true,
      hasData: true,
      count,
      averages,
    })
  } catch (error) {
    console.error("Community metrics error:", error)
    return NextResponse.json(
      { error: "Failed to get community metrics" },
      { status: 500 }
    )
  }
}
