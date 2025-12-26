"use client"

import { useState, useEffect } from "react"
import { Heart, Bookmark, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface UserInteractionBarProps {
  mediaId: string
  onReviewClick: () => void
  className?: string
}

export function UserInteractionBar({
  mediaId,
  onReviewClick,
  className,
}: UserInteractionBarProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch initial state
  useEffect(() => {
    async function fetchState() {
      try {
        // Fetch favorite count (public)
        const countRes = await fetch(`/api/user/favorite?mediaId=${mediaId}`)
        if (countRes.ok) {
          const data = await countRes.json()
          setFavoriteCount(data.count || 0)
        }

        // If logged in, check user state
        if (session?.user) {
          const [favRes, watchRes] = await Promise.all([
            fetch(`/api/user/favorite?mediaId=${mediaId}&checkUser=true`),
            fetch(`/api/user/watchlist?mediaId=${mediaId}`),
          ])

          if (favRes.ok) {
            const data = await favRes.json()
            setIsFavorite(data.isFavorite || false)
          }

          if (watchRes.ok) {
            const data = await watchRes.json()
            setInWatchlist(data.inWatchlist || false)
          }
        }
      } catch (error) {
        console.error("Failed to fetch interaction state:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status !== "loading") {
      fetchState()
    }
  }, [mediaId, session, status])

  const handleFavoriteClick = async () => {
    if (!session?.user) {
      router.push("/connexion")
      return
    }

    try {
      const res = await fetch("/api/user/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      })

      if (res.ok) {
        const data = await res.json()
        setIsFavorite(data.isFavorite)
        setFavoriteCount((prev) => (data.isFavorite ? prev + 1 : prev - 1))
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error)
    }
  }

  const handleWatchlistClick = async () => {
    if (!session?.user) {
      router.push("/connexion")
      return
    }

    try {
      const res = await fetch("/api/user/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      })

      if (res.ok) {
        const data = await res.json()
        setInWatchlist(data.inWatchlist)
      }
    } catch (error) {
      console.error("Failed to toggle watchlist:", error)
    }
  }

  const handleReviewClick = () => {
    if (!session?.user) {
      router.push("/connexion")
      return
    }
    onReviewClick()
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Favorite / Best-of */}
      <Button
        variant={isFavorite ? "default" : "outline"}
        size="lg"
        onClick={handleFavoriteClick}
        disabled={isLoading}
        className={cn(
          "gap-2",
          isFavorite && "bg-red-500 hover:bg-red-600 border-red-500"
        )}
      >
        <Heart
          className={cn(
            "h-5 w-5",
            isFavorite && "fill-white"
          )}
        />
        <span>Coup de cœur</span>
        {favoriteCount > 0 && (
          <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-sm">
            {favoriteCount}
          </span>
        )}
      </Button>

      {/* Watchlist */}
      <Button
        variant={inWatchlist ? "default" : "outline"}
        size="lg"
        onClick={handleWatchlistClick}
        disabled={isLoading}
        className={cn(
          "gap-2",
          inWatchlist && "bg-blue-500 hover:bg-blue-600 border-blue-500"
        )}
      >
        <Bookmark
          className={cn(
            "h-5 w-5",
            inWatchlist && "fill-white"
          )}
        />
        <span>À voir plus tard</span>
      </Button>

      {/* Review */}
      <Button
        variant="outline"
        size="lg"
        onClick={handleReviewClick}
        className="gap-2"
      >
        <MessageSquare className="h-5 w-5" />
        <span>Donner mon avis</span>
      </Button>
    </div>
  )
}
