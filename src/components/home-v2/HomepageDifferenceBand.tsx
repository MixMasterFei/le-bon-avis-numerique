"use client"

import { BadgeCheck, Film, ShieldAlert, Users } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

const ITEMS = [
  {
    icon: BadgeCheck,
    title: "Pas seulement l'âge officiel",
    text: "On distingue l'étiquette, le contexte et ce que l'enfant va vraiment voir.",
  },
  {
    icon: ShieldAlert,
    title: "Scènes sensibles analysées",
    text: "Violence, peur, langage, sexualité ou substances : les signaux utiles sont visibles avant de lancer.",
  },
  {
    icon: Users,
    title: "Avis adapté à chaque enfant",
    text: "Une fratrie n'a pas toujours la même tolérance. Le profil famille rend cette nuance lisible.",
  },
  {
    icon: Film,
    title: "Films, séries et jeux ensemble",
    text: "Un seul réflexe pour préparer une soirée, un trajet, un week-end ou une nouvelle console.",
  },
]

export function HomepageDifferenceBand({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE

  return (
    <section className="py-10 md:py-12" style={{ background: p.bg2, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.4fr] lg:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: p.accent }}>
              Pourquoi c&apos;est différent
            </div>
            <h2 className={`${serifClass} text-2xl md:text-4xl font-medium leading-[1.05]`} style={{ color: p.ink }}>
              Choisir sans transformer la maison en tribunal.
            </h2>
            <p className="mt-3 text-sm md:text-base leading-relaxed" style={{ color: p.ink2 }}>
              La page doit faire comprendre vite que Totem Avisé n&apos;est pas un catalogue de plus, mais un outil
              de décision familiale.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-2xl p-4 md:p-5"
                  style={{ background: p.card, border: `1px solid ${p.line}` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: p.bg2, color: p.accent }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className={`${serifClass} text-base font-medium leading-tight`} style={{ color: p.ink }}>
                        {item.title}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: p.ink2 }}>
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
