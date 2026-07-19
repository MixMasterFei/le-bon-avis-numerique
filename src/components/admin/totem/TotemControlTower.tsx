"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  Download,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { fraunces } from "@/components/home-v2/apercuFont"
import { AdminNavPills } from "@/components/admin/shared/AdminShell"
import type {
  TotemAdminOverview,
  TotemConversationDetail,
  TotemConversationListItem,
} from "@/lib/totem-admin-kpis"

const p = APERCU_PALETTE
const serifClass = fraunces.className

const MODEL_COLORS = ["#C4785A", "#5C8A5C", "#6B7FA8", "#9B8AA5", "#D4A574"]

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function wowLabel(current: number, prev: number): { text: string; tone: "up" | "down" | "neutral" } {
  if (prev === 0 && current === 0) return { text: "—", tone: "neutral" }
  if (prev === 0) return { text: `+${current}`, tone: "up" }
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return { text: "stable", tone: "neutral" }
  return { text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`, tone: pct > 0 ? "up" : "down" }
}

function shortModel(model: string): string {
  if (model.includes("haiku")) return "Haiku"
  if (model.includes("sonnet")) return "Sonnet"
  return model.slice(0, 12)
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      {children}
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  wow,
}: {
  label: string
  value: string
  sub?: string
  wow?: { text: string; tone: "up" | "down" | "neutral" }
}) {
  const wowStyle =
    wow?.tone === "up"
      ? { color: "#3E6640", background: "rgba(92,138,92,0.12)" }
      : wow?.tone === "down"
        ? { color: p.accent, background: "rgba(209,106,74,0.12)" }
        : { color: p.ink2, background: "rgba(30,26,21,0.06)" }
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: p.ink2 }}>
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`${serifClass} text-2xl md:text-3xl font-medium`} style={{ color: p.ink }}>
          {value}
        </span>
        {wow && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={wowStyle}>
            {wow.text}
          </span>
        )}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: p.ink2 }}>
          {sub}
        </div>
      )}
    </Card>
  )
}

function ConversationReplay({
  detail,
  onClose,
}: {
  detail: TotemConversationDetail
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col shadow-2xl"
      style={{ background: p.bg, borderLeft: `1px solid ${p.line}` }}
    >
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${p.line}`, background: p.card }}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.accent }}>
            Replay conversation
          </div>
          <div className="text-xs mt-1 truncate" style={{ color: p.ink2 }}>
            {detail.user?.email ?? `Session ${detail.sessionId.slice(0, 12)}…`}
          </div>
          <div className="text-xs mt-0.5" style={{ color: p.ink2 }}>
            {fmtDateTime(detail.startedAt)} → {fmtDateTime(detail.lastMessageAt)}
          </div>
          {detail.sourcePage && (
            <div className="text-xs mt-1 font-mono truncate" style={{ color: p.ink2 }}>
              {detail.sourcePage}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:opacity-70"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" style={{ color: p.ink2 }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {detail.messages.map((m) => {
          const isUser = m.role === "user"
          const hasTools =
            m.toolCalls != null &&
            (Array.isArray(m.toolCalls) ? m.toolCalls.length > 0 : true)
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed space-y-2"
                style={{
                  background: isUser ? p.accent : p.card,
                  color: isUser ? "#fff" : p.ink,
                  border: isUser ? "none" : `1px solid ${p.line}`,
                }}
              >
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-80">
                  <span>{isUser ? "Utilisateur" : "Totem"}</span>
                  <span>·</span>
                  <span>{fmtDateTime(m.createdAt)}</span>
                  {m.modelUsed && !isUser && (
                    <>
                      <span>·</span>
                      <span>{shortModel(m.modelUsed)}</span>
                      {m.latencyMs != null && <span>({m.latencyMs} ms)</span>}
                    </>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{m.content || "—"}</div>
                {m.feedback.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.feedback.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: f.rating === "UP" ? "rgba(92,138,92,0.2)" : "rgba(209,106,74,0.2)",
                          color: f.rating === "UP" ? "#3E6640" : p.accent,
                        }}
                      >
                        {f.rating === "UP" ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        {f.reason ? f.reason : f.rating}
                      </span>
                    ))}
                  </div>
                )}
                {hasTools && (
                  <details className="text-[11px]">
                    <summary className="cursor-pointer font-semibold" style={{ color: p.ink2 }}>
                      Outils ({Array.isArray(m.toolCalls) ? m.toolCalls.length : 1})
                    </summary>
                    <pre
                      className="mt-2 p-2 rounded-lg overflow-x-auto text-[10px] max-h-48"
                      style={{ background: "rgba(30,26,21,0.04)", color: p.ink2 }}
                    >
                      {JSON.stringify({ calls: m.toolCalls, results: m.toolResults }, null, 2)}
                    </pre>
                  </details>
                )}
                {m.citedMediaIds.length > 0 && (
                  <div className="text-[10px]" style={{ color: p.ink2 }}>
                    Médias cités : {m.citedMediaIds.slice(0, 5).join(", ")}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TotemControlTower() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<TotemAdminOverview | null>(null)
  const [recentConversations, setRecentConversations] = useState<TotemConversationListItem[]>([])

  const [searchQ, setSearchQ] = useState("")
  const [onlyDown, setOnlyDown] = useState(false)
  const [listPage, setListPage] = useState(1)
  const [listTotal, setListTotal] = useState(0)
  const [listRows, setListRows] = useState<TotemConversationListItem[]>([])
  const [listLoading, setListLoading] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TotemConversationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/totem?days=${days}`, { cache: "no-store" })
      if (!res.ok) throw new Error("fetch failed")
      const data = (await res.json()) as {
        overview: TotemAdminOverview
        recentConversations: TotemConversationListItem[]
      }
      setOverview(data.overview)
      setRecentConversations(data.recentConversations)
    } catch (err) {
      console.error("[TotemControlTower] overview", err)
    } finally {
      setLoading(false)
    }
  }, [days])

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(listPage),
        pageSize: "20",
        days: String(days),
      })
      if (searchQ.trim()) params.set("q", searchQ.trim())
      if (onlyDown) params.set("onlyDown", "1")
      const res = await fetch(`/api/admin/totem/conversations?${params}`, { cache: "no-store" })
      if (!res.ok) throw new Error("list failed")
      const data = (await res.json()) as {
        conversations: TotemConversationListItem[]
        total: number
      }
      setListRows(data.conversations)
      setListTotal(data.total)
    } catch (err) {
      console.error("[TotemControlTower] list", err)
    } finally {
      setListLoading(false)
    }
  }, [days, listPage, searchQ, onlyDown])

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    fetch(`/api/admin/totem/conversations/${encodeURIComponent(selectedId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TotemConversationDetail | null) => setDetail(d))
      .catch(console.error)
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  const modelPie = useMemo(() => {
    if (!overview) return []
    return overview.modelUsage.map((m) => ({
      name: shortModel(m.model),
      value: m.count,
    }))
  }, [overview])

  const convWow = overview
    ? wowLabel(overview.wow.conversations, overview.wow.prevConversations)
    : null
  const msgWow = overview
    ? wowLabel(overview.wow.userMessages, overview.wow.prevUserMessages)
    : null

  const totalPages = Math.max(1, Math.ceil(listTotal / 20))

  if (loading && !overview) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: p.bg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
      </div>
    )
  }

  const t = overview?.totals

  return (
    <div className="min-h-screen" style={{ background: p.bg, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Bot className="h-5 w-5" style={{ color: p.accent }} />
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.accent }}>
                Tour de contrôle
              </span>
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-4xl font-medium leading-[1.05]`}
              style={{ letterSpacing: "-0.02em" }}
            >
              Assistant <em className="italic" style={{ color: p.accent }}>Totem</em>
            </h1>
            <p className="text-sm mt-2 max-w-xl" style={{ color: p.ink2 }}>
              Conversations, qualité perçue, outils appelés et replay complet — votre base red team.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDays(d)
                  setListPage(1)
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity"
                style={{
                  background: days === d ? p.ink : p.card,
                  color: days === d ? p.bg : p.ink,
                  border: `1px solid ${p.line}`,
                }}
              >
                {d} j
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </button>
            <a
              href={`/api/admin/totem?export=conversations&days=${days}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: p.ink, color: p.bg }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </div>
        </header>

        <AdminNavPills active="totem" />

        {/* KPI band */}
        {t && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiTile
              label="Conversations"
              value={fmt(t.conversations)}
              sub={`${fmt(t.authenticatedUsers)} comptes · ${fmt(t.anonymousSessions)} anon`}
              wow={convWow ?? undefined}
            />
            <KpiTile
              label="Messages user"
              value={fmt(t.userMessages)}
              sub={`${fmt(t.assistantMessages)} réponses`}
              wow={msgWow ?? undefined}
            />
            <KpiTile
              label="Satisfaction"
              value={t.satisfactionPct != null ? `${t.satisfactionPct}%` : "—"}
              sub={`${fmt(t.feedbackUp)} 👍 · ${fmt(t.feedbackDown)} 👎`}
            />
            <KpiTile
              label="Latence moy."
              value={t.avgLatencyMs != null ? `${t.avgLatencyMs} ms` : "—"}
              sub="Réponses assistant"
            />
            <KpiTile
              label="Tours / conv."
              value={t.avgUserTurnsPerConversation != null ? String(t.avgUserTurnsPerConversation) : "—"}
              sub="Messages utilisateur"
            />
            <KpiTile
              label="Escalade Sonnet"
              value={t.sonnetTurnPct != null ? `${t.sonnetTurnPct}%` : "—"}
              sub="Tours sensibles / longs"
            />
            <KpiTile
              label={`Coût estimé (${days} j)`}
              value={t.estimatedCostUsd != null ? `$${t.estimatedCostUsd.toFixed(2)}` : "—"}
              sub={`${fmt(t.inputTokens + t.cachedInputTokens)} tokens in · ${fmt(t.outputTokens)} out — estimation`}
            />
          </div>
        )}

        {/* Charts row 1 */}
        {overview && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <h2 className={`${serifClass} text-lg font-medium mb-3`}>Volume ({days} j)</h2>
              <div className="w-full h-[240px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                  <LineChart data={overview.dailyVolume} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={fmtDay} fontSize={10} stroke={p.ink2} interval="preserveStartEnd" />
                    <YAxis fontSize={10} stroke={p.ink2} allowDecimals={false} width={28} />
                    <Tooltip
                      labelFormatter={(l) => fmtDay(String(l))}
                      contentStyle={{ background: p.card, border: `1px solid ${p.line2}`, borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" name="Conversations" dataKey="conversations" stroke={p.accent} strokeWidth={2} dot={false} />
                    <Line type="monotone" name="Msgs user" dataKey="userMessages" stroke="#5C8A5C" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <h2 className={`${serifClass} text-lg font-medium mb-3`}>Feedback ({days} j)</h2>
              <div className="w-full h-[240px] min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                  <BarChart data={overview.dailyFeedback} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={fmtDay} fontSize={10} stroke={p.ink2} interval="preserveStartEnd" />
                    <YAxis fontSize={10} stroke={p.ink2} allowDecimals={false} width={28} />
                    <Tooltip labelFormatter={(l) => fmtDay(String(l))} contentStyle={{ background: p.card, border: `1px solid ${p.line2}`, borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar name="👍" dataKey="up" fill="#5C8A5C" radius={[3, 3, 0, 0]} />
                    <Bar name="👎" dataKey="down" fill={p.accent} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* Charts row 2 + insights */}
        {overview && (
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <h2 className={`${serifClass} text-lg font-medium mb-3`}>Outils appelés</h2>
              {overview.toolUsage.length === 0 ? (
                <p className="text-sm" style={{ color: p.ink2 }}>Aucun appel d&apos;outil sur la période.</p>
              ) : (
                <div className="w-full h-[220px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                    <BarChart
                      layout="vertical"
                      data={overview.toolUsage.slice(0, 8)}
                      margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                    >
                      <XAxis type="number" fontSize={10} stroke={p.ink2} allowDecimals={false} />
                      <YAxis type="category" dataKey="tool" width={110} fontSize={9} stroke={p.ink2} />
                      <Tooltip contentStyle={{ background: p.card, border: `1px solid ${p.line2}`, borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill={p.accent} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card className="lg:col-span-1">
              <h2 className={`${serifClass} text-lg font-medium mb-3`}>Modèles</h2>
              {modelPie.length === 0 ? (
                <p className="text-sm" style={{ color: p.ink2 }}>—</p>
              ) : (
                <div className="w-full h-[220px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                    <PieChart>
                      <Pie data={modelPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {modelPie.map((_, i) => (
                          <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: p.card, border: `1px solid ${p.line2}`, borderRadius: 8, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card className="lg:col-span-1 flex flex-col gap-4">
              <div>
                <h2 className={`${serifClass} text-lg font-medium mb-2`}>Pages d&apos;entrée</h2>
                <ul className="space-y-1.5 text-xs">
                  {overview.topSourcePages.slice(0, 6).map((row) => (
                    <li key={row.path} className="flex justify-between gap-2">
                      <span className="truncate font-mono" style={{ color: p.ink2 }} title={row.path}>
                        {row.path}
                      </span>
                      <span className="font-semibold shrink-0">{row.count}</span>
                    </li>
                  ))}
                  {overview.topSourcePages.length === 0 && (
                    <li style={{ color: p.ink2 }}>—</li>
                  )}
                </ul>
              </div>
              <div>
                <h2 className={`${serifClass} text-lg font-medium mb-2`}>Titres cités</h2>
                <ul className="space-y-1.5 text-xs">
                  {overview.topCitedMedia.slice(0, 5).map((row) => (
                    <li key={row.mediaId} className="flex justify-between gap-2">
                      <span className="truncate" title={row.title}>
                        {row.title}
                      </span>
                      <span className="font-semibold shrink-0">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        )}

        {/* Red team alerts */}
        {overview && overview.recentNegativeFeedback.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <ThumbsDown className="h-4 w-4" style={{ color: p.accent }} />
              <h2 className={`${serifClass} text-lg font-medium`}>Signaux négatifs récents</h2>
            </div>
            <div className="space-y-2">
              {overview.recentNegativeFeedback.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(f.conversationId)}
                  className="w-full text-left rounded-xl px-3 py-2.5 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(209,106,74,0.08)", border: `1px solid ${p.line}` }}
                >
                  <div className="flex justify-between gap-2 text-[10px]" style={{ color: p.ink2 }}>
                    <span>{fmtDateTime(f.createdAt)}</span>
                    <span>{f.userEmail ?? "anon"}</span>
                  </div>
                  <div className="text-sm mt-1 line-clamp-2">{f.messagePreview}</div>
                  {f.reason && (
                    <div className="text-xs mt-1 italic" style={{ color: p.accent }}>
                      « {f.reason} »
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Conversation explorer */}
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3" style={{ borderBottom: `1px solid ${p.line}` }}>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" style={{ color: p.accent }} />
              <h2 className={`${serifClass} text-lg font-medium`}>Explorateur de conversations</h2>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: p.ink2 }} />
                <input
                  type="search"
                  placeholder="Rechercher dans les messages…"
                  value={searchQ}
                  onChange={(e) => {
                    setSearchQ(e.target.value)
                    setListPage(1)
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-sm"
                  style={{ background: p.bg, border: `1px solid ${p.line}`, color: p.ink }}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={{ color: p.ink2 }}>
                <input
                  type="checkbox"
                  checked={onlyDown}
                  onChange={(e) => {
                    setOnlyDown(e.target.checked)
                    setListPage(1)
                  }}
                  className="rounded"
                />
                👎 uniquement
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "rgba(30,26,21,0.03)", color: p.ink2 }}>
                  <th className="text-left px-5 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Aperçu</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide hidden md:table-cell">Utilisateur</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Tours</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide hidden sm:table-cell">Feedback</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wide hidden lg:table-cell">Entrée</th>
                  <th className="text-right px-5 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center" style={{ color: p.ink2 }}>
                      <Loader2 className="h-5 w-5 animate-spin inline-block" />
                    </td>
                  </tr>
                ) : listRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center" style={{ color: p.ink2 }}>
                      Aucune conversation sur cette période.
                    </td>
                  </tr>
                ) : (
                  listRows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ borderTop: `1px solid ${p.line}` }}
                    >
                      <td className="px-5 py-3 max-w-[240px]">
                        <div className="truncate font-medium">{c.preview}</div>
                        {c.lastModel && (
                          <div className="flex items-center gap-1 text-[10px] mt-0.5" style={{ color: p.ink2 }}>
                            <Zap className="h-3 w-3" />
                            {shortModel(c.lastModel)}
                            {c.avgLatencyMs != null && ` · ${c.avgLatencyMs} ms`}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-xs" style={{ color: p.ink2 }}>
                        {c.isAnonymous ? "Anonyme" : c.userEmail ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{c.userTurns}</td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className="text-xs">
                          {c.feedbackUp > 0 && <span style={{ color: "#3E6640" }}>{c.feedbackUp}↑ </span>}
                          {c.feedbackDown > 0 && <span style={{ color: p.accent }}>{c.feedbackDown}↓</span>}
                          {c.feedbackUp === 0 && c.feedbackDown === 0 && "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell text-xs font-mono truncate max-w-[140px]" style={{ color: p.ink2 }}>
                        {c.sourcePage ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-xs whitespace-nowrap" style={{ color: p.ink2 }}>
                        {fmtDateTime(c.lastMessageAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ borderTop: `1px solid ${p.line}`, color: p.ink2 }}>
            <span>{fmt(listTotal)} conversation{listTotal !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={listPage <= 1}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded-lg disabled:opacity-40"
                style={{ border: `1px solid ${p.line}` }}
              >
                Préc.
              </button>
              <span>
                {listPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={listPage >= totalPages}
                onClick={() => setListPage((p) => p + 1)}
                className="px-2 py-1 rounded-lg disabled:opacity-40"
                style={{ border: `1px solid ${p.line}` }}
              >
                Suiv.
              </button>
            </div>
          </div>
        </Card>

        {/* Quick recent strip when no search */}
        {!searchQ && !onlyDown && recentConversations.length > 0 && listPage === 1 && (
          <p className="text-xs text-center" style={{ color: p.ink2 }}>
            {recentConversations.length} conversations les plus récentes affichées ci-dessus.
          </p>
        )}
      </div>

      {/* Replay panel */}
      {selectedId && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelectedId(null)}
            aria-hidden
          />
          {detailLoading || !detail ? (
            <div
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex items-center justify-center"
              style={{ background: p.bg, borderLeft: `1px solid ${p.line}` }}
            >
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
            </div>
          ) : (
            <ConversationReplay detail={detail} onClose={() => setSelectedId(null)} />
          )}
        </>
      )}
    </div>
  )
}
