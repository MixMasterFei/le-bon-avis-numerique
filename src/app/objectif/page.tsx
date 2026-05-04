import { Sparkles, Users, Heart, Lightbulb, ArrowRight, Check, Shield } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  // Lengthened from "Notre mission | Totem Avisé" (27 chars) to give
  // Google more topic signal in SERPs.
  title: "Notre mission — guide média famille indépendant | Totem Avisé",
  // Lengthened from ~90 chars to 154 (target 120+) to make the page
  // intent clearer in search results.
  description:
    "Aider chaque famille à trouver les films, séries et jeux qui conviennent vraiment à chaque membre du foyer — recommandations indépendantes, sans publicité.",
  // Override the root layout's canonical "/" so this page isn't
  // merged with the homepage in Google's index.
  alternates: { canonical: "/objectif" },
}

const pillars = [
  {
    icon: Sparkles,
    title: "Adapté à chacun",
    description:
      "Chaque membre de votre famille a son profil. Les suggestions tiennent compte de l'âge, des goûts et de ce que chacun supporte ou pas.",
  },
  {
    icon: Shield,
    title: "Indépendants",
    description:
      "Aucun studio, éditeur ou plateforme ne paie pour apparaître dans nos recommandations. Pas de pub, pas de placement, pas d'affiliation.",
  },
  {
    icon: Users,
    title: "Amélioré par les familles",
    description:
      "Les parents qui utilisent Totem Avisé partagent leurs retours. Ces réactions améliorent les suggestions pour tout le monde.",
  },
  {
    icon: Lightbulb,
    title: "Simple à utiliser",
    description:
      "Filtrez par âge, par genre, par plateforme de streaming ou par thème. Vous cherchez un film d'aventure sur Disney+ ? Deux clics.",
  },
]

const differences = [
  "On analyse 7 aspects du contenu, pas juste un âge minimum",
  "On repère les messages positifs et les modèles inspirants",
  "Chaque famille peut filtrer selon ses propres limites (violence, langage, peur…)",
  "Films, séries, jeux vidéo, livres : tout au même endroit",
]

export default function ObjectifPage() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <section
        className="py-16 md:py-20"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div
            className="text-[11px] font-semibold mb-3 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Notre mission
          </div>
          <h1
            className={`${serifClass} text-4xl md:text-5xl font-medium mb-5 leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Des{" "}
            <em className="italic" style={{ color: p.accent }}>
              recommandations
            </em>{" "}
            qui tiennent compte de votre foyer.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: p.ink2 }}>
            Aider chaque famille à trouver le contenu qui plaît aux enfants et
            rassure les parents.
          </p>
        </div>
      </section>

      <section className="py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-5 mb-14">
            <div
              className="rounded-2xl p-6 lg:p-8"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <h2
                className={`${serifClass} text-xl md:text-2xl font-medium mb-3 flex items-center gap-2`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                <Heart
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: p.accent }}
                />
                Ce qu&apos;on croit
              </h2>
              <p className="leading-relaxed text-sm md:text-base" style={{ color: p.ink2 }}>
                Chaque famille est unique. Un film parfait pour un enfant de 7
                ans ne l&apos;est pas forcément pour un autre du même âge. Les
                goûts, les sensibilités et les valeurs de chaque foyer comptent.
              </p>
            </div>
            <div
              className="rounded-2xl p-6 lg:p-8"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <h2
                className={`${serifClass} text-xl md:text-2xl font-medium mb-3 flex items-center gap-2`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                <Sparkles
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: p.accent2 }}
                />
                Ce qu&apos;on propose
              </h2>
              <p className="leading-relaxed text-sm md:text-base" style={{ color: p.ink2 }}>
                Un outil qui connaît votre famille. Créez un profil pour chaque
                membre, et Totem Avisé vous dit quels films, séries et jeux
                correspondent vraiment.
              </p>
            </div>
          </div>

          <div className="mb-14">
            <h2
              className={`${serifClass} text-2xl md:text-3xl font-medium mb-6 text-center`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Ce qui fait la{" "}
              <em className="italic" style={{ color: p.accent }}>
                différence
              </em>
            </h2>
            <div className="space-y-3 max-w-xl mx-auto">
              {differences.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check
                    className="h-5 w-5 flex-shrink-0 mt-0.5"
                    style={{ color: p.accent2 }}
                  />
                  <p className="text-sm md:text-base" style={{ color: p.ink }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-6 text-center`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Nos piliers
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 md:gap-5 mb-14">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-2xl p-6"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-4"
                  style={{ background: p.bg2, color: p.accent }}
                >
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3
                  className={`${serifClass} text-lg font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: p.ink2 }}>
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-3xl p-8 text-center"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <h2
              className={`${serifClass} text-2xl md:text-3xl font-medium mb-3`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Trouvez votre prochaine{" "}
              <em className="italic" style={{ color: p.accent }}>
                soirée en famille
              </em>
            </h2>
            <p className="mb-6 text-sm md:text-base" style={{ color: p.ink2 }}>
              Des milliers de films, séries et jeux analysés. Filtrés pour
              votre famille.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/films"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: p.ink, color: p.bg }}
              >
                Découvrir les films
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/inscription"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "transparent",
                  color: p.ink,
                  border: `1px solid ${p.line2}`,
                }}
              >
                Créer mon profil famille
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
