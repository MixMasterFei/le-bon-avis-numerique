"use client"

import { useState } from "react"
import {
  BookOpenCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminPalette } from "../shared/admin-ui"

/**
 * On-demand run of the monthly Parents' Guide review check.
 *
 * Calls the SAME endpoint the 1st-of-month cron calls, with `dryRun=1`:
 * - same implementation, so this panel can never drift from what actually
 *   runs on schedule;
 * - dry, so pressing it sends no email AND writes no cron_logs row — an
 *   admin spot-check must not refresh "last run" and hide a skipped month.
 *
 * What it reports is how old each human verification is and whether the
 * publishers' links still resolve. It does NOT re-verify the facts — only a
 * human read-through can do that, which is exactly what the button is for.
 */

type GuideState = "fresh" | "due" | "stale" | "invalid"

interface GuideRow {
  key: string
  name: string
  verifiedOn: string
  ageDays: number | null
  state: GuideState
  problem?: string
}

interface BrokenLink {
  guide: string
  label: string
  url: string
  status: number | null
  error?: string
}

interface CheckResponse {
  success: boolean
  duration: string
  stats: { guides: number; linksChecked: number; linksBroken: number }
  guides: GuideRow[]
  broken: BrokenLink[]
}

const STATE_UI: Record<GuideState, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  fresh: { label: "À jour", color: "#5C8A5C", Icon: CheckCircle2 },
  due: { label: "À relire", color: "#D4A574", Icon: AlertTriangle },
  stale: { label: "En retard", color: "#C4785A", Icon: AlertTriangle },
  invalid: { label: "Date invalide", color: "#C4785A", Icon: XCircle },
}

export function GameGuidesPanel() {
  const p = adminPalette
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/cron/game-guides-check?dryRun=1", {
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      setData((await res.json()) as CheckResponse)
    } catch (e) {
      // Surfaced, never swallowed into an empty-but-green panel.
      setError(e instanceof Error ? e.message : "échec inconnu")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm max-w-xl" style={{ color: p.ink2 }}>
          Vérifie l&apos;ancienneté de chaque bloc «&nbsp;L&apos;état du jeu&nbsp;» et si les
          liens officiels des éditeurs répondent encore. Ne revérifie pas les faits —
          seule une relecture le peut. N&apos;envoie pas d&apos;e-mail et n&apos;écrit
          rien dans l&apos;historique des jobs.
        </p>
        <Button onClick={run} disabled={loading} className="shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <BookOpenCheck className="h-4 w-4 mr-2" />
          )}
          Vérifier les guides
        </Button>
      </div>

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: "#C4785A18", color: p.ink }}
        >
          Échec de la vérification : {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="text-xs" style={{ color: p.ink2 }}>
            {data.stats.guides} guides · {data.stats.linksChecked} liens vérifiés ·{" "}
            {data.stats.linksBroken} cassé{data.stats.linksBroken > 1 ? "s" : ""} · {data.duration}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {data.guides.map((g) => {
              const ui = STATE_UI[g.state]
              return (
                <div
                  key={g.key}
                  className="rounded-lg border p-3 flex items-start gap-3"
                  style={{ background: p.card, borderColor: p.line }}
                >
                  <ui.Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: ui.color }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: p.ink }}>
                        {g.name}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: ui.color }}>
                        {ui.label}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: p.ink2 }}>
                      {g.problem
                        ? `${g.verifiedOn} — ${g.problem}`
                        : `Vérifié le ${g.verifiedOn}${
                            g.ageDays !== null ? ` · il y a ${g.ageDays} j` : ""
                          }`}
                    </div>
                    <a
                      href={`/jeux/guide/${g.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-1.5 hover:opacity-70"
                      style={{ color: p.accent }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ouvrir le guide
                    </a>
                  </div>
                </div>
              )
            })}
          </div>

          {data.broken.length > 0 && (
            <div
              className="rounded-lg border p-3"
              style={{ background: p.card, borderColor: "#C4785A55" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: p.ink }}>
                Liens officiels cassés
              </p>
              <p className="text-xs mb-2" style={{ color: p.ink2 }}>
                Un lien mort signale souvent que l&apos;éditeur a réorganisé sa documentation —
                donc que les faits du bloc ont pu bouger.
              </p>
              <ul className="space-y-1.5">
                {data.broken.map((l) => (
                  <li key={l.url} className="text-xs" style={{ color: p.ink2 }}>
                    <span className="font-semibold" style={{ color: p.ink }}>
                      [{l.guide}]
                    </span>{" "}
                    {l.label} — {l.error ? l.error : `HTTP ${l.status}`}
                    <br />
                    <span className="break-all opacity-70">{l.url}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
