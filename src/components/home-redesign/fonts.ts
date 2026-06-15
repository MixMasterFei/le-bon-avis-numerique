import { Bricolage_Grotesque, Newsreader, Hanken_Grotesk } from "next/font/google"

/**
 * The V2 font system (Bricolage headings, Newsreader italic accents, Hanken
 * body). Imported by the root layout, which attaches `v2FontVars` to <html>
 * ONLY when the viewer qualifies for V2 (admin, or HOMEPAGE_V2_PUBLIC=true) —
 * see @/lib/v2-flag. The webfonts are only fetched when something references
 * them, so public visitors (no attribute, no remap in globals.css) never load
 * them. Also imported by HomepageRedesign for the redesign subtree.
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
