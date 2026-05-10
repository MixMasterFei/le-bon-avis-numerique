"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, UserRound, XCircle } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

const FAMILY = [
  { name: "Emma", age: "7 ans", color: "#F8D775" },
  { name: "Noé", age: "11 ans", color: "#8DBDC9" },
  { name: "Parent", age: "repère", color: "#B8D89A" },
]

const VERDICTS = [
  {
    title: "Film d'aventure",
    meta: "Rythme doux · quelques scènes tendues",
    label: "Bon choix",
    icon: CheckCircle2,
    color: "#5C8A5C",
    detail: "Emma peut regarder avec un adulte, Noé est à l'aise.",
  },
  {
    title: "Série fantastique",
    meta: "Créatures · suspense · épisodes courts",
    label: "À vérifier",
    icon: AlertTriangle,
    color: "#D16A4A",
    detail: "Bon pour Noé, mais certaines images peuvent impressionner Emma.",
  },
  {
    title: "Jeu de combat",
    meta: "Violence stylisée · compétition en ligne",
    label: "Trop tôt",
    icon: XCircle,
    color: "#C2410C",
    detail: "À garder pour plus tard ou à remplacer par un jeu coopératif.",
  },
]

export function HomepageFamilyFitPreview({
  serifClass,
  isLoggedIn,
}: {
  serifClass: string
  isLoggedIn: boolean
}) {
  const p = APERCU_PALETTE

  return (
    <section className="py-10 md:py-14" style={{ background: p.bg, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.4fr] lg:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: p.accent }}>
              Profil famille en action
            </div>
            <h2 className={`${serifClass} text-2xl md:text-4xl font-medium leading-[1.05]`} style={{ color: p.ink }}>
              Le même contenu ne tombe pas pareil dans chaque famille.
            </h2>
            <p className="mt-3 text-sm md:text-base leading-relaxed" style={{ color: p.ink2 }}>
              Cette preview montre ce que la homepage doit rendre évident : Totem Avisé aide à choisir pour des
              enfants réels, pas pour une moyenne abstraite.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {FAMILY.map((member) => (
                <div
                  key={member.name}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm"
                  style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ background: member.color, color: "#1E1A15" }}
                  >
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{member.name}</span>
                  <span style={{ color: p.ink2 }}>{member.age}</span>
                </div>
              ))}
            </div>
            <Link
              href={isLoggedIn ? "/profil" : "/inscription"}
              className="mt-6 inline-flex rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={{ background: p.ink, color: p.bg }}
            >
              {isLoggedIn ? "Compléter mon foyer" : "Créer mon profil famille"}
            </Link>
          </div>

          <div className="grid gap-3">
            {VERDICTS.map((verdict) => {
              const Icon = verdict.icon
              return (
                <div
                  key={verdict.title}
                  className="rounded-2xl p-4 md:p-5"
                  style={{ background: p.card, border: `1px solid ${p.line}` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className={`${serifClass} text-lg md:text-xl font-medium`} style={{ color: p.ink }}>
                        {verdict.title}
                      </div>
                      <div className="mt-1 text-sm" style={{ color: p.ink2 }}>
                        {verdict.meta}
                      </div>
                    </div>
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={{ background: p.bg2, color: verdict.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {verdict.label}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: p.ink2 }}>
                    {verdict.detail}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
