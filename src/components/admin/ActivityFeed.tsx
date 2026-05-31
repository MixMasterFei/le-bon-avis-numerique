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
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { adminSerifClass } from "./shared/admin-ui"

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

export function ActivityFeed({
  activities,
  variant = "default",
}: ActivityFeedProps & { variant?: "default" | "apercu" }) {
  const p = APERCU_PALETTE
  const isApercu = variant === "apercu"

  if (activities.length === 0) {
    if (isApercu) {
      return (
        <div
          className="rounded-2xl p-6 text-center text-sm"
          style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink2 }}
        >
          Aucune activité récente
        </div>
      )
    }
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

  const feedItems = (
    <div className={isApercu ? "" : "divide-y"}>
      {activities.map((activity, idx) => {
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
          <div
            key={activity.id}
            className={`px-1 py-3 ${isApercu ? "" : "hover:bg-gray-50"}`}
            style={isApercu && idx > 0 ? { borderTop: `1px solid ${p.line}` } : undefined}
          >
            <div className="flex items-start gap-3">
              <div
                className="p-2 rounded-full"
                style={isApercu ? { background: p.bg2 } : undefined}
              >
                <Icon className={`h-4 w-4 ${isApercu ? "" : "text-gray-600"}`} style={isApercu ? { color: p.ink2 } : undefined} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={isApercu ? { color: p.ink } : undefined}>
                  <span className="font-medium">
                    {activity.user.name || activity.user.email?.split("@")[0] || "Admin"}
                  </span>{" "}
                  {actionLabel}{" "}
                  {typeof details === "object" && details?.title ? (
                    <span className="font-medium">&quot;{details.title}&quot;</span>
                  ) : (
                    <span style={isApercu ? { color: p.ink2 } : undefined} className={isApercu ? "" : "text-gray-500"}>
                      {entityLabel}
                    </span>
                  )}
                </p>
                <p className="text-xs mt-1" style={{ color: isApercu ? p.ink2 : undefined }}>
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
  )

  if (isApercu) {
    return (
      <div className="rounded-2xl p-4" style={{ background: p.bg2, border: `1px solid ${p.line}` }}>
        <h3 className={`${adminSerifClass} text-base font-medium mb-3`} style={{ color: p.ink }}>
          Activité admin
        </h3>
        {feedItems}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activité récente</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{feedItems}</CardContent>
    </Card>
  )
}
