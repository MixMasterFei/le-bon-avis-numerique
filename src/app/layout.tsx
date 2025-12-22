import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CookieConsent } from "@/components/CookieConsent"
import { SessionProvider } from "@/components/providers/SessionProvider"

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
  title: "Le Bon Avis Numerique - Avis et recommandations medias pour les familles",
  description: "Trouvez les meilleurs films, series, jeux et livres pour vos enfants grace a nos critiques independantes et recommandations par age. Le guide media de confiance pour les familles francaises.",
  keywords: ["avis films enfants", "recommandations series", "jeux video famille", "livres jeunesse", "CSA", "PEGI", "controle parental"],
  authors: [{ name: "Le Bon Avis Numerique" }],
  openGraph: {
    title: "Le Bon Avis Numerique",
    description: "Le guide media de confiance pour les familles francaises",
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
        <SessionProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CookieConsent />
        </SessionProvider>
      </body>
    </html>
  )
}
