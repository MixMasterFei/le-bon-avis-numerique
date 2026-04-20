import { Clock, Monitor, Gamepad2, MessageCircle, Shield, Brain, ArrowRight } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  title: "Nos guides — Accompagner vos enfants face aux écrans",
  description:
    "Guides pratiques pour accompagner vos enfants dans leur consommation médiatique : temps d'écran, classifications, jeux vidéo et plus.",
}

const guides = [
  {
    title: "Temps d'écran par âge : repères et conseils",
    description:
      "Combien de temps devant un écran selon l'âge ? Les recommandations de l'OMS et du CSA, et nos conseils pratiques pour chaque tranche d'âge.",
    icon: Monitor,
    available: true,
    slug: "temps-ecran",
    content: [
      { age: "Moins de 3 ans", rec: "Pas d'écran (ou exceptionnel, accompagné)", detail: "L'OMS et les pédiatres recommandent d'éviter les écrans avant 3 ans. Les interactions réelles sont essentielles au développement." },
      { age: "3-6 ans", rec: "Maximum 30 min/jour, accompagné", detail: "Privilégiez des contenus courts, adaptés, et regardez-les ensemble. Pas d'écran pendant les repas ni avant le coucher." },
      { age: "6-10 ans", rec: "Maximum 1h/jour", detail: "Diversifiez les activités. Encouragez la lecture, le jeu libre et les activités physiques. Restez présent pour discuter de ce qu'ils voient." },
      { age: "10-14 ans", rec: "1 à 2h/jour", detail: "C'est l'âge où les réseaux sociaux deviennent un sujet. Établissez des règles claires et maintenez le dialogue." },
      { age: "14+ ans", rec: "Cadre négocié en famille", detail: "Accompagnez vers l'autonomie. L'important est de maintenir des temps sans écran (repas, nuit) et un dialogue ouvert." },
    ],
  },
  {
    title: "Comprendre les classifications d'âge",
    description:
      "PEGI, CSA, CNC... Que signifient ces classifications ? Leurs limites et comment notre système les complète.",
    icon: Shield,
    available: true,
    slug: "classifications",
    content: [
      { age: "CSA (Films & TV)", rec: "Tous publics, -10, -12, -16, -18", detail: "Le Conseil Supérieur de l'Audiovisuel attribue ces classifications basées sur le contenu violent, sexuel ou choquant. Mais elles ne détaillent pas les raisons." },
      { age: "PEGI (Jeux vidéo)", rec: "PEGI 3, 7, 12, 16, 18", detail: "Le système européen de classification des jeux. Les pictogrammes (violence, peur, langage...) complètent l'âge mais restent généraux." },
      { age: "Notre approche", rec: "7 critères détaillés", detail: "Nous allons plus loin : violence, sexe/nudité, langage, consommérisme, substances, mais aussi messages positifs et modèles. Chaque famille peut évaluer selon ses propres valeurs." },
    ],
  },
  {
    title: "Choisir un jeu vidéo adapté",
    description:
      "Au-delà du PEGI : comment évaluer si un jeu vidéo convient à votre enfant, repérer les microtransactions et le contenu addictif.",
    icon: Gamepad2,
    available: true,
    slug: "jeux-video",
    content: [
      { age: "Vérifiez au-delà du PEGI", rec: "PEGI ne couvre pas tout", detail: "Le PEGI ne prend pas en compte les achats intégrés, le chat en ligne non modéré, ou les mécaniques addictives (loot boxes, battle pass)." },
      { age: "Achats intégrés", rec: "Attention aux microtransactions", detail: "De nombreux jeux 'gratuits' reposent sur des achats. Désactivez les achats in-app et discutez de la valeur de l'argent avec vos enfants." },
      { age: "Jeu en ligne", rec: "Supervisez les interactions", detail: "Les jeux multijoueurs exposent les enfants à des inconnus. Vérifiez les paramètres de confidentialité et les options de chat." },
      { age: "Temps de jeu", rec: "Fixez des limites claires", detail: "Utilisez les contrôles parentaux intégrés aux consoles et PC. Définissez des plages horaires de jeu en famille." },
    ],
  },
  {
    title: "Parler des écrans avec vos enfants",
    description:
      "Comment aborder le sujet des écrans sans conflit, instaurer des règles familiales et maintenir un dialogue constructif.",
    icon: MessageCircle,
    available: false,
    slug: "dialogue-ecrans",
    content: [],
  },
  {
    title: "Développer l'esprit critique face aux médias",
    description:
      "Apprendre à vos enfants à questionner ce qu'ils voient en ligne : publicité, désinformation, images retouchées.",
    icon: Brain,
    available: false,
    slug: "esprit-critique",
    content: [],
  },
]

