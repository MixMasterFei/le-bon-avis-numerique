"use client"

import { Sun, CloudRain, Cloud, Snowflake, Wind } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { WeekendWeather, WeekendCondition } from "@/lib/weekend-weather"

const ICON: Record<WeekendCondition, typeof Sun> = {
  sunny: Sun,
  mixed: Cloud,
  rainy: CloudRain,
  cold: Wind,
  snow: Snowflake,
}

const HEADLINE: Record<WeekendCondition, string> = {
  sunny: "Beau temps prévu",
  mixed: "Temps variable",
  rainy: "Pluie attendue",
  cold: "Temps frais",
  snow: "Risque de neige",
}

const SUGGESTIONS: Record<WeekendCondition, string[]> = {
  sunny: [
    "Pique-nique ou vélo en famille",
    "Sortie au parc ou au jardin botanique",
    "Visite d'un site en plein air",
  ],
  mixed: [
    "Marché du dimanche puis musée",
    "Cinéma jeunesse l'après-midi",
    "Atelier créatif à la maison",
  ],
  rainy: [
    "Soirée jeux de société",
    "Cinéma ou séance lecture",
    "Cuisine en famille (recette du week-end)",
  ],
  cold: [
    "Musée ou exposition couverte",
    "Patinoire si elle est ouverte",
    "Lecture au coin du feu",
  ],
  snow: [
    "Bonhomme de neige et luge si possible",
    "Chocolat chaud + livre",
    "Film de Noël (même hors saison)",
  ],
}

/**
 * Sidebar widget: Activités du week-end — combines a 2-day forecast
 * (Open-Meteo, free API) with a small curated list of family activity
 * ideas matched to the dominant weather condition. Indoor or outdoor
 * suggestions adjust automatically.
 *
 * City defaults to Paris. A future iteration could let the user pick
 * their nearest city; for the Aperçu we ship Paris.
 */
export function WeekendActivitesCard({
  weather,
  serifClass,
}: {
  weather: WeekendWeather
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const Icon = ICON[weather.condition]

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.accent2, color: "#FFFFFF" }}
      >
        <Icon className="w-3 h-3" />
        Week-end à {weather.city}
      </div>
      <div className="flex items-baseline gap-3 mb-3">
        <div
          className={`${serifClass} text-2xl font-medium leading-none`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {HEADLINE[weather.condition]}
        </div>
      </div>
      <div className="text-[11px] mb-3 flex gap-3" style={{ color: p.ink2 }}>
        <span>Sam. {weather.saturdayTempMax}°C</span>
        <span>Dim. {weather.sundayTempMax}°C</span>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: p.ink2 }}>
        Idées famille
      </div>
      <ul className="space-y-1.5 text-sm" style={{ color: p.ink }}>
        {SUGGESTIONS[weather.condition].map((s, i) => (
          <li key={i} className="leading-snug flex items-start gap-2">
            <span style={{ color: p.accent2 }}>·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
