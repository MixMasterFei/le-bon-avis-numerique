import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { fraunces } from "@/components/home-v2/apercuFont"
import { formatRelativeTimeFr } from "@/lib/utils"
import { NewsReportActions } from "./NewsReportActions"

export const dynamic = "force-dynamic"

const REASON_LABEL: Record<string, string> = {
  INAPPROPRIATE: "Contenu inapproprié",
  SPAM: "Spam",
  HARASSMENT: "Harcèlement",
  MISINFORMATION: "Désinformation",
  OTHER: "Autre",
}

export default async function AdminNewsReportsPage() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== "ADMIN" && role !== "MODERATOR") {
    redirect("/")
  }

  const reports = await prisma.newsCommentReport.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      comment: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          newsStory: { select: { slug: true, title: true } },
        },
      },
    },
  })

  const p = APERCU_PALETTE

  return (
    <div className="min-h-screen" style={{ background: p.bg, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm mb-4 hover:opacity-70"
            style={{ color: p.ink2 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Tableau de bord
          </Link>
          <div
            className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
            style={{ color: p.accent }}
          >
            Modération
          </div>
          <h1
            className={`${fraunces.className} text-3xl md:text-4xl font-medium leading-tight`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Signalements de commentaires
          </h1>
          <p className="text-sm mt-2" style={{ color: p.ink2 }}>
            {reports.length === 0
              ? "Rien à modérer pour le moment."
              : `${reports.length} signalement${reports.length > 1 ? "s" : ""} en attente.`}
          </p>
        </div>

        {reports.length > 0 && (
          <ul className="flex flex-col gap-4">
            {reports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl p-5"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div>
                    <div className="text-xs mb-1" style={{ color: p.ink2 }}>
                      Histoire{" "}
                      <Link
                        href={`/apercudecouverte/${r.comment.newsStory.slug}`}
                        className="underline"
                        style={{ color: p.ink }}
                      >
                        {r.comment.newsStory.title}
                      </Link>
                    </div>
                    <div className="text-xs" style={{ color: p.ink2 }}>
                      Signalé par{" "}
                      <span style={{ color: p.ink, fontWeight: 600 }}>
                        {r.user.name || r.user.email}
                      </span>
                      {" · "}
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full"
                        style={{ background: p.bg2, color: p.ink }}
                      >
                        {REASON_LABEL[r.reason] ?? r.reason}
                      </span>
                      {" · "}
                      {formatRelativeTimeFr(r.createdAt)}
                    </div>
                  </div>
                </div>

                {r.details && (
                  <p
                    className="text-sm italic mb-3 px-3 py-2 rounded-lg"
                    style={{ background: p.bg2, color: p.ink2 }}
                  >
                    « {r.details} »
                  </p>
                )}

                <div
                  className="rounded-xl p-3 mb-3"
                  style={{ background: p.bg2, border: `1px solid ${p.line}` }}
                >
                  <div className="text-xs mb-1" style={{ color: p.ink2 }}>
                    Commentaire de{" "}
                    <span style={{ color: p.ink, fontWeight: 600 }}>
                      {r.comment.user.name || r.comment.user.email}
                    </span>
                    {" · "}
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        background: r.comment.status === "HIDDEN" ? p.accent : p.bg,
                        color: r.comment.status === "HIDDEN" ? "#fff" : p.ink,
                        border: `1px solid ${p.line}`,
                      }}
                    >
                      {r.comment.status}
                    </span>
                  </div>
                  <p
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: p.ink }}
                  >
                    {r.comment.body}
                  </p>
                </div>

                <NewsReportActions
                  reportId={r.id}
                  commentStatus={r.comment.status}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
