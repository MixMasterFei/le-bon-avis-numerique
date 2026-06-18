"use client"

import { useState } from "react"
import Image, { ImageProps } from "next/image"
import { ImageOff } from "lucide-react"

interface SafeImageProps extends Omit<ImageProps, "onError"> {
  fallbackClassName?: string
}

export function SafeImage({ fallbackClassName, className, alt, ...props }: SafeImageProps) {
  const [error, setError] = useState(false)

  if (error) {
    // Branded, on-brand fallback for missing/broken images (e.g. a title with no
    // poster, or a dead remote URL). Replaces the stark grey "broken image" box
    // that read as a bug; uses warm tokens so it stays correct in dark mode.
    return (
      <div
        className={`flex items-center justify-center ${fallbackClassName || className}`}
        style={{
          background:
            "linear-gradient(135deg, var(--color-warm-bg2, #efe5d6), var(--color-warm-card, #fbf6ee))",
        }}
      >
        <div
          className="text-center p-4"
          style={{ color: "var(--color-warm-ink2, #9a8c79)" }}
        >
          <ImageOff className="h-8 w-8 mx-auto mb-2 opacity-70" />
          <span className="text-xs line-clamp-3">{alt}</span>
        </div>
      </div>
    )
  }

  return (
    <Image
      {...props}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  )
}
