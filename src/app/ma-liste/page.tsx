"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Bookmark, Loader2 } from "lucide-react"
import {
  ApercuMediaCard,
  type ApercuCardMedia,
} from "@/components/home-v2/ApercuMediaCard"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface ApiItem {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
}

export default function MaListePage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const { data: session, status } = useSession()
  const [watchlist, setWatchlist] = useState<ApercuCardMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await fetch("/api/user/watchlist")
        if (!res.ok) throw new Error("Erreur lors du chargement")
        const data = await res.json()
        const mapped = (data.watchlist as ApiItem[])
          .filter((it): it is ApiItem & { type: "MOVIE" | "TV" | "GAME" } =>
            it.type === "MOVIE" || it.type === "TV" || it.type === "GAME"
          )
          .map<ApercuCardMedia>((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            posterUrl: item.posterUrl,
            expertAgeRec: item.expertAgeRec,
            genres: item.genres || [],
            contentMetrics: null,
          }))
        setWatchlist(mapped)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue")
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchWatchlist()
    }
  }, [session])

  if (status === "loading") {
    return (
      <div
        className="container mx-auto px-4 py-16 flex justify-center"
        style={{ background: p.bg }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
      </div>
    )
  }

  if (!session?.user) {
    redirect("/connexion?callbackUrl=/ma-liste")
  }

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col flex-1"
        style={{ background: p.bg, color: p.ink }}
      >
        <section
          className="py-8 md:py-12"
          style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
        >
          <div className="container mx-auto px-4 md:px-8">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Mon espace
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05]`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              Ma liste{" "}
              <em className="italic" style={{ color: p.accent }}>
                à voir
              </em>
            </h1>
            <p className="mt-3 text-sm md:text-base" style={{ color: p.ink2 }}>
              Les films, séries et jeux que vous voulez regarder plus tard.
            </p>
          </div>
        </section>

        <section className="flex-1 py-8 md:py-12" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            {loading ? (
              <div
                className="flex items-center justify-center py-16"
                style={{ color: p.ink2 }}
              >
                <Loader2
                  className="h-8 w-8 animate-spin mr-3"
                  style={{ color: p.accent }}
                />
                Chargement de votre liste...
              </div>
            ) : error ? (
              <div
                className="rounded-xl px-4 py-3"
                style={{
                  background: "rgba(209, 106, 74, 0.12)",
                  border: `1px solid ${p.accent}`,
                  color: p.ink,
                }}
              >
                {error}
              </div>
            ) : watchlist.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <Bookmark
                  className="h-12 w-12 mx-auto mb-4"
                  style={{ color: p.ink2, opacity: 0.4 }}
                />
                <h2
                  className={`${serifClass} text-2xl font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Aucun contenu dans votre liste
                </h2>
                <p className="text-sm mb-6" style={{ color: p.ink2 }}>
                  Parcourez le catalogue et ajoutez des contenus à voir plus
                  tard.
                </p>
                <Link
                  href="/films"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
                  style={{ background: p.ink, color: p.bg }}
                >
                  Parcourir les films
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                {watchlist.map((item) => (
                  <ApercuMediaCard
                    key={item.id}
                    media={item}
                    size="sm"
                    serifClass={serifClass}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </FamilyFitProvider>
  )
}
