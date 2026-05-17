import { Fraunces } from "next/font/google"

// Critical-path font: the homepage hero H1 uses `font-serif` (→ Fraunces)
// and is the LCP element. PageSpeed flagged a 2.5s element-render-delay
// on it — the dominant factor is the wait for Fraunces to finish loading
// while too many variants compete for bandwidth on the critical path.
//
// Trim aggressively to what's actually used on the homepage:
//   • 400 / 500 normal — body + most headings
//   • 600 normal       — <strong> inside serif headings
//   • 400 / 500 italic — hero's "bons contenus", "votre famille"
//
// Weight 700 + italic 600/700 are dropped (audit: no usages). `preload`
// is left at its default (true) which makes next/font emit
// <link rel="preload"> for the resolved CSS automatically.
export const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  preload: true,
  // next/font auto-generates a size-adjusted fallback to match Fraunces'
  // metrics — keeping this on (default true) prevents the layout shift /
  // re-paint that would otherwise force the LCP candidate to wait.
  adjustFontFallback: true,
  variable: "--font-fraunces",
})
