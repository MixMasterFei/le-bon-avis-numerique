"use client"

import Link from "next/link"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { cn } from "@/lib/utils"

export type MethodBadgeVariant = "age" | "metrics" | "summary" | "topics"

interface MethodBadgeCopy {
  label: string
  title: string
  body: string
}

const COPY: Record<MethodBadgeVariant, MethodBadgeCopy> = {
  age: {
    label: "Analyse automatisée · en calibrage",
    title: "D'où vient cette recommandation ?",
    body: "Notre recommandation d'âge s'appuie sur une analyse automatisée du contenu : synopsis, classifications officielles, genres, thèmes. Elle est progressivement calibrée par les votes des foyers qui ont vu l'œuvre. Votre pouce pour ou contre nous aide à l'affiner.",
  },
  metrics: {
    label: "Mesures automatisées · 0 à 5",
    title: "Comment lire ces mesures ?",
    body: "Les mesures de contenu sont estimées automatiquement à partir du synopsis, des classifications officielles et des thèmes détectés. Elles indiquent la présence relative de chaque élément, pas une opinion éditoriale. À vous de décider ce qui convient à votre foyer.",
  },
  summary: {
    label: "Résumé automatisé",
    title: "Ce que nous signalons",
    body: "Ces points sont synthétisés automatiquement à partir de l'analyse du contenu. Ils servent à signaler les éléments qu'un foyer peut vouloir connaître avant de regarder, sans remplacer votre propre jugement.",
  },
  topics: {
    label: "Thèmes détectés automatiquement",
    title: "Sur les thèmes",
    body: "Les thèmes sont repérés automatiquement dans le synopsis et les métadonnées de l'œuvre. Ils servent à grouper des contenus similaires et à filtrer par sujet, pas à porter un jugement.",
  },
}

interface MethodBadgeProps {
  variant: MethodBadgeVariant
  className?: string
  align?: "start" | "center" | "end"
}

export function MethodBadge({ variant, className, align = "start" }: MethodBadgeProps) {
  const copy = COPY[variant]
  const p = APERCU_PALETTE

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${copy.label}. En savoir plus.`}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            className
          )}
          style={{
            background: p.bg2,
            color: p.ink2,
            border: `1px solid ${p.line}`,
          }}
        >
          <Info className="h-3 w-3" strokeWidth={1.75} />
          <span>{copy.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-80 border-0 p-0 shadow-none"
      >
        <div
          className="rounded-xl p-4"
          style={{
            background: p.card,
            border: `1px solid ${p.line2}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: p.ink2 }}
          >
            Méthode
          </div>
          <div
            className="mt-1 text-base font-medium leading-snug"
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {copy.title}
          </div>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: p.ink }}
          >
            {copy.body}
          </p>
          <Link
            href="/notre-methode"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: p.accent }}
          >
            En savoir plus sur notre méthode
            <span aria-hidden>→</span>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
