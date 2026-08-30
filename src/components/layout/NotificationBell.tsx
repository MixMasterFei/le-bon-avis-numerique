"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Bell,
  BellDot,
  CheckCheck,
  MessageCircle,
  Newspaper,
  Sparkles,
  X,
} from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { NOTIFICATIONS_CHANGED } from "@/lib/notification-events"
import { formatRelativeTimeFr } from "@/lib/utils"

interface NotificationItem {
  id: string
  type: string
  priority: string
  title: string
  body: string | null
  href: string | null
  readAt: string | null
  createdAt: string
}

function NotificationIcon({ type }: { type: string }) {
  const className = "h-4 w-4"
  if (type.includes("COMMENT")) return <MessageCircle className={className} />
  if (type.includes("NEWS")) return <Newspaper className={className} />
  return <Sparkles className={className} />
}

export function NotificationBell() {
  const p = APERCU_PALETTE
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/user/notifications?limit=12")
      if (!res.ok) return
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setUnreadCount(Number(data.unreadCount) || 0)
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // The 60 s poll stays as the background floor; the event below is what
    // makes a just-created notification appear immediately (see
    // @/lib/notification-events).
    const timer = window.setInterval(fetchNotifications, 60_000)
    const onChanged = () => fetchNotifications()
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged)
    }
    // fetchNotifications only calls stable state setters, so the mount-time
    // closure stays correct for the component's lifetime.
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function markAllRead() {
    const previousItems = items
    const previousCount = unreadCount
    setUnreadCount(0)
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })))
    try {
      const res = await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      })
      if (!res.ok) throw new Error("mark-all-read failed")
      const data = await res.json()
      setUnreadCount(Number(data.unreadCount) || 0)
    } catch (error) {
      console.error(error)
      setItems(previousItems)
      setUnreadCount(previousCount)
    }
  }

  async function markRead(id: string) {
    const item = items.find((n) => n.id === id)
    if (!item || item.readAt) return
    setItems((current) =>
      current.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    )
    setUnreadCount((count) => Math.max(0, count - 1))
    try {
      await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read", id }),
      })
    } catch (error) {
      console.error(error)
    }
  }

  async function removeNotification(id: string) {
    const item = items.find((n) => n.id === id)
    if (!item) return
    const previousItems = items
    const previousCount = unreadCount

    // Optimistic: the row disappears on click, and the badge drops with it when
    // the removed notification was still unread.
    setItems((current) => current.filter((n) => n.id !== id))
    if (!item.readAt) setUnreadCount((count) => Math.max(0, count - 1))

    try {
      const res = await fetch(`/api/user/notifications?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("delete failed")
      const data = await res.json()
      setUnreadCount(Number(data.unreadCount) || 0)
    } catch (error) {
      console.error(error)
      setItems(previousItems)
      setUnreadCount(previousCount)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          // Opening the panel is an explicit "show me what's current" —
          // refetch rather than showing whatever the last poll left behind.
          if (!open) fetchNotifications()
          setOpen((value) => !value)
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70"
        style={{ color: p.ink, border: `1px solid ${p.line2}`, background: p.card }}
        aria-label="Notifications"
      >
        {unreadCount > 0 ? <BellDot className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: p.accent, color: "#fff" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl shadow-xl"
          style={{ background: p.card, border: `1px solid ${p.line2}`, color: p.ink }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${p.line}` }}>
            <div className="text-sm font-bold">Notifications</div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold hover:opacity-70"
                style={{ color: p.accent }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout lu
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: p.ink2 }}>
                Chargement...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: p.ink2 }}>
                Rien de neuf pour le moment.
              </div>
            ) : (
              items.map((item) => {
                const unread = !item.readAt
                const content = (
                  <div
                    className="flex gap-3 py-3 pl-4 pr-11 text-left transition-colors hover:opacity-80"
                    style={{ background: unread ? p.bg2 : p.card, borderBottom: `1px solid ${p.line}` }}
                  >
                    <span
                      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: unread ? p.accent : p.bg2, color: unread ? "#fff" : p.ink2 }}
                    >
                      <NotificationIcon type={item.type} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug">{item.title}</span>
                      {item.body && (
                        <span className="mt-0.5 block text-xs leading-snug" style={{ color: p.ink2 }}>
                          {item.body}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px]" style={{ color: p.ink2 }}>
                        {formatRelativeTimeFr(item.createdAt)}
                      </span>
                    </span>
                  </div>
                )

                return (
                  <div key={item.id} className="relative">
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => {
                          markRead(item.id)
                          setOpen(false)
                        }}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        className="block w-full"
                      >
                        {content}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeNotification(item.id)}
                      title="Supprimer"
                      aria-label={`Supprimer la notification : ${item.title}`}
                      className="absolute right-2 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full opacity-55 transition hover:bg-black/10 hover:opacity-100 focus-visible:opacity-100"
                      style={{ color: p.ink2 }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
