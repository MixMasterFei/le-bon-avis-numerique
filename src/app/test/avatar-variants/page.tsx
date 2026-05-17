/* eslint-disable @next/next/no-img-element */
"use client"

import { APERCU_PALETTE, ageBadgeColor, genreBadgeColor } from "@/components/home-v2/apercuTheme"
import { FamilyFitAvatars } from "@/components/media/FamilyFitAvatars"
import {
  FamilyFitAvatarsHearts,
  FamilyFitAvatarsFaces,
} from "@/components/media/FamilyFitAvatarsVariants"
import type { FamilyFitBand } from "@/lib/family-fit-display"

// ---------------------------------------------------------------------------
// Prototype playground for comparing avatar-pill variants on the homepage rail.
// Three columns, identical mock data. Not linked from anywhere — visit directly
// at /test/avatar-variants.
// ---------------------------------------------------------------------------

interface MockMember {
  id: string
  name: string
  emoji: string
  band: FamilyFitBand
}

interface MockCard {
  id: string
  title: string
  poster: string
  ageRec: number
  genres: string[]
  members: MockMember[]
}

const CARDS: MockCard[] = [
  {
    id: "avengers",
    title: "Avengers",
    poster: "https://image.tmdb.org/t/p/w342/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg",
    ageRec: 10,
    genres: ["Science-Fiction", "Action", "Aventure"],
    members: [
      { id: "erwan", name: "Erwan", emoji: "\u{1F9D1}", band: "goodChoice" },
      { id: "mathis", name: "Mathis", emoji: "\u{1F466}", band: "check" },
      { id: "eliott", name: "Eliott", emoji: "\u{1F9D2}", band: "check" },
    ],
  },
  {
    id: "tomodachi",
    title: "Tomodachi Life",
    poster: "https://image.tmdb.org/t/p/w342/8XmM50P0ZJ4CFc2WzpaohwgVTRq.jpg",
    ageRec: 7,
    genres: ["Simulator"],
    members: [
      { id: "erwan", name: "Erwan", emoji: "\u{1F9D1}", band: "check" },
      { id: "mathis", name: "Mathis", emoji: "\u{1F466}", band: "goodChoice" },
      { id: "eliott", name: "Eliott", emoji: "\u{1F9D2}", band: "veryAdapted" },
    ],
  },
  {
    id: "michael",
    title: "Michael",
    poster: "https://image.tmdb.org/t/p/w342/lA42hHvIAaJgONZxw4SLwRrlj1S.jpg",
    ageRec: 10,
    genres: ["Musique", "Drame"],
    members: [
      { id: "erwan", name: "Erwan", emoji: "\u{1F9D1}", band: "goodChoice" },
      { id: "mathis", name: "Mathis", emoji: "\u{1F466}", band: "goodChoice" },
      { id: "eliott", name: "Eliott", emoji: "\u{1F9D2}", band: "check" },
    ],
  },
  {
    id: "simpson",
    title: "Les Simpson",
    poster: "https://image.tmdb.org/t/p/w342/qcr9bBY6MVeLzriKCmJOv1265CO.jpg",
    ageRec: 10,
    genres: ["Familial", "Animation", "Comédie"],
    members: [
      { id: "erwan", name: "Erwan", emoji: "\u{1F9D1}", band: "veryAdapted" },
      { id: "mathis", name: "Mathis", emoji: "\u{1F466}", band: "veryAdapted" },
      { id: "eliott", name: "Eliott", emoji: "\u{1F9D2}", band: "goodChoice" },
    ],
  },
]

function CardShell({
  card,
  children,
}: {
  card: MockCard
  children: React.ReactNode
}) {
  const p = APERCU_PALETTE
  const ageColors = ageBadgeColor(card.ageRec)
  return (
    <div className="w-[180px] flex-shrink-0">
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden"
        style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
      >
        <img
          src={card.poster}
          alt={card.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-tight z-20"
          style={{
            background: ageColors.bg,
            color: ageColors.text,
            boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          }}
        >
          {card.ageRec}+
        </div>
      </div>
      <div className="mt-1.5">
        <div className="text-[13px] leading-snug font-medium" style={{ color: p.ink }}>
          {card.title}
        </div>
        <div className="mt-1 flex flex-nowrap gap-0.5 overflow-hidden max-h-[18px]">
          {card.genres.slice(0, 3).map((g) => {
            const c = genreBadgeColor(g)
            return (
              <span
                key={g}
                className="px-1 py-0.5 rounded text-[9px] font-semibold leading-tight whitespace-nowrap truncate"
                style={{ background: c.bg, color: c.text }}
              >
                {g}
              </span>
            )
          })}
        </div>
      </div>
      <div className="mt-1.5 min-h-[3rem]">{children}</div>
    </div>
  )
}

function bandToLegacyMember(m: MockMember) {
  return {
    id: m.id,
    name: m.name,
    emoji: m.emoji,
    score:
      m.band === "veryAdapted" ? 85 : m.band === "goodChoice" ? 70 : m.band === "check" ? 50 : 25,
    level:
      m.band === "veryAdapted"
        ? ("excellent" as const)
        : m.band === "goodChoice"
        ? ("good" as const)
        : m.band === "check"
        ? ("moderate" as const)
        : ("poor" as const),
  }
}

export default function AvatarVariantsTestPage() {
  const p = APERCU_PALETTE
  return (
    <div style={{ background: p.bg }} className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-medium mb-2" style={{ color: p.ink }}>
          Comparaison des pastilles famille
        </h1>
        <p className="text-sm mb-8" style={{ color: p.ink2 }}>
          Mêmes données, trois variantes. Survolez les pastilles actuelles pour le verdict en
          tooltip. Les hearts et les visages affichent le verdict en clair.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Column
            title="Actuel — anneau coloré"
            subtitle="le verdict est dans la couleur de l'anneau (vert/bleu/ambre/rose). Tooltip au survol."
          >
            {CARDS.map((card) => (
              <CardShell key={card.id} card={card}>
                <FamilyFitAvatars members={card.members.map(bandToLegacyMember)} compact />
              </CardShell>
            ))}
          </Column>

          <Column
            title="Hearts — jauge Zelda"
            subtitle="3 cœurs sous chaque enfant, remplis selon le verdict."
          >
            {CARDS.map((card) => (
              <CardShell key={card.id} card={card}>
                <FamilyFitAvatarsHearts members={card.members} />
              </CardShell>
            ))}
          </Column>

          <Column
            title="Faces — réaction prédite"
            subtitle="un emoji collé à l'avatar : 😄 🙂 😐 😟"
          >
            {CARDS.map((card) => (
              <CardShell key={card.id} card={card}>
                <FamilyFitAvatarsFaces members={card.members} />
              </CardShell>
            ))}
          </Column>
        </div>
      </div>
    </div>
  )
}

function Column({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  const p = APERCU_PALETTE
  return (
    <div>
      <h2 className="text-base font-semibold mb-1" style={{ color: p.ink }}>
        {title}
      </h2>
      <p className="text-[12px] mb-4" style={{ color: p.ink2 }}>
        {subtitle}
      </p>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
