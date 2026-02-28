"use client"

import Link from "next/link"
import { ArrowLeft, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function ReportsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Signalements</h1>
          <p className="text-sm text-gray-500">Avis signalés par les utilisateurs</p>
        </div>
      </div>

      <Card className="border-gray-200 bg-gray-50">
        <CardContent className="p-8 text-center">
          <Flag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun signalement en attente</p>
        </CardContent>
      </Card>
    </div>
  )
}
