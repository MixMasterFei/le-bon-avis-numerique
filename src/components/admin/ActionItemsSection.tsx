"use client"

import Link from "next/link"
import { AlertCircle, MessageSquarePlus, BarChart3, Flag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ActionItemsProps {
  pendingCorrections: number
  pendingContentRequests: number
  lowQualityItems: number
  pendingReports: number
}

export function ActionItemsSection({
  pendingCorrections,
  pendingContentRequests,
  lowQualityItems,
  pendingReports,
}: ActionItemsProps) {
  const items = [
    {
      title: "Corrections en attente",
      count: pendingCorrections,
      icon: AlertCircle,
      href: "/admin/operations#moderation",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
    },
    {
      title: "Demandes de contenu",
      count: pendingContentRequests,
      icon: MessageSquarePlus,
      href: "/admin/operations#moderation",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      title: "Qualité faible",
      count: lowQualityItems,
      icon: BarChart3,
      href: "/admin?filter=low-quality",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
    },
    {
      title: "Signalements",
      count: pendingReports,
      icon: Flag,
      href: "/admin/reports",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  ]

  // Filter to show only items with count > 0
  const activeItems = items.filter((item) => item.count > 0)

  if (activeItems.length === 0) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Actions requises</h2>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center text-green-700">
            Tout est en ordre ! Aucune action en attente.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-3">Actions requises</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => (
          <Link key={item.title} href={item.href}>
            <Card
              className={`${item.bgColor} ${item.borderColor} border hover:shadow-md transition-shadow cursor-pointer ${
                item.count === 0 ? "opacity-50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                  <span
                    className={`text-2xl font-bold ${
                      item.count > 0 ? item.color : "text-gray-400"
                    }`}
                  >
                    {item.count}
                  </span>
                </div>
                <p className="text-sm text-gray-600 font-medium">{item.title}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
