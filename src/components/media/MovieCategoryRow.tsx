"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaCard } from "./MediaCard"
import type { MediaItem as MockMediaItem } from "@/lib/types"

interface DbMovie {
  id: string
  title: string
  originalTitle?: string
  synopsisFr?: string
  posterUrl: string
  releaseDate?: string
  expertAgeRec?: number | null
  communityAgeRec?: number | null
  genres?: string[]
  platforms?: string[]
  topics?: string[]
  contentMetrics?: any
}

function mapDbToMockFormat(movie: DbMovie): MockMediaItem {
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    type: "MOVIE",
    releaseDate: movie.releaseDate ?? null,
    posterUrl: movie.posterUrl || "/placeholder-poster.jpg",
    synopsisFr: movie.synopsisFr ?? null,
    officialRating: null,
    expertAgeRec: movie.expertAgeRec ?? null,
    communityAgeRec: movie.communityAgeRec ?? null,
    genres: movie.genres || [],
    platforms: movie.platforms || [],
    topics: movie.topics || [],
    contentMetrics: movie.contentMetrics || {
      violence: 0,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: 0,
      roleModels: 0,
      whatParentsNeedToKnow: [],
    },
    reviews: [],
  }
}

export interface CategoryConfig {
  id: string
  title: string
  subtitle?: string
  apiParams: string // Query params for the API
  linkHref?: string // Optional link to see more
}

interface MovieCategoryRowProps {
  category: CategoryConfig
}

export function MovieCategoryRow({ category }: MovieCategoryRowProps) {
  const [movies, setMovies] = useState<MockMediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    async function fetchMovies() {
      try {
        const res = await fetch(`/api/db/movies?${category.apiParams}`)
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.movies) && data.movies.length > 0) {
          setMovies(data.movies.map(mapDbToMockFormat))
        }
      } catch (error) {
        console.error(`Failed to fetch ${category.title}:`, error)
      } finally {
        setLoading(false)
      }
    }
    fetchMovies()
  }, [category.apiParams, category.title])

  // Check scroll state
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    const scrollEl = scrollRef.current
    if (scrollEl) {
      scrollEl.addEventListener("scroll", checkScroll)
      window.addEventListener("resize", checkScroll)
      return () => {
        scrollEl.removeEventListener("scroll", checkScroll)
        window.removeEventListener("resize", checkScroll)
      }
    }
  }, [movies])

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  if (loading) {
    return (
      <section className="py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
            {category.subtitle && (
              <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-1" />
            )}
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="shrink-0 w-[calc((100%-1.5rem)/3)] sm:w-[calc((100%-2.25rem)/4)] md:w-[calc((100%-3rem)/5)] lg:w-[calc((100%-3.75rem)/6)] xl:w-[calc((100%-4.5rem)/7)]"
            >
              <div className="aspect-[2/3] bg-gray-200 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (movies.length === 0) {
    return null // Don't show empty categories
  }

  return (
    <section className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            {category.title}
          </h2>
          {category.subtitle && (
            <p className="text-gray-600 text-sm mt-0.5">{category.subtitle}</p>
          )}
        </div>
        {category.linkHref && (
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href={category.linkHref}>
              Voir tout <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>

      {/* Scrollable Row */}
      <div className="relative group">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity -ml-3"
            aria-label="Défiler vers la gauche"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* Movies Container */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {movies.map((movie) => (
            <div
              key={movie.id}
              className="shrink-0 w-[calc((100%-1.5rem)/3)] sm:w-[calc((100%-2.25rem)/4)] md:w-[calc((100%-3rem)/5)] lg:w-[calc((100%-3.75rem)/6)] xl:w-[calc((100%-4.5rem)/7)]"
            >
              <MediaCard media={movie} />
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity -mr-3"
            aria-label="Défiler vers la droite"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Mobile "See more" link */}
      {category.linkHref && (
        <div className="mt-4 text-center sm:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link href={category.linkHref}>
              Voir tout <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  )
}
