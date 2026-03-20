import type { Metadata } from "next"

const ageRangeMeta: Record<string, { label: string; description: string }> = {
  "2-4": {
    label: "2-4 ans",
    description: "Films, séries et jeux pour les tout-petits (2-4 ans) : histoires simples, colorées et adaptées aux plus jeunes.",
  },
  "5-7": {
    label: "5-7 ans",
    description: "Films, séries et jeux pour les 5-7 ans : aventures, amitié et découverte dans un cadre adapté aux jeunes enfants.",
  },
  "8-10": {
    label: "8-10 ans",
    description: "Films, séries et jeux pour les 8-10 ans : histoires plus complexes avec des héros attachants et des défis à surmonter.",
  },
  "11-12": {
    label: "11-12 ans",
    description: "Films, séries et jeux pour les pré-ados (11-12 ans) : thèmes plus matures et nuancés, analysés pour les familles.",
  },
  "13-15": {
    label: "13-15 ans",
    description: "Films, séries et jeux pour les ados (13-15 ans) : sujets complexes adaptés à leur âge, avec analyse détaillée.",
  },
  "16-plus": {
    label: "16+ ans",
    description: "Films, séries et jeux pour les grands ados et jeunes adultes (16+), avec des analyses détaillées pour les familles.",
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ range: string }>
}): Promise<Metadata> {
  const { range } = await params
  const meta = ageRangeMeta[range]

  if (!meta) {
    return { title: "Contenus par âge" }
  }

  return {
    title: `Contenus pour les ${meta.label} — Recommandations famille`,
    description: meta.description,
    alternates: { canonical: `/age/${range}` },
    openGraph: {
      title: `Contenus pour les ${meta.label} | Totem Avisé`,
      description: meta.description,
      images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
    },
  }
}

export default function AgeRangeLayout({ children }: { children: React.ReactNode }) {
  return children
}
