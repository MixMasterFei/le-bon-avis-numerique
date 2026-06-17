import { cn } from "@/lib/utils"
import {
  Gamepad2,
  Users,
  Globe,
  DollarSign,
  BookOpen,
  Monitor,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
} from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { OfficialRatingBadge } from "@/components/media/AgeBadge"
import { pegiAgeFromOfficialRating, sortPegiDescriptors } from "@/lib/pegi-descriptors"

interface GameInfoCardProps {
  platforms?: string[]
  genres?: string[]
  gameModes?: string[]
  consumerism?: number
  officialRating?: string | null
  pegiDescriptors?: string[]
  expertAgeRec?: number | null
  hasOnlineFeatures?: boolean
  hasInGamePurchases?: boolean
  className?: string
}

function detectOnlineFeatures(genres?: string[], gameModes?: string[]): boolean {
  const onlineGenres = ["mmo", "multiplayer", "battle royale", "moba", "online"]
  const onlineModes = ["multiplayer", "online", "co-op", "pvp", "battle royale"]

  const genreMatch = genres?.some((g) =>
    onlineGenres.some((og) => g.toLowerCase().includes(og)),
  )
  const modeMatch = gameModes?.some((m) =>
    onlineModes.some((om) => m.toLowerCase().includes(om)),
  )

  return genreMatch || modeMatch || false
}

function getGameType(genres?: string[]): string {
  if (!genres || genres.length === 0) return "Jeu vidéo"

  const genreLower = genres.map((g) => g.toLowerCase())

  if (genreLower.some((g) => g.includes("platform"))) return "Jeu de plateforme"
  if (genreLower.some((g) => g.includes("adventure"))) return "Aventure"
  if (genreLower.some((g) => g.includes("puzzle"))) return "Puzzle"
  if (genreLower.some((g) => g.includes("racing"))) return "Course"
  if (genreLower.some((g) => g.includes("sport"))) return "Sport"
  if (genreLower.some((g) => g.includes("rpg") || g.includes("role"))) return "RPG"
  if (genreLower.some((g) => g.includes("shooter") || g.includes("fps"))) return "Tir"
  if (genreLower.some((g) => g.includes("strategy"))) return "Stratégie"
  if (genreLower.some((g) => g.includes("simulation"))) return "Simulation"
  if (genreLower.some((g) => g.includes("music") || g.includes("rhythm"))) return "Rythme"
  if (genreLower.some((g) => g.includes("fighting"))) return "Combat"

  return genres[0] || "Jeu vidéo"
}

function StatusItem({
  icon: Icon,
  label,
  status,
  description,
}: {
  icon: React.ElementType
  label: string
  status: "yes" | "no" | "unknown" | "warning"
  description?: string
}) {
  const p = APERCU_PALETTE

  const tone = {
    yes: { color: p.accent2, bg: p.bg2 },
    no: { color: p.ink2, bg: p.bg2 },
    unknown: { color: p.ink2, bg: p.bg2 },
    warning: { color: p.accent, bg: p.bg2 },
  }[status]

  const StatusIcon = {
    yes: CheckCircle,
    no: XCircle,
    unknown: HelpCircle,
    warning: AlertTriangle,
  }[status]

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{ background: tone.bg }}
    >
      <div className="shrink-0">
        <Icon className="h-5 w-5" style={{ color: tone.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm" style={{ color: p.ink }}>
            {label}
          </span>
          <StatusIcon className="h-4 w-4" style={{ color: tone.color }} />
        </div>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: p.ink2 }}>
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

