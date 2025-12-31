"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  Loader2,
  Check,
  X,
  Clock,
  Search,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

interface ContentRequest {
  id: string
  title: string
  mediaType: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  externalId: string | null
  description: string | null
  status: string
  priority: number
  adminNotes: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  media: {
    id: string
    title: string
    type: string
    posterUrl: string | null
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  REVIEWING: "En cours",
  APPROVED: "Approuve",
  ADDED: "Ajoute",
  REJECTED: "Rejete",
  DUPLICATE: "Doublon",
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  REVIEWING: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  ADDED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  DUPLICATE: "bg-gray-100 text-gray-800",
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  MOVIE: Film,
  TV: Tv,
  GAME: Gamepad2,
  BOOK: BookOpen,
  APP: BookOpen,
}

export default function ContentRequestsPage() {
  const [requests, setRequests] = useState<ContentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("PENDING")
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== "ALL") {
        params.append("status", statusFilter)
      }

      const res = await fetch(`/api/admin/content-requests?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests)
        setStatusCounts(data.statusCounts || {})
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [statusFilter])

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    setUpdatingId(requestId)
    try {
      const res = await fetch("/api/admin/content-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: requestId, status: newStatus }),
      })

      if (res.ok) {
        fetchRequests()
      }
    } catch (err) {
      console.error("Failed to update request:", err)
    } finally {
      setUpdatingId(null)
    }
  }

  const pendingCount = statusCounts["PENDING"] || 0

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Demandes de contenu</h1>
          <p className="text-gray-600">
            {pendingCount > 0
              ? `${pendingCount} demande(s) en attente`
              : "Aucune demande en attente"}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les statuts</SelectItem>
            <SelectItem value="PENDING">
              En attente ({statusCounts["PENDING"] || 0})
            </SelectItem>
            <SelectItem value="REVIEWING">
              En cours ({statusCounts["REVIEWING"] || 0})
            </SelectItem>
            <SelectItem value="APPROVED">
              Approuves ({statusCounts["APPROVED"] || 0})
            </SelectItem>
            <SelectItem value="ADDED">
              Ajoutes ({statusCounts["ADDED"] || 0})
            </SelectItem>
            <SelectItem value="REJECTED">
              Rejetes ({statusCounts["REJECTED"] || 0})
            </SelectItem>
            <SelectItem value="DUPLICATE">
              Doublons ({statusCounts["DUPLICATE"] || 0})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucune demande trouvee
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const TypeIcon = TYPE_ICONS[request.mediaType] || Film
            const isUpdating = updatingId === request.id

            return (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <TypeIcon className="h-6 w-6 text-gray-600" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">{request.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                            <span>
                              {request.mediaType === "MOVIE"
                                ? "Film"
                                : request.mediaType === "TV"
                                ? "Serie"
                                : request.mediaType === "GAME"
                                ? "Jeu"
                                : request.mediaType}
                            </span>
                            <span>•</span>
                            <span>
                              par {request.user.name || request.user.email?.split("@")[0]}
                            </span>
                            <span>•</span>
                            <span>
                              {formatDistanceToNow(new Date(request.createdAt), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </span>
                          </div>
                          {request.description && (
                            <p className="text-sm text-gray-600 mt-2">
                              {request.description}
                            </p>
                          )}
                          {request.externalId && (
                            <p className="text-xs text-gray-400 mt-1">
                              ID externe: {request.externalId}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <Badge className={STATUS_COLORS[request.status]}>
                          {STATUS_LABELS[request.status] || request.status}
                        </Badge>
                      </div>

                      {/* Linked Media */}
                      {request.media && (
                        <div className="mt-3 p-2 bg-green-50 rounded-lg flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700">
                            Lie a: {request.media.title}
                          </span>
                          <Link
                            href={`/media/${request.media.id}`}
                            className="text-green-600 hover:text-green-700"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      )}

                      {/* Actions */}
                      {request.status === "PENDING" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "REVIEWING")}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Clock className="h-4 w-4 mr-1" />
                                En cours
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "APPROVED")}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "REJECTED")}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-gray-600 border-gray-300"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "DUPLICATE")}
                          >
                            Doublon
                          </Button>
                        </div>
                      )}

                      {request.status === "REVIEWING" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "ADDED")}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Marquer comme ajoute
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "REJECTED")}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}

                      {request.status === "APPROVED" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(request.id, "ADDED")}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Marquer comme ajoute
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
