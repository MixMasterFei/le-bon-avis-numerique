"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Heart, Bookmark, Loader2, MessageSquare, Share2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface MediaActionsProps {
  mediaId: string
  mediaTitle?: string
  className?: string
  onReviewClick?: () => void
}

export function MediaActions({ mediaId, mediaTitle, className = "", onReviewClick }: MediaActionsProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [isFavorite, setIsFavorite] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [loadingFavorite, setLoadingFavorite] = useState(false)
  const [loadingWatchlist, setLoadingWatchlist] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [shared, setShared] = useState(false)

  const handleShare = useCallback(async () => {
    const url = window.location.href
    const title = mediaTitle || document.title
    const text = `${title} — Avis et recommandation d'âge sur Totem Avisé`

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(url)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }, [mediaTitle])

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

  // Share button — always visible regardless of auth state
  const shareButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-1.5 hover:text-emerald-500 hover:border-emerald-200 transition-colors"
    >
      {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
      <span className="text-xs">{shared ? "Copié !" : "Partager"}</span>
    </Button>
  )

  if (status === "loading" || initialLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button variant="outline" size="sm" disabled className="gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
        <Button variant="outline" size="sm" disabled className="gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
        <Button variant="outline" size="sm" disabled className="gap-1.5">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
        {shareButton}
      </div>
    )
  }

  // Not logged in - show login prompt
  if (status === "unauthenticated") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-400 hover:text-red-500">
            <Heart className="h-4 w-4" />
            <span className="text-xs">{favoriteCount}</span>
          </Button>
        </Link>
        <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-400 hover:text-blue-500">
            <Bookmark className="h-4 w-4" />
            <span className="text-xs">À voir</span>
          </Button>
        </Link>
        <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-400 hover:text-violet-500">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Donner mon avis</span>
          </Button>
        </Link>
        {shareButton}
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

      {onReviewClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReviewClick}
          className="gap-1.5 hover:text-violet-500 hover:border-violet-200 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs">Donner mon avis</span>
        </Button>
      )}

      {shareButton}
    </div>
  )
}
