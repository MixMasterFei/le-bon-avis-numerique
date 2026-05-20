import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { uploadNewsImageWithDiagnostics } from "@/lib/supabase-storage"

export const maxDuration = 60

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function tagList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .flatMap((tag) => (typeof tag === "string" ? [tag.trim().toLowerCase()] : []))
        .filter(Boolean),
    ),
  )
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json()
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export async function GET(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  try {
    const rows = await prisma.officialPressAsset.findMany({
      orderBy: [{ active: "desc" }, { verifiedAt: "desc" }],
      take: 100,
    })
    return NextResponse.json({ ok: true, assets: rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 })
  }

  const body = await readBody(req)
  const brand = stringField(body.brand)
  const title = stringField(body.title)
  const sourceUrl = stringField(body.sourceUrl)
  const tags = tagList(body.tags)

  if (!brand || !title || !sourceUrl || tags.length === 0) {
    return NextResponse.json(
      { error: "brand, title, sourceUrl and tags are required" },
      { status: 400 },
    )
  }
  const credit = stringField(body.credit) ?? brand

  const shouldMirror = body.mirror !== false
  const mirrored = shouldMirror ? await uploadNewsImageWithDiagnostics(sourceUrl) : { url: null }

  try {
    const asset = await prisma.officialPressAsset.create({
      data: {
        brand,
        product: stringField(body.product),
        assetType: stringField(body.assetType) ?? "image",
        title,
        sourceUrl,
        storageUrl: mirrored.url,
        credit,
        licenseUrl: stringField(body.licenseUrl),
        termsUrl: stringField(body.termsUrl),
        termsSummary: stringField(body.termsSummary),
        tags,
        active: body.active !== false,
      },
    })
    return NextResponse.json({
      ok: true,
      asset,
      mirrored: Boolean(mirrored.url),
      mirrorReason: mirrored.reason ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
