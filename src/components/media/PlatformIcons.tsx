import { cn } from "@/lib/utils"

// Platform display configuration
const PLATFORM_CONFIG: Record<string, { label: string; shortLabel: string; color: string; bgColor: string }> = {
  // Nintendo
  "Switch": { label: "Nintendo Switch", shortLabel: "Switch", color: "text-red-500", bgColor: "bg-red-500/10" },
  "Nintendo Switch": { label: "Nintendo Switch", shortLabel: "Switch", color: "text-red-500", bgColor: "bg-red-500/10" },
  "3DS": { label: "Nintendo 3DS", shortLabel: "3DS", color: "text-red-400", bgColor: "bg-red-400/10" },
  "Wii U": { label: "Wii U", shortLabel: "Wii U", color: "text-blue-400", bgColor: "bg-blue-400/10" },

  // PlayStation
  "PS5": { label: "PlayStation 5", shortLabel: "PS5", color: "text-blue-600", bgColor: "bg-blue-600/10" },
  "PlayStation 5": { label: "PlayStation 5", shortLabel: "PS5", color: "text-blue-600", bgColor: "bg-blue-600/10" },
  "PS4": { label: "PlayStation 4", shortLabel: "PS4", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  "PlayStation 4": { label: "PlayStation 4", shortLabel: "PS4", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  "PS3": { label: "PlayStation 3", shortLabel: "PS3", color: "text-blue-400", bgColor: "bg-blue-400/10" },

  // Xbox
  "Xbox Series": { label: "Xbox Series X|S", shortLabel: "Xbox X|S", color: "text-green-500", bgColor: "bg-green-500/10" },
  "Xbox Series X": { label: "Xbox Series X", shortLabel: "Xbox X", color: "text-green-500", bgColor: "bg-green-500/10" },
  "Xbox Series S": { label: "Xbox Series S", shortLabel: "Xbox S", color: "text-green-500", bgColor: "bg-green-500/10" },
  "Xbox One": { label: "Xbox One", shortLabel: "Xbox One", color: "text-green-600", bgColor: "bg-green-600/10" },
  "Xbox 360": { label: "Xbox 360", shortLabel: "360", color: "text-green-400", bgColor: "bg-green-400/10" },

  // PC/Other (for reference, though we filter these out)
  "PC": { label: "PC", shortLabel: "PC", color: "text-gray-500", bgColor: "bg-gray-500/10" },
  "Mac": { label: "Mac", shortLabel: "Mac", color: "text-gray-400", bgColor: "bg-gray-400/10" },
  "Linux": { label: "Linux", shortLabel: "Linux", color: "text-orange-400", bgColor: "bg-orange-400/10" },

  // Mobile
  "iOS": { label: "iOS", shortLabel: "iOS", color: "text-gray-600", bgColor: "bg-gray-600/10" },
  "Android": { label: "Android", shortLabel: "Android", color: "text-green-400", bgColor: "bg-green-400/10" },
}

// Console platforms we want to prioritize displaying
const CONSOLE_PRIORITY = ["PS5", "PlayStation 5", "PS4", "PlayStation 4", "Xbox Series", "Xbox Series X", "Xbox One", "Switch", "Nintendo Switch"]

interface PlatformIconsProps {
  platforms: string[]
  variant?: "compact" | "full" | "hero"
  maxDisplay?: number
  className?: string
}

export function PlatformIcons({
  platforms,
  variant = "compact",
  maxDisplay = 5,
  className
}: PlatformIconsProps) {
  if (!platforms || platforms.length === 0) {
    return null
  }

  // Normalize and deduplicate platforms
  const normalizedPlatforms = [...new Set(platforms.map(p => {
    // Normalize common variations
    if (p.includes("PlayStation 5") || p === "PS5") return "PS5"
    if (p.includes("PlayStation 4") || p === "PS4") return "PS4"
    if (p.includes("Xbox Series")) return "Xbox Series"
    if (p.includes("Nintendo Switch") || p === "Switch") return "Switch"
    return p
  }))]

  // Sort: consoles first, then others
  const sortedPlatforms = normalizedPlatforms.sort((a, b) => {
    const aIndex = CONSOLE_PRIORITY.indexOf(a)
    const bIndex = CONSOLE_PRIORITY.indexOf(b)
    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex
    if (aIndex >= 0) return -1
    if (bIndex >= 0) return 1
    return 0
  })

  const displayPlatforms = sortedPlatforms.slice(0, maxDisplay)
  const remainingCount = sortedPlatforms.length - maxDisplay

  if (variant === "hero") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {displayPlatforms.map((platform) => {
          const config = PLATFORM_CONFIG[platform] || {
            label: platform,
            shortLabel: platform,
            color: "text-gray-400",
            bgColor: "bg-gray-400/10"
          }
          return (
            <span
              key={platform}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                config.bgColor,
                config.color
              )}
              title={config.label}
            >
              <PlatformIcon platform={platform} className="h-4 w-4" />
              {config.shortLabel}
            </span>
          )
        })}
        {remainingCount > 0 && (
          <span className="text-sm text-gray-400">+{remainingCount}</span>
        )}
      </div>
    )
  }

  if (variant === "full") {
    return (
      <div className={cn("space-y-2", className)}>
        <h4 className="text-sm font-medium text-gray-500">Plateformes</h4>
        <div className="flex flex-wrap gap-2">
          {sortedPlatforms.map((platform) => {
            const config = PLATFORM_CONFIG[platform] || {
              label: platform,
              shortLabel: platform,
              color: "text-gray-400",
              bgColor: "bg-gray-400/10"
            }
            return (
              <span
                key={platform}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border",
                  config.bgColor,
                  config.color,
                  "border-current/20"
                )}
              >
                <PlatformIcon platform={platform} className="h-4 w-4" />
                {config.label}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  // Compact variant (default)
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {displayPlatforms.map((platform) => {
        const config = PLATFORM_CONFIG[platform] || {
          label: platform,
          shortLabel: platform.slice(0, 3),
          color: "text-gray-400",
          bgColor: "bg-gray-400/10"
        }
        return (
          <span
            key={platform}
            className={cn(
              "inline-flex items-center justify-center h-6 px-2 rounded text-xs font-medium",
              config.bgColor,
              config.color
            )}
            title={config.label}
          >
            {config.shortLabel}
          </span>
        )
      })}
      {remainingCount > 0 && (
        <span className="text-xs text-gray-400">+{remainingCount}</span>
      )}
    </div>
  )
}

// Simple SVG icons for major platforms
function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const normalizedPlatform = platform.toLowerCase()

  // PlayStation icon (simple controller shape)
  if (normalizedPlatform.includes("ps") || normalizedPlatform.includes("playstation")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.5 4.5c0-.828.672-1.5 1.5-1.5s1.5.672 1.5 1.5v7.25c0 .138.112.25.25.25h.5c.138 0 .25-.112.25-.25V4.5c0-1.933-1.567-3.5-3.5-3.5S6.5 2.567 6.5 4.5v10.25c0 .138.112.25.25.25h.5c.138 0 .25-.112.25-.25V4.5zM4 15.5c0-.828.672-1.5 1.5-1.5h13c.828 0 1.5.672 1.5 1.5v3c0 .828-.672 1.5-1.5 1.5h-13c-.828 0-1.5-.672-1.5-1.5v-3zm1.5-.5c-.276 0-.5.224-.5.5v3c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3c0-.276-.224-.5-.5-.5h-13z"/>
      </svg>
    )
  }

  // Xbox icon (X shape)
  if (normalizedPlatform.includes("xbox")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 13.5l-1.41 1.41L12 13.83l-3.09 3.09-1.41-1.41L10.59 12 7.5 8.91l1.41-1.41L12 10.59l3.09-3.09 1.41 1.41L13.41 12l3.09 3.5z"/>
      </svg>
    )
  }

  // Nintendo Switch icon (Joy-Con shape)
  if (normalizedPlatform.includes("switch") || normalizedPlatform.includes("nintendo")) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6.5 7c.83 0 1.5-.67 1.5-1.5S7.33 4 6.5 4 5 4.67 5 5.5 5.67 7 6.5 7zM19 2h-3c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h3c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1.5 15c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
      </svg>
    )
  }

  // Default gamepad icon
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </svg>
  )
}
