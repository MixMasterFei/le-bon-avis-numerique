import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://lebonavisnumerique.com"

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/profil/", "/mes-avis/", "/ma-liste/", "/mes-favoris/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
