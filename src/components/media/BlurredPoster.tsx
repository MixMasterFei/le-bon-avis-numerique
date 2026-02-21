"use client"

import Image from "next/image"
import { EyeOff } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { cn } from "@/lib/utils"

interface BlurredPosterProps {
  src: string
  alt: string
  expertAgeRec: number | null
  violenceScore?: number | null
  className?: string
  sizes?: string
  priority?: boolean
}

export function BlurredPoster({ src, alt, expertAgeRec, violenceScore, className, sizes, priority }: BlurredPosterProps) {
  const { settings } = useSettings()
  const shouldBlur = settings.blur18Plus && (
    (expertAgeRec !== null && expertAgeRec >= 16) ||
    (violenceScore !== undefined && violenceScore !== null && violenceScore >= 4)
  )

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        className={cn("object-cover", shouldBlur && "blur-xl scale-110", className)}
        sizes={sizes}
        priority={priority}
      />
      {shouldBlur && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-black/60 rounded-full p-3">
            <EyeOff className="h-8 w-8 text-white" />
          </div>
          <p className="absolute bottom-4 text-white text-sm font-medium bg-black/60 px-3 py-1 rounded-full">
            Contenu sensible
          </p>
        </div>
      )}
    </>
  )
}
