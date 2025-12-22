import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CookieConsent } from "@/components/CookieConsent"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
})

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
})

export const metadata: Metadata = {
  title: "Le Bon Avis Numérique - Avis et recommandations médias pour les familles",
  description: "Trouvez les meilleurs films, séries, jeux et livres pour vos enfants grâce à nos critiques indépendantes et recommandations par âge. Le guide média de confiance pour les familles françaises.",
  keywords: ["avis films enfants", "recommandations séries", "jeux vidéo famille", "livres jeunesse", "CSA", "PEGI", "contrôle parental"],
  authors: [{ name: "Le Bon Avis Numérique" }],
  openGraph: {
    title: "Le Bon Avis Numérique",
    description: "Le guide média de confiance pour les familles françaises",
    locale: "fr_FR",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  )
}
