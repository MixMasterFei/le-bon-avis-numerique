import type { Metadata } from "next"
import { Inter, Poppins } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { SiteFooter } from "@/components/layout/SiteFooter"
import { CookieConsent } from "@/components/CookieConsent"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { SettingsProvider } from "@/contexts/SettingsContext"
import { ScrollRestoration } from "@/components/providers/ScrollRestoration"
import { Analytics } from "@vercel/analytics/react"
import { fraunces } from "@/components/home-v2/apercuFont"

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
    default: "Totem Avisé — Films, Séries TV et Jeux Vidéo en famille",
    template: "%s | Totem Avisé",
  },
  description: "Trouvez les films, séries et jeux parfaits pour votre famille. Recommandations par âge, goûts et sensibilités. Gratuit.",
  alternates: {
    canonical: "/",
  },
  keywords: ["recommandation film famille", "film pour enfant", "série netflix enfant", "jeux vidéo famille", "quoi regarder en famille", "recommandation par âge", "Totem Avisé", "totemavise"],
  authors: [{ name: "Totem Avisé" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32" },
      { url: "/icon.png", sizes: "620x606", type: "image/png" },
    ],
    apple: { url: "/icon.png", sizes: "620x606", type: "image/png" },
  },
  openGraph: {
    title: "Totem Avisé",
    description: "Trouvez les films, séries et jeux parfaits pour votre famille",
    locale: "fr_FR",
    type: "website",
    siteName: "Totem Avisé",
    images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
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
    <html
      lang="fr"
      className={`${inter.variable} ${poppins.variable} ${anton.variable} ${edunline.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Theme resolution — runs before first paint to prevent FOUC.
           Reads localStorage.theme first, then falls back to system
           preference. Inline so it executes synchronously. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Totem Avisé",
              url: "https://totemavise.com",
              logo: "https://totemavise.com/icon.png",
              description: "Moteur de recommandation de films, séries et jeux pour les familles françaises. Recommandations personnalisées par âge, goûts et sensibilités.",
              sameAs: [
                "https://www.instagram.com/totemavise",
                "https://www.tiktok.com/@totemavise",
                "https://www.facebook.com/totemavise",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                email: "contact@totemavise.com",
                contactType: "customer service",
                availableLanguage: "French",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Totem Avisé",
              alternateName: "Totem Avise",
              url: "https://totemavise.com",
              inLanguage: "fr-FR",
              description: "Recommandations de films, séries, jeux et livres pour les familles françaises.",
              publisher: { "@type": "Organization", name: "Totem Avisé" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://totemavise.com/recherche?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
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
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <CookieConsent />
          </SettingsProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