function GamePegiPanel({
  officialRating,
  pegiDescriptors,
  expertAgeRec,
}: {
  officialRating?: string | null
  pegiDescriptors?: string[]
  expertAgeRec?: number | null
}) {
  const p = APERCU_PALETTE
  const sorted = sortPegiDescriptors(pegiDescriptors ?? [])
  const pegiAge = pegiAgeFromOfficialRating(officialRating)
  const totemDiffers =
    typeof expertAgeRec === "number" &&
    typeof pegiAge === "number" &&
    expertAgeRec !== pegiAge

  return (
    <div
      className="flex h-full flex-col rounded-xl p-4 md:p-5"
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <p
        className="text-xs font-bold uppercase tracking-[0.12em] mb-3"
        style={{ color: p.accent }}
      >
        Classification PEGI
      </p>

      <div className="flex flex-col items-center gap-2 mb-4">
        <OfficialRatingBadge rating={officialRating} type="GAME" size="md" showLabel />
        {totemDiffers && (
          <p className="text-center text-xs" style={{ color: p.ink2 }}>
            Totem recommande{" "}
            <strong style={{ color: p.ink }}>dès {expertAgeRec} ans</strong>
          </p>
        )}
      </div>

      {sorted.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {sorted.map((d) => (
            <li
              key={d}
              className="rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                background: p.card,
                color: p.ink,
                border: `1px solid ${p.line}`,
              }}
            >
              {d}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm" style={{ color: p.ink2 }}>
          {officialRating
            ? "Aucun pictogramme de contenu renseigné pour ce titre."
            : "Classification PEGI non disponible."}
        </p>
      )}

      <p className="mt-auto pt-4 text-[11px] leading-relaxed" style={{ color: p.ink2 }}>
        Classification officielle européenne. Totem peut recommander un âge différent
        si le contenu, les achats en ligne ou le chat le justifient.
      </p>
    </div>
  )
}

export function GameInfoCard({
  platforms,
  genres,
  gameModes,
  consumerism,
  officialRating,
  pegiDescriptors,
  expertAgeRec,
  hasOnlineFeatures: providedOnline,
  hasInGamePurchases: providedPurchases,
  className,
}: GameInfoCardProps) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  const hasOnline = providedOnline ?? detectOnlineFeatures(genres, gameModes)
  const hasPurchases = providedPurchases ?? (consumerism !== undefined && consumerism >= 3)
  const gameType = getGameType(genres)

  const isMultiplayer =
    gameModes?.some(
      (m) =>
        m.toLowerCase().includes("multiplayer") || m.toLowerCase().includes("co-op"),
    ) || hasOnline

  const platformStr =
    platforms && platforms.length > 0 ? platforms.slice(0, 4).join(", ") : null

  return (
    <div
      className={cn("rounded-2xl", className)}
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="p-5 pb-3">
        <h3
          className={`${serifClass} text-lg font-medium flex items-center gap-2`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          <Gamepad2 className="h-5 w-5" style={{ color: p.accent }} />
          Infos pour les parents
        </h3>
        <p className="text-sm mt-1" style={{ color: p.ink2 }}>
          Ce qu&apos;il faut savoir avant de jouer
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-5 pb-5">
        <div className="space-y-2">
          <StatusItem
            icon={Gamepad2}
            label={gameType}
            status="yes"
            description={genres?.slice(0, 3).join(", ")}
          />

          {platformStr && (
            <StatusItem
              icon={Monitor}
              label="Plateformes"
              status="yes"
              description={platformStr}
            />
          )}

          <StatusItem
            icon={isMultiplayer ? Users : Globe}
            label={isMultiplayer ? "Multijoueur" : "Solo uniquement"}
            status={hasOnline ? "warning" : isMultiplayer ? "yes" : "no"}
            description={
              hasOnline
                ? "Interactions en ligne avec d'autres joueurs"
                : isMultiplayer
                  ? "Peut se jouer à plusieurs localement"
                  : "Se joue seul"
            }
          />

          <StatusItem
            icon={DollarSign}
            label="Achats intégrés"
            status={hasPurchases ? "warning" : "no"}
            description={
              hasPurchases
                ? "Propose des achats avec de l'argent réel"
                : "Pas d'achats supplémentaires"
            }
          />

          {genres?.some(
            (g) =>
              g.toLowerCase().includes("puzzle") ||
              g.toLowerCase().includes("education") ||
              g.toLowerCase().includes("platform"),
          ) && (
            <StatusItem
              icon={BookOpen}
              label="Lecture minimale"
              status="yes"
              description="Peu de texte à lire pour jouer"
            />
          )}
        </div>

        <GamePegiPanel
          officialRating={officialRating}
          pegiDescriptors={pegiDescriptors}
          expertAgeRec={expertAgeRec}
        />
      </div>
    </div>
  )
}
