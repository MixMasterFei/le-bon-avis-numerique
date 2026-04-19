"use client"

import { useState } from "react"
import Image from "next/image"
import { EyeOff, Eye } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"
import { shouldBlurMedia, BLUR_TOOLTIP } from "@/lib/should-blur-media"

interface BlurredPosterProps {
  src: string
  alt: string
  expertAgeRec: number | null
  violenceScore?: number | null
  sexNudityScore?: number | null
  languageScore?: number | null
  substanceUseScore?: number | null
  mediaType?: string
  className?: string
  sizes?: string
  priority?: boolean
}

export function BlurredPoster({
  src,
  alt,
  expertAgeRec,
  violenceScore,
  sexNudityScore,
  languageScore,
  substanceUseScore,
  mediaType,
  className,
  sizes,
  priority,
}: BlurredPosterProps) {
  const { settings } = useSettings()
  const [revealed, setRevealed] = useState(false)
  const shouldBlur = !revealed && shouldBlurMedia(
    {
      type: mediaType ?? "MOVIE",
      expertAgeRec,
      violence: violenceScore,
      sexNudity: sexNudityScore,
      language: languageScore,
      substanceUse: substanceUseScore,
    },
    settings.blur18Plus,
  )

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        className={cn("object-cover transition-all duration-300", shouldBlur && "blur-sm brightness-90", className)}
        sizes={sizes}
        priority={priority}
      />
      {shouldBlur && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          title={BLUR_TOOLTIP}
          className="absolute inset-0 flex flex-col items-center justify-center z-10 cursor-pointer"
        >
          <div className="bg-black/50 rounded-full p-2.5">
            <EyeOff className="h-6 w-6 text-white" />
          </div>
          <p className="mt-2 text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
            Cliquer pour afficher
          </p>
        </button>
      )}
      {revealed && settings.blur18Plus && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="absolute top-2 right-2 z-10 bg-black/50 rounded-full p-1.5 cursor-pointer hover:bg-black/70 transition-colors"
          title="Masquer"
        >
          <Eye className="h-4 w-4 text-white" />
        </button>
      )}
    </>
  )
}
