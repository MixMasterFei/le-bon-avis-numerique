import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact",
  description: "Une question, une suggestion ? Contactez l'équipe de Totem Avisé. Nous répondons à toutes les demandes sous 48 heures.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact | Totem Avisé",
    description: "Une question, une suggestion ? Contactez l'équipe de Totem Avisé.",
    url: "https://totemavise.com/contact",
  },
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
