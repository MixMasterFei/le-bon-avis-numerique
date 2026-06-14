"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { X } from "lucide-react"
import { APERCU_AGE_BUCKETS } from "@/components/home-v2/apercuTheme"

/**
 * Conversion nudge for logged-out visitors. Appears after the user picks an
 * age (or scrolls to "Bientôt"); the × collapses it into a glowing totem
 * launcher (state persisted). Bottom-LEFT to avoid the global Totem dock
 * (bottom-right). Uses the real logo.
 */
export function FamilyNudge({ selectedKeys, isLoggedIn }: { selectedKeys: string[]; isLoggedIn: boolean }) {
  const [shown, setShown] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (selectedKeys.length > 0) queueMicrotask(() => setShown(true))
  }, [selectedKeys.length])

  useEffect(() => {
    const el = document.getElementById("bientot")
    if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setShown(true) }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem("ta-fam-collapsed") === "1") {
      queueMicrotask(() => setCollapsed(true))
    }
  }, [])

  if (isLoggedIn || !shown) return null

  const buckets = APERCU_AGE_BUCKETS.filter((b) => selectedKeys.includes(b.key))

  const collapse = () => {
    setCollapsed(true)
    try { window.localStorage.setItem("ta-fam-collapsed", "1") } catch {}
  }
  const expand = () => {
    setCollapsed(false)
    try { window.localStorage.setItem("ta-fam-collapsed", "0") } catch {}
  }

  if (collapsed) {
    return (
      <button
        onClick={expand}
        aria-label="Reprendre la création de votre famille"
        className="fixed bottom-6 left-6 z-[60] grid h-[62px] w-[62px] place-items-center rounded-full"
        style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 16px 34px -12px rgba(40,28,12,.5)" }}
      >
        <span
          aria-hidden
          className="v2-blob pointer-events-none absolute -inset-[9px]"
          style={{ background: "linear-gradient(135deg,#E8633A,#C5512C 55%,#D99524)", filter: "blur(11px)", opacity: 0.6, borderRadius: "42% 58% 55% 45%/55% 45% 58% 42%" }}
        />
        <Image src="/logo-icon.png" alt="" width={32} height={32} className="relative z-10" />
      </button>
    )
  }

  return (
    <aside
      className="fixed bottom-6 left-6 z-[60] w-[332px] max-w-[calc(100vw-2rem)] rounded-[20px] p-[18px]"
      style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 26px 64px -22px rgba(40,28,12,.55)" }}
    >
      <button onClick={collapse} aria-label="Réduire" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full" style={{ color: "var(--ink-3)" }}>
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2.5 pr-6">
        <Image src="/logo-icon.png" alt="" width={36} height={36} />
        <div>
          <div className="text-[15.5px] font-bold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--ink)" }}>Composez votre famille</div>
          <div className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>Des repères gardés rien que pour vous.</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-start gap-2.5">
        {buckets.map((b) => (
          <div key={b.key} className="flex w-[42px] flex-col items-center gap-1.5">
            <span className="grid h-10 w-10 place-items-center rounded-full text-[13px] font-extrabold" style={{ background: b.color, color: "#23201C", fontFamily: "var(--font-bricolage)" }}>
              {b.label.split("–")[0].replace("+", "")}
            </span>
            <span className="whitespace-nowrap text-[9.5px] font-semibold" style={{ color: "var(--ink-3)" }}>{b.label}</span>
          </div>
        ))}
        <Link href="/inscription" aria-label="Ajouter un membre" className="grid h-10 w-10 place-items-center rounded-full text-[20px]" style={{ border: "1.6px dashed var(--line)", color: "var(--ink-3)" }}>
          +
        </Link>
      </div>
      <p className="mt-4 text-[12.8px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
        Créez votre compte en 1 min pour garder vos âges, vos repères et votre liste « à voir ».
      </p>
      <Link href="/inscription" className="mt-3 flex w-full items-center justify-center rounded-full px-3 py-3 text-[14.5px] font-bold text-white" style={{ background: "var(--terra)" }}>
        Créer ma famille gratuitement
      </Link>
      <div className="mt-2.5 text-center text-[11px]" style={{ color: "var(--ink-3)" }}>Gratuit · sans pub · indépendant</div>
    </aside>
  )
}
