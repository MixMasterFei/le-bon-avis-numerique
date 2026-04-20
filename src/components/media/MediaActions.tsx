"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Heart, Bookmark, Loader2, MessageSquare, Share2, Check } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

interface MediaActionsProps {
  mediaId: string
  mediaTitle?: string
  className?: string
  onReviewClick?: () => void
}

interface PillButtonProps {
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  activeColor?: string
  children: React.ReactNode
}

function PillButton({
  onClick,
  disabled,
  active,
  activeColor,
  children,
}: PillButtonProps) {
  const p = APERCU_PALETTE
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all disabled:opacity-60"
      style={{
        background: active
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.12)",
        color: active ? activeColor || p.ink : "#fff",
        border: `1px solid ${
          active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.25)"
        }`,
        backdropFilter: "blur(6px)",
      }}
    >
      {children}
    </button>
  )
}

export function MediaActions({
  mediaId,
  mediaTitle,
  className = "",
  onReviewClick,
}: MediaActionsProps) {
  const p = APERCU_PALETTE
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
        // ignore
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
          session?.user
            ? fetch(`/api/user/watchlist?mediaId=${mediaId}`)
            : Promise.resolve(null),
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
    const wasFavorite = isFavorite
    setIsFavorite(!isFavorite)
    setFavoriteCount((prev) => (wasFavorite ? prev - 1 : prev + 1))
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
      setIsFavorite(wasFavorite)
      setFavoriteCount((prev) => (wasFavorite ? prev + 1 : prev - 1))
    } finally {
      setLoadingFavorite(false)
    }
  }

  const handleWatchlist = async () => {
    if (!session?.user) return
    setLoadingWatchlist(true)
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
      setInWatchlist(wasInWatchlist)
    } finally {
      setLoadingWatchlist(false)
    }
  }

  const shareButton = (
    <PillButton onClick={handleShare} active={shared} activeColor={SAGE}>
      {shared ? (
        <Check className="h-4 w-4" style={{ color: SAGE }} />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      <span className="text-xs">{shared ? "Copié !" : "Partager"}</span>
    </PillButton>
  )

  if (status === "loading" || initialLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {[0, 1, 2].map((i) => (
          <PillButton key={i} disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
          </PillButton>
        ))}
        {shareButton}
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
          <PillButton>
            <Heart className="h-4 w-4" />
            <span className="text-xs">{favoriteCount}</span>
          </PillButton>
        </Link>
        <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
          <PillButton>
            <Bookmark className="h-4 w-4" />
            <span className="text-xs">À voir</span>
          </PillButton>
        </Link>
        <Link href={`/connexion?callbackUrl=${encodeURIComponent(pathname)}`}>
          <PillButton>
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs">Donner mon avis</span>
          </PillButton>
        </Link>
        {shareButton}
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PillButton
        onClick={handleFavorite}
        disabled={loadingFavorite}
        active={isFavorite}
        activeColor={p.accent}
      >
        {loadingFavorite ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart
            className="h-4 w-4"
            style={{
              fill: isFavorite ? p.accent : "transparent",
              color: isFavorite ? p.accent : "currentColor",
            }}
          />
        )}
        <span className="text-xs">{favoriteCount}</span>
      </PillButton>

      <PillButton
        onClick={handleWatchlist}
        disabled={loadingWatchlist}
        active={inWatchlist}
        activeColor={SAGE}
      >
        {loadingWatchlist ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bookmark
            className="h-4 w-4"
            style={{
              fill: inWatchlist ? SAGE : "transparent",
              color: inWatchlist ? SAGE : "currentColor",
            }}
          />
        )}
        <span className="text-xs">
          {inWatchlist ? "Dans ma liste" : "À voir"}
        </span>
      </PillButton>

      {onReviewClick && (
        <PillButton onClick={onReviewClick}>
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs">Donner mon avis</span>
        </PillButton>
      )}

      {shareButton}
    </div>
  )
}
