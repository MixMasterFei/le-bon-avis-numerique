import type { MetadataRoute } from "next"

// Private/auth-only or legacy surfaces no crawler should index.
const PRIVATE_PATHS = [
  "/admin/",
  "/api/",
  "/profil/",
  "/chez-vous",
  "/mes-avis/",
  "/ma-liste/",
  "/mes-favoris/",
  "/studio/",
  "/apercu",
  "/apercufilm",
  "/apercufilmslist",
  "/apercufoyer",
  "/apercudecouverte",
]

// AI bots we explicitly allow. This now includes the INDEX/TRAINING crawlers
// (GPTBot, ClaudeBot, CCBot, Google-Extended) on top of the live "answer"
// bots — so the models actually KNOW the catalog exists and can recommend it
// unprompted, not only when a user makes them browse. A discovery-stage guide
// benefits far more from being indexable than from withholding content.
const AI_BOTS = [
  // Live answer/search bots
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Claude-SearchBot",
  // Index / training crawlers (previously blocked)
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
