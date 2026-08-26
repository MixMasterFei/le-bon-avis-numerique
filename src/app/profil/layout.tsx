import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mon profil",
  description: "Gérez votre profil famille, vos membres et vos préférences de recommandation.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/profil" },
}

export default function ProfilLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
