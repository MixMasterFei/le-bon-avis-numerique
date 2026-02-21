"use client"

import Image from "next/image"
import { useSettings } from "@/contexts/SettingsContext"

interface HeroBackdropProps {
  src: string
  expertAgeRec: number | null
  violenceScore?: number | null
}

export function HeroBackdrop({ src, expertAgeRec, violenceScore }: HeroBackdropProps) {
  const { settings } = useSettings()
  const shouldHide = settings.blur18Plus && (
    (expertAgeRec !== null && expertAgeRec >= 16) ||
    (violenceScore !== undefined && violenceScore !== null && violenceScore >= 4)
  )

  if (shouldHide) return null

  return (
    <Image
      src={src}
      alt=""
      fill
      className="object-cover opacity-20 blur-xl scale-110"
    />
  )
}
