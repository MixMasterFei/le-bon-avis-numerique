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
    return (
      <div className={`flex items-center justify-center bg-gray-200 ${fallbackClassName || className}`}>
        <div className="text-center text-gray-400 p-4">
          <ImageOff className="h-8 w-8 mx-auto mb-2" />
          <span className="text-xs">{alt}</span>
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
