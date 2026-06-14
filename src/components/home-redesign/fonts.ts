import { Bricolage_Grotesque, Newsreader, Hanken_Grotesk } from "next/font/google"

/**
 * Fonts for the admin-only V2 homepage. Imported only by HomepageRedesign
 * (which is `next/dynamic`-loaded for admins in page.tsx), so these never
 * ship to anonymous visitors. Applied to the V2 wrapper div, not <html>,
 * so they're scoped to the redesign subtree.
 */
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
})

export const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
  variable: "--font-newsreader",
  display: "swap",
})

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken",
  display: "swap",
})

export const v2FontVars = `${bricolage.variable} ${newsreader.variable} ${hanken.variable}`