function buildFaqJsonLd() {
  const questions = guides
    .filter((g) => g.available && g.content.length > 0)
    .flatMap((guide) =>
      guide.content.map((item) => ({
        "@type": "Question" as const,
        name: `${item.age} : ${item.rec}`,
        acceptedAnswer: {
          "@type": "Answer" as const,
          text: item.detail,
        },
      }))
    )
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions,
  }
}

export default function GuidesPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const faqJsonLd = buildFaqJsonLd()

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section
        className="py-16 md:py-20"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div
            className="text-[11px] font-semibold mb-3 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Ressources
          </div>
          <h1
            className={`${serifClass} text-4xl md:text-5xl font-medium mb-5 leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Nos{" "}
            <em className="italic" style={{ color: p.accent }}>
              guides
            </em>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: p.ink2 }}>
            Des guides pratiques pour accompagner vos enfants dans leur
            consommation médiatique, à chaque âge.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl space-y-6">
          {guides.map((guide) => (
            <div
              key={guide.slug}
              id={guide.slug}
              className="scroll-mt-24 rounded-3xl p-6 lg:p-8"
              style={{
                background: p.card,
                border: `1px solid ${p.line}`,
                opacity: guide.available ? 1 : 0.75,
              }}
            >
              <div className="flex items-start gap-4 mb-5">
                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full flex-shrink-0"
                  style={{ background: p.bg2, color: p.accent }}
                >
                  <guide.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2
                      className={`${serifClass} text-lg md:text-xl font-medium`}
                      style={{ color: p.ink, letterSpacing: "-0.02em" }}
                    >
                      {guide.title}
                    </h2>
                    {!guide.available && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full"
                        style={{ background: p.bg2, color: p.ink2 }}
                      >
                        <Clock className="h-3 w-3" />
                        Bientôt
                      </span>
                    )}
                  </div>
                  <p className="text-sm md:text-base" style={{ color: p.ink2 }}>
                    {guide.description}
                  </p>
                </div>
              </div>

              {guide.available && guide.content.length > 0 && (
                <div className="space-y-3 mt-5">
                  {guide.content.map((item) => (
                    <div
                      key={item.age}
                      className="rounded-xl p-4"
                      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
                    >
                      <div className="flex items-baseline justify-between mb-1.5 gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm" style={{ color: p.ink }}>
                          {item.age}
                        </h3>
                        <span
                          className="text-sm font-medium"
                          style={{ color: p.accent }}
                        >
                          {item.rec}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: p.ink2 }}>
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!guide.available && (
                <div
                  className="mt-4 p-4 rounded-xl text-center"
                  style={{ background: p.bg2 }}
                >
                  <p className="text-sm" style={{ color: p.ink2 }}>
                    Ce guide est en cours de rédaction. Revenez bientôt !
                  </p>
                </div>
              )}
            </div>
          ))}

          <div
            className="rounded-3xl p-8 text-center"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <h2
              className={`${serifClass} text-2xl md:text-3xl font-medium mb-3`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Besoin d&apos;un avis{" "}
              <em className="italic" style={{ color: p.accent }}>
                précis
              </em>{" "}
              ?
            </h2>
            <p className="mb-6 max-w-lg mx-auto text-sm md:text-base" style={{ color: p.ink2 }}>
              Consultez nos analyses détaillées pour trouver le film, la série
              ou le jeu idéal pour votre famille.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/films"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: p.ink, color: p.bg }}
              >
                Explorer les contenus
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/notre-methode"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "transparent",
                  color: p.ink,
                  border: `1px solid ${p.line2}`,
                }}
              >
                Notre méthode
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
