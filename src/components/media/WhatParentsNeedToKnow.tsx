import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface WhatParentsNeedToKnowProps {
  items: string[]
  className?: string
}

export function WhatParentsNeedToKnow({
  items,
  className,
}: WhatParentsNeedToKnowProps) {
  if (!items || items.length === 0) return null

  const getIcon = (text: string) => {
    const lowercaseText = text.toLowerCase()
    if (
      lowercaseText.includes("excellent") ||
      lowercaseText.includes("parfait") ||
      lowercaseText.includes("positif") ||
      lowercaseText.includes("encourage")
    ) {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
    }
    if (
      lowercaseText.includes("attention") ||
      lowercaseText.includes("supervision") ||
      lowercaseText.includes("difficile") ||
      lowercaseText.includes("effrayant")
    ) {
      return <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
    }
    return <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
  }

  return (
    <Card className={cn("bg-blue-50/50 border-blue-100", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
          <Info className="h-5 w-5 text-primary" />
          Ce que les parents doivent savoir
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex gap-3">
            {getIcon(item)}
            <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}





