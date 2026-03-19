"use client"

import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Activity {
  id: string
  action: string
  entityType: string
  entityId?: string | null
  details?: string | null
  createdAt: string | Date
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

interface ActivityFeedProps {
  activities: Activity[]
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  IMPORT: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  APPROVE: CheckCircle,
  REJECT: XCircle,
  SYNC: RefreshCw,
  UPDATE_CONTENT_REQUEST: FileText,
}

const ACTION_LABELS: Record<string, string> = {
  IMPORT: "a importé",
  UPDATE: "a modifié",
  DELETE: "a supprimé",
  APPROVE: "a approuvé",
  APPROVE_CORRECTION: "a validé une correction",
  REJECT: "a rejeté",
  REJECT_CORRECTION: "a rejeté une correction",
  SYNC: "a synchronisé",
  UPDATE_CONTENT_REQUEST: "a traité une demande",
}

const ENTITY_LABELS: Record<string, string> = {
  MEDIA: "contenu",
  MOVIE: "film",
  TV: "série",
  GAME: "jeu",
  BOOK: "livre",
  REVIEW: "avis",
  CORRECTION: "correction",
  CONTENT_REQUEST: "demande de contenu",
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            Aucune activité récente
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activité récente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {activities.map((activity) => {
            const Icon = ACTION_ICONS[activity.action] || Edit
            const actionLabel = ACTION_LABELS[activity.action] || activity.action.toLowerCase()
            const entityLabel = ENTITY_LABELS[activity.entityType] || activity.entityType.toLowerCase()

            let details = null
            if (activity.details) {
              try {
                details = JSON.parse(activity.details)
              } catch {
                details = activity.details
              }
            }

            return (
              <div key={activity.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <Icon className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {activity.user.name || activity.user.email?.split("@")[0] || "Admin"}
                      </span>{" "}
                      {actionLabel}{" "}
                      {typeof details === "object" && details?.title ? (
                        <span className="font-medium">"{details.title}"</span>
                      ) : (
                        <span className="text-gray-500">{entityLabel}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
