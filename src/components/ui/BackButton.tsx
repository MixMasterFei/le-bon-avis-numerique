"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface BackButtonProps {
  className?: string
  fallbackHref?: string
}

export function BackButton({ className, fallbackHref = "/" }: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    // Check if there's history to go back to
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      onClick={handleBack}
      className={cn(
        "inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      Retour
    </button>
  )
}
