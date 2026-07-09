import type { Metadata } from "next"
import { renderCoinFamillePage } from "@/components/home-v2/renderCoinFamillePage"

// Fully auth-personalized (session + family members + saved weather city) —
// cannot be ISR/static.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Le Coin Famille",
  description:
    "Votre rendez-vous famille du jour : actus utiles, sorties et idées choisies pour votre foyer.",
  robots: { index: false, follow: false }, // private, personalized surface
}

export default async function CoinFamillePage() {
  return renderCoinFamillePage()
}
