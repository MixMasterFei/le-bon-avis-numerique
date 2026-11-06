"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, ExternalLink, Eye, Loader2, Undo2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminPalette, fmt } from "../shared/admin-ui"
import {
  AUTONOMY_DESCRIPTIONS,
  AUTONOMY_LABELS,
  AUTONOMY_LEVELS,
  type AutonomyLevel,
} from "@/lib/agent-ledger/policy"
import type { LedgerOverview } from "@/lib/agent-ledger/overview"

/**
 * Agent ledger — the one place a human steers the agents.
 *
 *  « À valider »  proposals that wait for a yes/no before touching the site
 *  « À relire »   what agents already wrote, with « Vu » or « Annuler »
 *  Autonomie      per action type, how much an agent may do on its own
 *  Coûts          30-day estimated LLM spend per agent
 *  Historique     everything else, newest first
 */

type ActionView = LedgerOverview["pending"][number]
type PolicyView = LedgerOverview["policies"][number]
type Decision = "approve" | "reject" | "acknowledge" | "revert"

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  applied: "Appliquée",
  rejected: "Refusée",
  reverted: "Annulée",
  failed: "Échec",
  expired: "Expirée",
  shadow: "Observation",
  approved: "Validée…",
  reverting: "Annulation…",
}

const DANGER = "#B4483C"

