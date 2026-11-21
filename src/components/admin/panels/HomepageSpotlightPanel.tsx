"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pin, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ageBadgeLabel } from "@/lib/age-label"
import { adminPalette } from "../shared/admin-ui"

/**
 * « À ne pas manquer cette semaine » — what the homepage band shows, the
 * pins behind it (homepage-watch cron or admin) with a « Retirer » button,
 * and an on-demand simulation of the watch (no import, no pin, no email,
 * no cron_logs row).
 */

interface PinRow {
  id: string
  source: string
  rank: number
  reason: string
  expiresAt: string
  media: { id: string; title: string; type: string; expertAgeRec: number | null; isEnriched: boolean }
}

interface BandRow {
  id: string
  title: string
  type: string
  expertAgeRec: number | null
  isProvisional: boolean
  origin: "admin" | "watch" | "fallback"
}

const TYPE_LABEL: Record<string, string> = { MOVIE: "Film", TV: "Série", GAME: "Jeu" }
const ORIGIN_LABEL: Record<BandRow["origin"], string> = {
  admin: "épingle admin",
  watch: "épingle de la veille",
  fallback: "sélection automatique",
}

function ageText(age: number | null, provisional = false): string {
  const label = ageBadgeLabel(age)
  if (!label) return "sans âge"
  return provisional ? `${label} (à confirmer)` : label
}

export function HomepageSpotlightPanel() {
  const p = adminPalette
  const [pins, setPins] = useState<PinRow[]>([])
  const [band, setBand] = useState<BandRow[]>([])
  const [tableReady, setTableReady] = useState(true)
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [report, setReport] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/homepage-spotlight")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Chargement impossible")
      setPins(data.pins ?? [])
      setBand(data.band ?? [])
      setTableReady(data.tableReady !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(pin: PinRow) {
    setRemovingId(pin.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/homepage-spotlight?id=${encodeURIComponent(pin.id)}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Suppression impossible")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible")
    } finally {
      setRemovingId(null)
    }
  }

  async function simulate() {
    setSimulating(true)
    setError(null)
    try {
      const res = await fetch("/api/cron/homepage-watch?dryRun=1")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Simulation impossible")
      setReport(typeof data.report === "string" ? data.report : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation impossible")
    } finally {
      setSimulating(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm" style={{ color: p.ink2 }}>
        Le bandeau de la page d&apos;accueil montre les titres dont on parle cette semaine, sans
        filtre d&apos;âge (chaque carte affiche son âge). La veille (tous les deux jours) y épingle
        les sorties de la semaine ; sans épingle, une sélection automatique prend le relais.
        Retirer une épingle met le bandeau à jour tout de suite — la prochaine veille peut la
        reposer si le titre est toujours dans l&apos;actualité.
      </p>

      {!tableReady && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: p.bg2, color: p.ink }}>
          La table des épingles n&apos;existe pas encore (migration 016 non appliquée) : le
          bandeau fonctionne sur la sélection automatique.
        </p>
      )}

      {error && (
        <p className="text-sm" style={{ color: "#B4483C" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: p.ink2 }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: p.ink }}>
              Ce que montre le bandeau ({band.length})
            </h3>
            {band.length === 0 ? (
              <p className="text-sm" style={{ color: p.ink2 }}>
                Rien pour l&apos;instant : le bandeau est masqué en dessous de quatre titres.
              </p>
            ) : (
              <ol className="space-y-1 text-sm" style={{ color: p.ink }}>
                {band.map((b, i) => (
                  <li key={b.id}>
                    {i + 1}. {b.title}{" "}
                    <span style={{ color: p.ink2 }}>
                      · {TYPE_LABEL[b.type] ?? b.type} · {ageText(b.expertAgeRec, b.isProvisional)} ·{" "}
                      {ORIGIN_LABEL[b.origin]}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: p.ink }}>
              Épingles actives ({pins.length})
            </h3>
            {pins.length === 0 ? (
              <p className="text-sm" style={{ color: p.ink2 }}>
                Aucune épingle active.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: p.line2 }}>
                {pins.map((pin) => (
                  <li key={pin.id} className="flex items-center gap-3 py-2.5">
                    <Pin className="h-4 w-4 shrink-0" style={{ color: p.ink2 }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" style={{ color: p.ink }}>
                        {pin.media.title}{" "}
                        <span style={{ color: p.ink2 }}>
                          · {TYPE_LABEL[pin.media.type] ?? pin.media.type} ·{" "}
                          {ageText(pin.media.expertAgeRec, !pin.media.isEnriched)}
                        </span>
                      </span>
                      <span className="block truncate text-xs" style={{ color: p.ink2 }}>
                        {pin.source === "admin" ? "Admin" : "Veille"} · {pin.reason} · expire le{" "}
                        {new Date(pin.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={removingId === pin.id}
                      onClick={() => void remove(pin)}
                      className="shrink-0"
                    >
                      {removingId === pin.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Retirer
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="space-y-2">
        <Button size="sm" variant="secondary" disabled={simulating} onClick={() => void simulate()}>
          {simulating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Simuler la veille maintenant
        </Button>
        <p className="text-xs" style={{ color: p.ink2 }}>
          Simulation : aucun import, aucune épingle, aucun e-mail, rien dans l&apos;historique des jobs.
        </p>
        {report && (
          <pre
            className="whitespace-pre-wrap text-xs rounded-lg p-3 max-h-[480px] overflow-auto"
            style={{ background: p.bg2, color: p.ink }}
          >
            {report}
          </pre>
        )}
      </div>
    </div>
  )
}
