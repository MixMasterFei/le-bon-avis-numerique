import { cn } from "@/lib/utils"
import {
  Gamepad2,
  Users,
  Globe,
  Clock,
  DollarSign,
  Zap,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HelpCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface GameInfoCardProps {
  // Game metadata
  platforms?: string[]
  genres?: string[]
  gameModes?: string[]
  // Content metrics (0-5 scale)
  consumerism?: number
  violence?: number
  // Derived info
  hasOnlineFeatures?: boolean
  hasInGamePurchases?: boolean
  className?: string
}

// Determine if game likely has online features based on genres/modes
function detectOnlineFeatures(genres?: string[], gameModes?: string[]): boolean {
  const onlineGenres = ["mmo", "multiplayer", "battle royale", "moba", "online"]
  const onlineModes = ["multiplayer", "online", "co-op", "pvp", "battle royale"]

  const genreMatch = genres?.some(g =>
    onlineGenres.some(og => g.toLowerCase().includes(og))
  )
  const modeMatch = gameModes?.some(m =>
    onlineModes.some(om => m.toLowerCase().includes(om))
  )

  return genreMatch || modeMatch || false
}

// Determine game type for display
function getGameType(genres?: string[]): string {
  if (!genres || genres.length === 0) return "Jeu video"

  const genreLower = genres.map(g => g.toLowerCase())

  if (genreLower.some(g => g.includes("platform"))) return "Jeu de plateforme"
  if (genreLower.some(g => g.includes("adventure"))) return "Aventure"
  if (genreLower.some(g => g.includes("puzzle"))) return "Puzzle"
  if (genreLower.some(g => g.includes("racing"))) return "Course"
  if (genreLower.some(g => g.includes("sport"))) return "Sport"
  if (genreLower.some(g => g.includes("rpg") || g.includes("role"))) return "RPG"
  if (genreLower.some(g => g.includes("shooter") || g.includes("fps"))) return "Tir"
  if (genreLower.some(g => g.includes("strategy"))) return "Strategie"
  if (genreLower.some(g => g.includes("simulation"))) return "Simulation"
  if (genreLower.some(g => g.includes("music") || g.includes("rhythm"))) return "Rythme"
  if (genreLower.some(g => g.includes("fighting"))) return "Combat"

  return genres[0] || "Jeu video"
}

// Status indicator component
function StatusItem({
  icon: Icon,
  label,
  status,
  description
}: {
  icon: React.ElementType
  label: string
  status: "yes" | "no" | "unknown" | "warning"
  description?: string
}) {
  const statusConfig = {
    yes: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    no: { icon: XCircle, color: "text-gray-400", bg: "bg-gray-50" },
    unknown: { icon: HelpCircle, color: "text-gray-400", bg: "bg-gray-50" },
    warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" }
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className={cn("flex items-center gap-3 p-3 rounded-lg", config.bg)}>
      <div className="shrink-0">
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">{label}</span>
          <StatusIcon className={cn("h-4 w-4", config.color)} />
        </div>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  )
}

export function GameInfoCard({
  platforms,
  genres,
  gameModes,
  consumerism,
  violence,
  hasOnlineFeatures: providedOnline,
  hasInGamePurchases: providedPurchases,
  className
}: GameInfoCardProps) {
  // Detect features
  const hasOnline = providedOnline ?? detectOnlineFeatures(genres, gameModes)
  const hasPurchases = providedPurchases ?? (consumerism !== undefined && consumerism >= 3)
  const hasViolence = violence !== undefined && violence >= 3
  const gameType = getGameType(genres)

  // Determine if multiplayer
  const isMultiplayer = gameModes?.some(m =>
    m.toLowerCase().includes("multiplayer") ||
    m.toLowerCase().includes("co-op")
  ) || hasOnline

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-green-600" />
          Infos pour les parents
        </CardTitle>
        <p className="text-sm text-gray-500">
          Ce qu'il faut savoir avant de jouer
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Game Type */}
        <StatusItem
          icon={Gamepad2}
          label={gameType}
          status="yes"
          description={genres?.slice(0, 3).join(", ")}
        />

        {/* Multiplayer / Online */}
        <StatusItem
          icon={isMultiplayer ? Users : Globe}
          label={isMultiplayer ? "Multijoueur" : "Solo uniquement"}
          status={hasOnline ? "warning" : isMultiplayer ? "yes" : "no"}
          description={
            hasOnline
              ? "Interactions en ligne avec d'autres joueurs"
              : isMultiplayer
                ? "Peut se jouer a plusieurs localement"
                : "Se joue seul"
          }
        />

        {/* In-game purchases */}
        <StatusItem
          icon={DollarSign}
          label="Achats integres"
          status={hasPurchases ? "warning" : "no"}
          description={
            hasPurchases
              ? "Propose des achats avec de l'argent reel"
              : "Pas d'achats supplementaires"
          }
        />

        {/* Violence indicator */}
        {hasViolence && (
          <StatusItem
            icon={Zap}
            label="Contenu violent"
            status="warning"
            description="Contient des scenes de violence"
          />
        )}

        {/* Reading level hint for younger games */}
        {genres?.some(g =>
          g.toLowerCase().includes("puzzle") ||
          g.toLowerCase().includes("education") ||
          g.toLowerCase().includes("platform")
        ) && (
          <StatusItem
            icon={BookOpen}
            label="Lecture minimale"
            status="yes"
            description="Peu de texte a lire pour jouer"
          />
        )}
      </CardContent>
    </Card>
  )
}
