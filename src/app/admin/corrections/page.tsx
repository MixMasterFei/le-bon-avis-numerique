"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  AlertTriangle,
  Check,
  X,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toMediaRouteId } from "@/lib/media-route"

interface MediaCorrection {
  id: string
  type: string
  field: string | null
  currentValue: string | null
  suggestedValue: string | null
  description: string
  status: string
  adminNotes: string | null
  createdAt: string
  media: {
    id: string
    title: string
    type: string
    posterUrl: string | null
  }
  user: {
    id: string
    name: string | null
    email: string
  }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-amber-100 text-amber-800" },
  REVIEWED: { label: "En cours", color: "bg-blue-100 text-blue-800" },
  APPROVED: { label: "Approuvée", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejetée", color: "bg-red-100 text-red-800" },
  DUPLICATE: { label: "Doublon", color: "bg-gray-100 text-gray-800" },
}

const TYPE_LABELS: Record<string, string> = {
  WRONG_INFO: "Information incorrecte",
  MISSING_INFO: "Information manquante",
  AGE_RATING: "Recommandation d'âge",
  CONTENT_WARNING: "Avertissement contenu",
  BROKEN_LINK: "Lien cassé",
  DUPLICATE: "Doublon",
  OTHER: "Autre",
}

export default function AdminCorrectionsPage() {
  const [corrections, setCorrections] = useState<MediaCorrection[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("PENDING")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const fetchCorrections = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      })
      if (filterStatus && filterStatus !== "ALL") {
        params.set("status", filterStatus)
      }

      const res = await fetch(`/api/admin/corrections?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur")
      }

      const data = await res.json()
      setCorrections(data.corrections || [])
      setStats(data.stats || {})
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCorrections()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterStatus])

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch("/api/admin/corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          adminNotes: adminNotes[id] || null,
        }),
      })

      if (!res.ok) {
        throw new Error("Erreur lors de la mise à jour")
      }

      // Refresh list
      await fetchCorrections()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setUpdatingId(null)
    }
  }

  void (stats.PENDING || 0) // totalPending — reserved for future header badge

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-amber-500 rounded-xl text-white">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Corrections signalées</h1>
        </div>
        <p className="text-gray-600">
          Gérez les signalements d&apos;erreurs envoyés par les utilisateurs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
          <Card
            key={key}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              filterStatus === key && "ring-2 ring-primary"
            )}
            onClick={() => {
              setFilterStatus(key)
              setPage(1)
            }}
          >
            <CardContent className="p-4 text-center">
              <div className={cn("inline-block px-2 py-1 rounded text-xs font-medium mb-2", color)}>
                {label}
              </div>
              <div className="text-2xl font-bold">{stats[key] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-600">Filtrer par statut:</span>
        </div>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-4 animate-spin" />
          <p>Chargement...</p>
        </div>
      ) : corrections.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Aucune correction à afficher</p>
          <p className="text-sm">Essayez de changer le filtre</p>
        </div>
      ) : (
        <div className="space-y-4">
          {corrections.map((correction) => (
            <Card key={correction.id} className="overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                {/* Media Info */}
                <div className="flex gap-4 p-4 bg-gray-50 lg:w-64 shrink-0">
                  <div className="relative w-16 h-24 rounded overflow-hidden shrink-0">
                    {correction.media.posterUrl ? (
                      <Image
                        src={correction.media.posterUrl}
                        alt={correction.media.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/media/${toMediaRouteId(correction.media.type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA", correction.media.id)}`}
                      className="font-medium text-sm hover:text-primary line-clamp-2"
                    >
                      {correction.media.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-1">
                      {correction.media.type}
                    </p>
                    <Link
                      href={`/media/${toMediaRouteId(correction.media.type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA", correction.media.id)}`}
                      target="_blank"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir la fiche
                    </Link>
                  </div>
                </div>

                {/* Correction Details */}
                <div className="flex-1 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge variant="outline">{TYPE_LABELS[correction.type] || correction.type}</Badge>
                    <Badge className={STATUS_LABELS[correction.status]?.color || "bg-gray-100"}>
                      {STATUS_LABELS[correction.status]?.label || correction.status}
                    </Badge>
                    {correction.field && (
                      <Badge variant="secondary">Champ: {correction.field}</Badge>
                    )}
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(correction.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-800">{correction.description}</p>
                  </div>

                  {(correction.currentValue || correction.suggestedValue) && (
                    <div className="grid sm:grid-cols-2 gap-3 mb-3">
                      {correction.currentValue && (
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs font-medium text-red-700 mb-1">Valeur actuelle:</p>
                          <p className="text-sm">{correction.currentValue}</p>
                        </div>
                      )}
                      {correction.suggestedValue && (
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <p className="text-xs font-medium text-green-700 mb-1">Valeur suggérée:</p>
                          <p className="text-sm">{correction.suggestedValue}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Info */}
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <span>Signalé par:</span>
                    <span className="font-medium">{correction.user.name || correction.user.email}</span>
                    <a
                      href={`mailto:${correction.user.email}`}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      Contacter
                    </a>
                  </div>

                  {/* Admin Notes */}
                  {correction.status === "PENDING" && (
                    <div className="mb-3">
                      <Textarea
                        placeholder="Notes admin (optionnel)..."
                        value={adminNotes[correction.id] || ""}
                        onChange={(e) => setAdminNotes(prev => ({
                          ...prev,
                          [correction.id]: e.target.value
                        }))}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}

                  {correction.adminNotes && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">Notes admin:</p>
                      <p className="text-sm">{correction.adminNotes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {correction.status === "PENDING" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => updateStatus(correction.id, "APPROVED")}
                        disabled={updatingId === correction.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => updateStatus(correction.id, "REJECTED")}
                        disabled={updatingId === correction.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rejeter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(correction.id, "DUPLICATE")}
                        disabled={updatingId === correction.id}
                      >
                        Doublon
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(correction.id, "REVIEWED")}
                        disabled={updatingId === correction.id}
                      >
                        En cours
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} sur {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Suivant
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
