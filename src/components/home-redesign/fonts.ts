import { Bricolage_Grotesque, Newsreader, Hanken_Grotesk } from "next/font/google"

/**
 * The V2 font system (Bricolage headings, Newsreader italic accents, Hanken
 * body). Imported by the root layout, which attaches `v2FontVars` to <html>
 * ONLY when the viewer qualifies for V2 (admin, or HOMEPAGE_V2_PUBLIC=true) —
 * see @/lib/v2-flag. The webfonts are only fetched when something references
 * them, so public visitors (no attribute, no remap in globals.css) never load
 * them. Also imported by HomepageRedesign for the redesign subtree.
 */
// All three are VARIABLE fonts — loading them without a pinned `weight` array
// fetches a single variable woff2 per family covering the whole weight range
// (smaller than the 4 static instances we used to ship, and it includes the
// 900 the site's <h1> base style asks for). display:swap keeps text visible.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
})

export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  variable: "--font-newsreader",
  display: "swap",
  // Accent only (italic emphasis words). Keep it off the critical preload path
  // so the body/heading fonts aren't competing with it for LCP bandwidth.
  preload: false,
})

export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
})

export const v2FontVars = `${bricolage.variable} ${newsreader.variable} ${hanken.variable}`
