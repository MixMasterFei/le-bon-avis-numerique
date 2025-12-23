import { cn } from "@/lib/utils"

interface AgeBadgeProps {
  age: number | null | undefined
  size?: "sm" | "md" | "lg"
  label?: string
  className?: string
}

export function AgeBadge({ age, size = "md", label, className }: AgeBadgeProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-12 w-12 text-lg",
    lg: "h-16 w-16 text-2xl",
  }

  const getBgColor = (age: number | null | undefined) => {
    if (age === null || age === undefined) return "bg-gray-500"
    if (age <= 3) return "bg-emerald-500"
    if (age <= 7) return "bg-emerald-600"
    if (age <= 10) return "bg-amber-500"
    if (age <= 13) return "bg-orange-500"
    return "bg-red-500"
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full text-white font-bold shadow-md",
          sizeClasses[size],
          getBgColor(age)
        )}
      >
        {age === null || age === undefined ? "—" : `${age}+`}
      </div>
      {label && (
        <span className="text-xs text-gray-600 font-medium">{label}</span>
      )}
    </div>
  )
}

interface OfficialRatingBadgeProps {
  rating: string | null | undefined
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  size?: "sm" | "md"
  className?: string
}

export function OfficialRatingBadge({
  rating,
  type,
  size = "md",
  className,
}: OfficialRatingBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  }

  const getRatingDisplay = () => {
    if (!rating) return { label: "Non classé", color: "bg-gray-500" }
    // CSA ratings for Movies/TV
    if (type === "MOVIE" || type === "TV") {
      switch (rating) {
        case "TOUS_PUBLICS":
          return { label: "Tous publics", color: "bg-green-500" }
        case "CSA_10":
          return { label: "-10", color: "bg-yellow-500" }
        case "CSA_12":
          return { label: "-12", color: "bg-orange-500" }
        case "CSA_16":
          return { label: "-16", color: "bg-red-500" }
        case "CSA_18":
          return { label: "-18", color: "bg-red-700" }
        default:
          return { label: rating, color: "bg-gray-500" }
      }
    }

    // PEGI ratings for Games/Apps
    if (type === "GAME" || type === "APP") {
      switch (rating) {
        case "PEGI_3":
          return { label: "PEGI 3", color: "bg-green-500" }
        case "PEGI_7":
          return { label: "PEGI 7", color: "bg-green-600" }
        case "PEGI_12":
          return { label: "PEGI 12", color: "bg-yellow-500" }
        case "PEGI_16":
          return { label: "PEGI 16", color: "bg-orange-500" }
        case "PEGI_18":
          return { label: "PEGI 18", color: "bg-red-500" }
        default:
          return { label: rating, color: "bg-gray-500" }
      }
    }

    return { label: rating, color: "bg-gray-500" }
  }

  const { label, color } = getRatingDisplay()

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold text-white rounded-md shadow-sm",
        sizeClasses[size],
        color,
        className
      )}
    >
      {label}
    </span>
  )
}