function usd(n: number | null): string {
  if (n == null) return "non mesurable"
  return n < 0.01 && n > 0 ? "< 0,01 $" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} $`
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

export function AgentLedgerPanel() {
  const p = adminPalette
  const [data, setData] = useState<LedgerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/admin/agents", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Chargement impossible")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(id: string, decision: Decision) {
    if (decision === "revert" && !window.confirm("Rétablir la valeur d'avant sur la fiche ?")) return
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/agents/actions/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Décision impossible")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Décision impossible")
    } finally {
      setBusyId(null)
      void load()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: p.ink2 }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    )
  }
  if (!data) {
    return <p className="text-sm" style={{ color: DANGER }}>{error ?? "Chargement impossible"}</p>
  }

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: p.ink2 }}>
        Les agents passent par ici avant ou après avoir écrit sur le site. Vous ne déclenchez plus
        les tâches : vous réglez <strong>ce que chaque agent a le droit de faire seul</strong>, et
        vous tranchez le reste.
      </p>

      {!data.available && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}>
          Registre indisponible : la migration <code className="text-xs">015_agent_ledger.sql</code>{" "}
          n&apos;est pas encore appliquée. Les agents en « Agir et signaler » continuent d&apos;écrire
          comme avant ; les propositions en « Proposer » ne sont pas appliquées.
        </div>
      )}

      {error && <p className="text-sm" style={{ color: DANGER }}>{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Tile label="À valider" value={fmt(data.pending.length)} />
        <Tile label="À relire" value={fmt(data.toReview.length)} />
        <Tile label="Coût IA estimé (30 j)" value={usd(data.totalCostUsd)} />
      </div>

      <Section title="À valider" empty="Aucune proposition en attente.">
        {data.pending.map((a) => (
          <ActionCard key={a.id} a={a} afterLabel="Proposé">
            <Button size="sm" disabled={busyId === a.id} onClick={() => void decide(a.id, "approve")}>
              {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Appliquer
            </Button>
            <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => void decide(a.id, "reject")}>
              <X className="h-3.5 w-3.5" /> Refuser
            </Button>
          </ActionCard>
        ))}
      </Section>

      <Section title="À relire" empty="Rien à relire : tout ce que les agents ont écrit a été vu.">
        {data.toReview.map((a) => (
          <ActionCard key={a.id} a={a} afterLabel="Écrit">
            <Button size="sm" variant="secondary" disabled={busyId === a.id} onClick={() => void decide(a.id, "acknowledge")}>
              {busyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Vu
            </Button>
            <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => void decide(a.id, "revert")}>
              <Undo2 className="h-3.5 w-3.5" /> Annuler
            </Button>
          </ActionCard>
        ))}
      </Section>

      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: p.ink }}>Autonomie par type d&apos;action</h3>
        <p className="text-xs mb-3" style={{ color: p.ink2 }}>
          Montez d&apos;un cran quand l&apos;historique le justifie. Un seuil de confiance renvoie en
          validation toute action moins sûre (ou sans score), même en mode autonome.
        </p>
        <ul className="space-y-3">
          {data.policies.map((pol) => (
            <PolicyRow key={pol.actionType} pol={pol} disabled={!data.available} onSaved={load} />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2" style={{ color: p.ink }}>Coûts par agent (30 jours, estimation)</h3>
        {data.costs.length === 0 ? (
          <p className="text-sm" style={{ color: p.ink2 }}>Aucun passage d&apos;agent enregistré sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs" style={{ color: p.ink2 }}>
                  <th className="py-1 pr-3 font-medium">Agent</th>
                  <th className="py-1 pr-3 font-medium">Passages</th>
                  <th className="py-1 pr-3 font-medium">Appels IA</th>
                  <th className="py-1 pr-3 font-medium">Coût</th>
                  <th className="py-1 pr-3 font-medium">Actions (appliquées / proposées)</th>
                  <th className="py-1 font-medium">Dernier passage</th>
                </tr>
              </thead>
              <tbody>
                {data.costs.map((c) => (
                  <tr key={c.agent} className="border-t" style={{ borderColor: p.line2, color: p.ink }}>
                    <td className="py-1.5 pr-3">{c.agentLabel}</td>
                    <td className="py-1.5 pr-3">{fmt(c.runs)}</td>
                    <td className="py-1.5 pr-3">{fmt(c.llmCalls)}</td>
                    <td className="py-1.5 pr-3">
                      {usd(c.costUsd)}
                      {c.unpricedRuns > 0 && <span className="text-xs" style={{ color: p.ink2 }}> (+{c.unpricedRuns} non chiffré)</span>}
                    </td>
                    <td className="py-1.5 pr-3">{fmt(c.actionsApplied)} / {fmt(c.actionsProposed)}</td>
                    <td className="py-1.5">{c.lastRunAt ? when(c.lastRunAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: p.ink }}>
          Historique ({data.history.length})
        </summary>
        <ul className="mt-3 divide-y" style={{ borderColor: p.line2 }}>
          {data.history.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm" style={{ color: p.ink }}>
              <span className="text-xs w-24 shrink-0" style={{ color: p.ink2 }}>{when(a.createdAt)}</span>
              <StatusPill status={a.status} />
              <span className="min-w-0 flex-1 truncate">
                {a.actionLabel} — <TargetLink a={a} />
                {a.error && <span className="text-xs" style={{ color: DANGER }}> · {a.error}</span>}
              </span>
              {a.status === "applied" && (
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => void decide(a.id, "revert")}>
                  <Undo2 className="h-3.5 w-3.5" /> Annuler
                </Button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  const p = adminPalette
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: p.bg2, border: `1px solid ${p.line2}` }}>
      <div className="text-xs" style={{ color: p.ink2 }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: p.ink }}>{value}</div>
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  const p = adminPalette
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: p.ink }}>
        {title} {children.length > 0 && <span style={{ color: p.accent }}>· {children.length}</span>}
      </h3>
      {children.length === 0 ? (
        <p className="text-sm" style={{ color: p.ink2 }}>{empty}</p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const p = adminPalette
  const bad = status === "failed" || status === "rejected" || status === "reverted"
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-xs"
      style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: bad ? DANGER : p.ink2 }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function TargetLink({ a }: { a: ActionView }) {
  const p = adminPalette
  const label = a.targetLabel ?? a.targetId ?? "?"
  if (!a.targetHref) return <span>{label}</span>
  return (
    <Link href={a.targetHref} target="_blank" className="inline-flex items-center gap-1 underline-offset-2 hover:underline" style={{ color: p.ink }}>
      {label} <ExternalLink className="h-3 w-3" />
    </Link>
  )
}

function ActionCard({ a, afterLabel, children }: { a: ActionView; afterLabel: string; children: React.ReactNode }) {
  const p = adminPalette
  return (
    <li className="rounded-xl p-3 space-y-2" style={{ background: p.card, border: `1px solid ${p.line2}` }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm" style={{ color: p.ink }}>
        <span className="font-semibold"><TargetLink a={a} /></span>
        <span className="text-xs" style={{ color: p.ink2 }}>
          {a.agentLabel} · {a.actionLabel} · {when(a.createdAt)}
          {a.confidence != null && ` · confiance ${Math.round(a.confidence * 100)} %`}
        </span>
      </div>
      {a.rationale && <p className="text-xs" style={{ color: p.ink2 }}>{a.rationale}</p>}
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <Diff label={`${a.fieldLabel} — avant`} text={a.before} muted />
        <Diff label={`${a.fieldLabel} — ${afterLabel.toLowerCase()}`} text={a.after} />
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  )
}

function Diff({ label, text, muted }: { label: string; text: string | null; muted?: boolean }) {
  const p = adminPalette
  return (
    <div className="rounded-lg px-2.5 py-2" style={{ background: p.bg2 }}>
      <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: p.ink2 }}>{label}</div>
      <div style={{ color: muted ? p.ink2 : p.ink }}>{text || <em>(vide)</em>}</div>
    </div>
  )
}

function PolicyRow({ pol, disabled, onSaved }: { pol: PolicyView; disabled: boolean; onSaved: () => void }) {
  const p = adminPalette
  const [level, setLevel] = useState<AutonomyLevel>(pol.level)
  const [floor, setFloor] = useState(pol.minConfidence == null ? "" : String(Math.round(pol.minConfidence * 100)))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const dirty =
    level !== pol.level ||
    floor !== (pol.minConfidence == null ? "" : String(Math.round(pol.minConfidence * 100)))
  const r = pol.trackRecord

  async function save() {
    setSaving(true)
    setMsg(null)
    const pct = floor.trim() === "" ? null : Number(floor)
    if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
      setMsg("Seuil entre 0 et 100 %")
      setSaving(false)
      return
    }
    try {
      const res = await fetch("/api/admin/agents/autonomy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: pol.actionType, level, minConfidence: pct == null ? null : pct / 100 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Enregistrement impossible")
      onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Enregistrement impossible")
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-xl p-3 space-y-2" style={{ background: p.card, border: `1px solid ${p.line2}` }}>
      <div className="text-sm" style={{ color: p.ink }}>
        <span className="font-semibold">{pol.actionLabel}</span>{" "}
        <span className="text-xs" style={{ color: p.ink2 }}>· {pol.agentLabel}{pol.isDefault && " · réglage par défaut"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={level}
          disabled={disabled || saving}
          onChange={(e) => setLevel(e.target.value as AutonomyLevel)}
          className="rounded-lg px-2 py-1.5 text-sm"
          style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
          aria-label={`Niveau d'autonomie — ${pol.actionLabel}`}
        >
          {AUTONOMY_LEVELS.map((l) => (
            <option key={l} value={l}>{AUTONOMY_LABELS[l]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs" style={{ color: p.ink2 }}>
          Seuil
          <input
            value={floor}
            disabled={disabled || saving}
            onChange={(e) => setFloor(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="aucun"
            inputMode="numeric"
            className="w-16 rounded-lg px-2 py-1.5 text-sm"
            style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
          />
          %
        </label>
        {dirty && (
          <Button size="sm" disabled={disabled || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
          </Button>
        )}
      </div>
      <p className="text-xs" style={{ color: p.ink2 }}>{AUTONOMY_DESCRIPTIONS[level]}</p>
      <p className="text-xs" style={{ color: p.ink2 }}>
        90 derniers jours : {r.approved} validée(s) · {r.acknowledged} relue(s) · {r.rejected} refusée(s) · {r.reverted} annulée(s)
      </p>
      {pol.hint && <p className="text-xs font-medium" style={{ color: p.accent }}>{pol.hint}</p>}
      {msg && <p className="text-xs" style={{ color: DANGER }}>{msg}</p>}
    </li>
  )
}
