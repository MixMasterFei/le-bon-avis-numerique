"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Check,
  X,
  Clock,
  Loader2,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { toMediaRouteId } from "@/lib/media-route"
import { adminPalette, AdminBtn, AdminSectionTitle, fmt } from "../shared/admin-ui"

interface Correction {
  id: string
  type: string
  field: string | null
  description: string
  status: string
  suggestedValue: string | null
  currentValue: string | null
  createdAt: string
  media: { id: string; title: string; type: string; posterUrl: string | null }
  user: { name: string | null; email: string }
}

interface ContentRequest {
  id: string
  title: string
  mediaType: string
  description: string | null
  status: string
  createdAt: string
  user: { name: string | null; email: string | null }
}

const TYPE_LABELS: Record<string, string> = {
  WRONG_INFO: "Info incorrecte",
  MISSING_INFO: "Info manquante",
  AGE_RATING: "Âge",
  CONTENT_WARNING: "Contenu",
  OTHER: "Autre",
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function ModerationPanel() {
  const p = adminPalette
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [requests, setRequests] = useState<ContentRequest[]>([])
  const [pendingCorrections, setPendingCorrections] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [showAllCorrections, setShowAllCorrections] = useState(false)
  const [showAllRequests, setShowAllRequests] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [corrRes, reqRes] = await Promise.all([
        fetch("/api/admin/corrections?status=PENDING&limit=20&page=1"),
        fetch("/api/admin/content-requests?status=PENDING"),
      ])
      if (corrRes.ok) {
        const data = await corrRes.json()
        setCorrections(data.corrections ?? [])
        setPendingCorrections(data.stats?.PENDING ?? data.corrections?.length ?? 0)
      }
      if (reqRes.ok) {
        const data = await reqRes.json()
        setRequests(data.requests ?? [])
        setPendingRequests(data.statusCounts?.PENDING ?? data.requests?.length ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const updateCorrection = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch("/api/admin/corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNotes: adminNotes[id] || null }),
      })
      if (res.ok) await load()
    } finally {
      setUpdatingId(null)
    }
  }

  const updateRequest = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch("/api/admin/content-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) await load()
    } finally {
      setUpdatingId(null)
    }
  }

  const visibleCorrections = showAllCorrections ? corrections : corrections.slice(0, 5)
  const visibleRequests = showAllRequests ? requests : requests.slice(0, 5)

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: p.accent }} />
      </div>
    )
  }

  const nothingPending = pendingCorrections === 0 && pendingRequests === 0

  return (
    <div className="space-y-8">
      {nothingPending ? (
        <div
          className="rounded-xl px-4 py-3 text-sm text-center"
          style={{ background: "rgba(92,138,92,0.08)", border: `1px solid rgba(92,138,92,0.2)`, color: p.ink }}
        >
          Aucune modération en attente.
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 text-sm">
          {pendingCorrections > 0 && (
            <button
              type="button"
              onClick={() => scrollTo("mod-corrections")}
              className="rounded-full px-3 py-1 font-semibold"
              style={{ background: p.bg2, color: p.accent, border: `1px solid ${p.line2}` }}
            >
              {fmt(pendingCorrections)} correction{pendingCorrections > 1 ? "s" : ""}
            </button>
          )}
          {pendingRequests > 0 && (
            <button
              type="button"
              onClick={() => scrollTo("mod-requests")}
              className="rounded-full px-3 py-1 font-semibold"
              style={{ background: p.bg2, color: p.accent, border: `1px solid ${p.line2}` }}
            >
              {fmt(pendingRequests)} demande{pendingRequests > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      <div id="mod-corrections">
        <AdminSectionTitle
          title="Corrections signalées"
          subtitle={
            pendingCorrections > 0
              ? `${fmt(pendingCorrections)} en attente de validation`
              : "File vide"
          }
        />
        {corrections.length === 0 ? (
          <p className="text-sm" style={{ color: p.ink2 }}>
            Aucune correction en attente.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleCorrections.map((c) => (
              <div
                key={c.id}
                className="rounded-xl p-4 flex flex-col sm:flex-row gap-4"
                style={{ background: p.bg2, border: `1px solid ${p.line}` }}
              >
                <div className="relative w-12 h-16 rounded overflow-hidden shrink-0 bg-neutral-200">
                  {c.media.posterUrl && (
                    <Image src={c.media.posterUrl} alt="" fill className="object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Link
                      href={`/media/${toMediaRouteId(c.media.type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA", c.media.id)}`}
                      className="font-medium text-sm hover:opacity-70"
                      style={{ color: p.ink }}
                    >
                      {c.media.title}
                    </Link>
                    <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded" style={{ background: p.card, color: p.ink2 }}>
                      {TYPE_LABELS[c.type] ?? c.type}
                    </span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: p.ink }}>
                    {c.description}
                  </p>
                  <p className="text-xs mb-2" style={{ color: p.ink2 }}>
                    {c.user.name ?? c.user.email} ·{" "}
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: fr })}
                  </p>
                  <Textarea
                    placeholder="Note admin (optionnel)…"
                    value={adminNotes[c.id] ?? ""}
                    onChange={(e) => setAdminNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    rows={2}
                    className="text-sm mb-2"
                  />
                  <div className="flex flex-wrap gap-2">
                    <AdminBtn size="sm" onClick={() => updateCorrection(c.id, "APPROVED")} disabled={updatingId === c.id}>
                      <Check className="w-3.5 h-3.5" /> Approuver
                    </AdminBtn>
                    <AdminBtn size="sm" onClick={() => updateCorrection(c.id, "REJECTED")} disabled={updatingId === c.id}>
                      <X className="w-3.5 h-3.5" /> Rejeter
                    </AdminBtn>
                    <AdminBtn size="sm" variant="ghost" onClick={() => updateCorrection(c.id, "DUPLICATE")} disabled={updatingId === c.id}>
                      Doublon
                    </AdminBtn>
                  </div>
                </div>
              </div>
            ))}
            {corrections.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllCorrections((v) => !v)}
                className="text-xs font-semibold inline-flex items-center gap-1"
                style={{ color: p.ink2 }}
              >
                {showAllCorrections ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAllCorrections ? "Réduire" : `Voir les ${corrections.length - 5} autres`}
              </button>
            )}
          </div>
        )}
      </div>

      <div id="mod-requests">
        <AdminSectionTitle
          title="Demandes de contenu"
          subtitle={
            pendingRequests > 0
              ? `${fmt(pendingRequests)} demande(s) à traiter`
              : "File vide"
          }
        />
        {requests.length === 0 ? (
          <p className="text-sm" style={{ color: p.ink2 }}>
            Aucune demande en attente.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleRequests.map((r) => {
              const Icon =
                r.mediaType === "TV" ? Tv : r.mediaType === "GAME" ? Gamepad2 : r.mediaType === "BOOK" ? BookOpen : Film
              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 flex gap-3"
                  style={{ background: p.bg2, border: `1px solid ${p.line}` }}
                >
                  <div className="p-2 rounded-lg h-fit" style={{ background: p.card, color: p.ink2 }}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm" style={{ color: p.ink }}>
                      {r.title}
                    </p>
                    {r.description && (
                      <p className="text-sm mt-1" style={{ color: p.ink2 }}>
                        {r.description}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: p.ink2 }}>
                      {r.user.name ?? r.user.email?.split("@")[0]} ·{" "}
                      {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <AdminBtn size="sm" onClick={() => updateRequest(r.id, "APPROVED")} disabled={updatingId === r.id}>
                        <Check className="w-3.5 h-3.5" /> Approuver
                      </AdminBtn>
                      <AdminBtn size="sm" onClick={() => updateRequest(r.id, "REJECTED")} disabled={updatingId === r.id}>
                        <X className="w-3.5 h-3.5" /> Rejeter
                      </AdminBtn>
                      <AdminBtn size="sm" variant="ghost" onClick={() => updateRequest(r.id, "REVIEWING")} disabled={updatingId === r.id}>
                        <Clock className="w-3.5 h-3.5" /> En cours
                      </AdminBtn>
                    </div>
                  </div>
                </div>
              )
            })}
            {requests.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllRequests((v) => !v)}
                className="text-xs font-semibold inline-flex items-center gap-1"
                style={{ color: p.ink2 }}
              >
                {showAllRequests ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {showAllRequests ? "Réduire" : `Voir les ${requests.length - 5} autres`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
