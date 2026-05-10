"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { Film, Gamepad2, Newspaper } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import { APERCU_PALETTE } from "./apercuTheme"

interface MediaPick {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[]
}

export function HomepageWeeklyForFamilies({ serifClass }: { serifClass: string }) {
  const [cinema, setCinema] = useState<MediaPick | null>(null)
  const [game, setGame] = useState<MediaPick | null>(null)
  const p = APERCU_PALETTE

  useEffect(() => {
    let cancelled = false

    fetch("/api/cinema")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const movie = Array.isArray(data?.movies) ? data.movies[0] : null
        if (movie) {
          setCinema({
            id: movie.id,
            type: "MOVIE",
            title: movie.title,
            posterUrl: movie.posterUrl ?? null,
            expertAgeRec: movie.expertAgeRec ?? null,
            genres: movie.genres ?? [],
          })
        }
      })
      .catch(() => {})

    fetch("/api/db/games?sortBy=releaseDate&limit=1&requirePoster=true&minVoteCount=20")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const item = Array.isArray(data?.games) ? data.games[0] : null
        if (item) {
          setGame({
            id: item.id,
            type: "GAME",
            title: item.title,
            posterUrl: item.posterUrl ?? null,
            expertAgeRec: item.expertAgeRec ?? null,
            genres: item.genres ?? [],
          })
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="py-10 md:py-14" style={{ background: p.bg2, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: p.accent }}>
              Cette semaine pour les familles
            </div>
            <h2 className={`${serifClass} text-2xl md:text-4xl font-medium leading-[1.05]`} style={{ color: p.ink }}>
              Une raison de revenir, même sans recherche précise.
            </h2>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <WeeklyCard
            icon={Film}
            eyebrow="À regarder"
            title={cinema?.title ?? "Un film à repérer cette semaine"}
            text={cinema ? "Une sortie récente à vérifier selon l'âge et la sensibilité de votre foyer." : "Le module se remplit dès que les données cinéma sont disponibles."}
            href={cinema ? `/media/${toMediaRouteId(cinema.type, cinema.id)}` : "/films?sort=cinema"}
            imageUrl={cinema?.posterUrl ?? null}
            badge={cinema?.expertAgeRec !== null && cinema?.expertAgeRec !== undefined ? `${cinema.expertAgeRec}+` : "Cinéma"}
            serifClass={serifClass}
          />
          <WeeklyCard
            icon={Gamepad2}
            eyebrow="À surveiller"
            title={game?.title ?? "Un jeu récent à vérifier"}
            text={game ? "Une nouveauté console à regarder avant achat, installation ou demande d'enfant." : "Fallback vers les jeux récents si le rail nouveautés est temporairement vide."}
            href={game ? `/media/${toMediaRouteId(game.type, game.id)}` : "/jeux?sort=releaseDate"}
            imageUrl={game?.posterUrl ?? null}
            badge={game?.expertAgeRec !== null && game?.expertAgeRec !== undefined ? `${game.expertAgeRec}+` : "Jeux"}
            serifClass={serifClass}
          />
          <WeeklyCard
            icon={Newspaper}
            eyebrow="À lire"
            title="Un repère parent à garder sous la main"
            text="Guides, articles et méthodes donnent aux parents des phrases, règles et questions concrètes."
            href="/guides"
            imageUrl={null}
            badge="Guide"
            serifClass={serifClass}
          />
        </div>
      </div>
    </section>
  )
}

function WeeklyCard({
  icon: Icon,
  eyebrow,
  title,
  text,
  href,
  imageUrl,
  badge,
  serifClass,
}: {
  icon: React.ComponentType<{ className?: string; style?: CSSProperties }>
  eyebrow: string
  title: string
  text: string
  href: string
  imageUrl: string | null
  badge: string
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <Link
      href={href}
      className="group rounded-2xl p-4 md:p-5 transition-transform hover:-translate-y-0.5"
      style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
    >
      <div className="flex gap-4">
        <div
          className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl"
          style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
        >
          {imageUrl ? (
            <SafeImage src={imageUrl} alt={title} fill className="object-cover" sizes="64px" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-6 w-6" style={{ color: p.accent }} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.accent }}>
              {eyebrow}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: p.bg2, color: p.ink }}
            >
              {badge}
            </span>
          </div>
          <div className={`${serifClass} text-lg font-medium leading-tight group-hover:opacity-75`} style={{ color: p.ink }}>
            {title}
          </div>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: p.ink2 }}>
            {text}
          </p>
        </div>
      </div>
    </Link>
  )
}
