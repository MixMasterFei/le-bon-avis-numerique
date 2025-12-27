"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Heart, Bookmark, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface MediaActionsProps {
  mediaId: string
  className?: string
}

export function MediaActions({ mediaId, className = "" }: MediaActionsProps) {
  const { data: session, status } = useSession()
  const [isFavorite, setIsFavorite] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loadingFavorite, setLoadingFavorite] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [favRes, watchRes] = await Promise.all([
          fetch(`/api/user/favorite?mediaId=${mediaId}`),
          session?.user ? fetch(`/api/user/watchlist?mediaId=${mediaId}`) : Promise.resolve(null)
        ])

        if (favRes.ok) {
          const favData = await favRes.json()
          setFavoriteCount(favData.count || 0)
          setIsFavorite(favData.isFavorite || false)
        }

        if (watchRes?.ok) {
          const watchData = await watchRes.json()
          setInWatchlist(watchData.inWatchlist || false)
        }
      } catch (err) {
        console.error("Failed to fetch media status:", err)
      } finally {
        setInitialLoading(false)
      }
    }

    fetchStatus()
  }, [mediaId, session])

  const handleFavorite = async () => {
    if (!session?.user) return

    setLoadingFavorite(true)
    // Optimistic update
    const waseFavorite = isFavorite
    setIsFavorite(!isFavorite)
    setFavoriteCount(prev => waseFavorite ? prev - 1 : prev + 1)

    try {
      const res = await fetch("/api/user/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      })

      if (!res.ok) throw new Error("Failed")

      const data = await res.json()
      setIsFavorite(data.isFavorite)
    } catch {
      // Revert on error
      setIsFavorite(waseFavorite)
      setFavoriteCount(prev => waseFavorite ? prev + 1 : prev - 1)
    } finally {
      setLoadingFavorite(false)
    }
  }

  const handleWatchlist = async () => {
    if (!session?.user) return

    setLoadingWatchlist(true)
    // Optimistic update
    const wasInWatchlist = inWatchlist
    setInWatchlist(!inWatchlist)

    try {
      const res = await fetch("/api/user/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      })

      if (!res.ok) throw new Error("Failed")

      const data = await res.json()
      setInWatchlist(data.inWatchlist)
    } catch {
      // Revert on error
      setInWatchlist(wasInWatchlist)
    } finally {
      setLoadingWatchlist(false)
    }
  }

  if (status === "loading" || initialLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button variant="outline" size="sm" disabled className="gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
        <Button variant="outline" size="sm" disabled className="gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      </div>
    )
  }

  // Not logged in - show login prompt
  if (status === "unauthenticated") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link href="/connexion">
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-400 hover:text-red-500">
            <Heart className="h-4 w-4" />
            <span className="text-xs">{favoriteCount}</span>
          </Button>
        </Link>
        <Link href="/connexion">
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-400 hover:text-blue-500">
            <Bookmark className="h-4 w-4" />
            <span className="text-xs">À voir</span>
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleFavorite}
        disabled={loadingFavorite}
        className={`gap-1.5 transition-colors ${
          isFavorite
            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
            : "hover:text-red-500 hover:border-red-200"
        }`}
      >
        {loadingFavorite ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500" : ""}`} />
        )}
        <span className="text-xs">{favoriteCount}</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleWatchlist}
        disabled={loadingWatchlist}
        className={`gap-1.5 transition-colors ${
          inWatchlist
            ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
            : "hover:text-blue-500 hover:border-blue-200"
        }`}
      >
        {loadingWatchlist ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark className={`h-4 w-4 ${inWatchlist ? "fill-blue-500" : ""}`} />
        )}
        <span className="text-xs">{inWatchlist ? "Dans ma liste" : "À voir"}</span>
      </Button>
    </div>
  )
}
