import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact — Totem Avisé",
  description:
    "Contactez Totem Avisé pour une question, une suggestion ou un signalement sur le guide média des familles.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact — Totem Avisé",
    description:
      "Contactez Totem Avisé pour une question, une suggestion ou un signalement sur le guide média des familles.",
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
