import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CookieConsent } from "@/components/CookieConsent"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { SettingsProvider } from "@/contexts/SettingsContext"
import { ScrollRestoration } from "@/components/providers/ScrollRestoration"
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
})

const anton = localFont({
  src: "../fonts/Anton-Regular.ttf",
  variable: "--font-anton",
  display: "swap",
})

const edunline = localFont({
  src: "../fonts/edunline.ttf",
  variable: "--font-edunline",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL("https://totemavise.com"),
  title: {
    default: "Totem Avisé - Avis et recommandations médias pour les familles",
    template: "%s | Totem Avisé",
  },
  description: "Trouvez les meilleurs films, séries et jeux pour vos enfants grâce à nos critiques indépendantes et recommandations par âge. Le guide média de confiance pour les familles françaises.",
  keywords: ["avis films enfants", "recommandations séries", "jeux vidéo famille", "CSA", "PEGI", "contrôle parental"],
  authors: [{ name: "Totem Avisé" }],
  openGraph: {
    title: "Totem Avisé",
    description: "Le guide média de confiance pour les familles françaises",
    locale: "fr_FR",
    type: "website",
    siteName: "Totem Avisé",
  },
  twitter: {
    card: "summary_large_image",
  },
  verification: {
    google: "TAJbbrSOBkPiYtRjsUvwJGfAu6jxBWLRKNYRa1gbFUw",
    other: {
      "msvalidate.01": "D1E15D8B592AC304020FB04CA7CE20F4",
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable} ${anton.variable} ${edunline.variable}`}>
      <head>
        <script async src="https://plausible.io/js/pa-MN5ajAMFjoUl7-CmL25FQ.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <SessionProvider>
          <SettingsProvider>
            <ScrollRestoration />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <CookieConsent />
          </SettingsProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
