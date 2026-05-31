import { redirect } from "next/navigation"
import Link from "next/link"
import { Bot, Settings } from "lucide-react"
import { auth } from "@/lib/auth"
import { fetchAdminKpis } from "@/lib/admin-kpis"
import { fraunces } from "@/components/home-v2/apercuFont"
import { APERCU_PALETTE, isFraunces } from "@/components/home-v2/apercuTheme"
import {
  AdminHealthBand,
  AdminGrowthSection,
  AdminEngagementKpis,
  AdminActionQueue,
  AdminCronStrip,
} from "@/components/admin"

export const dynamic = "force-dynamic"
export const revalidate = 60

interface SearchParams {
  font?: string
}

export default async function AdminDashboardPage(props: {
  searchParams?: Promise<SearchParams>
}) {
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

  const kpis = await fetchAdminKpis()
  const now = kpis.generatedAt.getTime()
  const p = APERCU_PALETTE

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  const newsTask = kpis.cronTasks.find((t) => t.task === "news-discover")

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <div
        className="min-h-screen"
        style={{ background: p.bg, color: p.ink }}
      >
        <div className="container mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-8">
          <header>
            <div
              className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: p.accent }}
            >
              Tableau de bord
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05]`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Totem Avisé · <em className="italic" style={{ color: p.accent }}>Admin</em>
            </h1>
          </header>

          <AdminHealthBand
            catalogTotal={kpis.catalogTotal}
            catalogUnenriched={kpis.catalogUnenriched}
            cronErrors7d={kpis.cronErrors7d}
            lastNewsRun={newsTask?.lastRun ?? null}
            generatedAt={kpis.generatedAt}
            now={now}
          />

          <AdminGrowthSection
            serifClass={serifClass}
            usersWeek={kpis.usersWeek}
            usersPrevWeek={kpis.usersPrevWeek}
            usersMonth={kpis.usersMonth}
            familiesTotal={kpis.familiesTotal}
            familiesCompleteThree={kpis.familiesCompleteThree}
            dailyGrowth={kpis.dailyGrowth}
          />

          <AdminEngagementKpis
            serifClass={serifClass}
            reactionsWeek={kpis.reactionsWeek}
            reactionsPrevWeek={kpis.reactionsPrevWeek}
            reviewsWeek={kpis.reviewsWeek}
            reviewsPrevWeek={kpis.reviewsPrevWeek}
            ageVotesWeek={kpis.ageVotesWeek}
            ageVotesPrevWeek={kpis.ageVotesPrevWeek}
            recoClicksWeek={kpis.recoClicksWeek}
            recoClicksPrevWeek={kpis.recoClicksPrevWeek}
          />

          <AdminActionQueue
            serifClass={serifClass}
            correctionsPending={kpis.correctionsPending}
            requestsPending={kpis.requestsPending}
            catalogUnenriched={kpis.catalogUnenriched}
            catalogUnenrichedByType={kpis.catalogUnenrichedByType}
            newsReportsPending={kpis.newsReportsPending}
            disagreedAgeItems={kpis.disagreedAgeItems}
          />

          <AdminCronStrip serifClass={serifClass} tasks={kpis.cronTasks} now={now} />

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Link
              href="/admin/totem"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: p.card, color: p.ink, border: `1px solid ${p.line}` }}
            >
              <Bot className="w-4 h-4" />
              Tour de contrôle Totem
            </Link>
            <Link
              href="/admin/operations"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: p.ink, color: p.bg }}
            >
              <Settings className="w-4 h-4" />
              Opérations & maintenance
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
