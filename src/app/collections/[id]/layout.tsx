import type { Metadata } from "next"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  try {
    const res = await fetch(`${baseUrl}/api/collections?id=${id}`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      const collection = data?.collection
      if (collection?.title && collection?.description) {
        return {
          title: `${collection.title} — Sélection famille`,
          description: collection.description,
          alternates: { canonical: `/collections/${id}` },
          openGraph: {
            title: `${collection.title} | Totem Avisé`,
            description: collection.description,
            images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
          },
        }
      }
    }
  } catch {
    // Fallback below
  }

  return {
    title: "Collection — Sélection famille",
    description: "Une sélection thématique de films, séries et jeux analysés pour les familles.",
    alternates: { canonical: `/collections/${id}` },
  }
}

export default function CollectionDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
