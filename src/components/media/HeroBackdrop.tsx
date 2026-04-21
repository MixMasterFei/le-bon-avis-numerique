"use client"

import Image from "next/image"
import { useSettings } from "@/contexts/SettingsContext"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface HeroBackdropProps {
  src: string
  expertAgeRec: number | null
  violenceScore?: number | null
}

/**
 * Warm-palette hero backdrop: a soft, blurred poster behind a
 * terracotta-to-cream gradient, so the hero reads on the cream
 * canvas instead of a dark overlay.
 *
 * Honours the blur-18+ setting: returns just the cream gradient
 * (no imagery) for sensitive content.
 */
export function HeroBackdrop({ src, expertAgeRec, violenceScore }: HeroBackdropProps) {
  const { settings } = useSettings()
  const p = APERCU_PALETTE

  const hideImage = settings.blur18Plus && (
    (expertAgeRec !== null && expertAgeRec >= 16) ||
    (violenceScore !== undefined && violenceScore !== null && violenceScore >= 4)
  )

  return (
    <>
      {!hideImage && (
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{
            filter: "blur(40px) saturate(1.1)",
            transform: "scale(1.1)",
            opacity: 0.55,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            rgba(209, 106, 74, 0.12) 0%,
            rgba(245, 241, 233, 0.80) 45%,
            ${p.bg} 100%)`,
        }}
      />
    </>
  )
}
