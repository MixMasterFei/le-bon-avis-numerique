"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { TotemSheet } from "./TotemSheet"
import { TotemAlphaBadge } from "./TotemAlphaBadge"

const HIDDEN_PATH_PREFIXES = ["/admin", "/studio", "/onboarding", "/connexion", "/inscription"]

export function TotemDock() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("totem:open", handler)
    return () => window.removeEventListener("totem:open", handler)
  }, [])

  if (!mounted) return null
  if (HIDDEN_PATH_PREFIXES.some((p) => pathname?.startsWith(p))) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer Totem" : "Ouvrir Totem"}
        aria-expanded={open}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-[var(--color-accent)] text-white shadow-lg transition",
          "hover:scale-105 hover:shadow-xl active:scale-95",
          "sm:bottom-6 sm:right-6 sm:h-[60px] sm:w-[60px]",
          !open && "animate-totem-pulse",
        )}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -right-1 -top-1">
              <TotemAlphaBadge variant="compact" />
            </span>
          </>
        )}
      </button>
      <TotemSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
