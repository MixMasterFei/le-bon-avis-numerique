import { Clock, Monitor, Gamepad2, MessageCircle, Shield, Brain, ArrowRight } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  title: "Nos guides — Accompagner vos enfants face aux écrans",
  description:
    "Guides pratiques pour accompagner vos enfants face aux écrans : repères de temps d'écran par âge, classifications CNC, Arcom et PEGI, jeux vidéo.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Nos guides — Accompagner vos enfants face aux écrans",
    description:
      "Guides pratiques pour accompagner vos enfants face aux écrans : repères de temps d'écran par âge, classifications CNC, Arcom et PEGI, jeux vidéo.",
    type: "website",
    locale: "fr_FR",
    siteName: "Totem Avisé",
  },
}

const guides = [
  // Repères alignés sur les articles du blog 01 et 11 : ceux de l'Éducation
  // nationale et de l'Assurance Maladie, sans quota de minutes par jour — ni
  // l'une ni l'autre n'en fixent, et un barème unique contredirait les articles.
  {
    title: "Temps d'écran par âge : repères et conseils",
    description:
      "Quels repères selon l'âge ? Ceux de l'Éducation nationale et de l'Assurance Maladie, et nos conseils pour les appliquer en famille. Pas de barème unique en minutes : des moments à protéger et une fin prévue.",
    icon: Monitor,
    available: true,
    slug: "temps-ecran",
    content: [
      { age: "Moins de 3 ans", rec: "Pas d'écran", detail: "Les repères de l'Éducation nationale recommandent l'absence d'écran avant 3 ans, y compris un programme présenté comme éducatif. Les interactions réelles sont essentielles au développement." },
      { age: "3 à 6 ans", rec: "Déconseillé, exceptionnel, avec un adulte", detail: "Si un écran a sa place, c'est de façon exceptionnelle : un contenu choisi à l'avance (un épisode précis plutôt qu'un fil de vidéos), regardé ensemble, avec une fin prévue. Pas d'écran pendant les repas ni au moment du coucher." },
      { age: "À partir de 6 ans", rec: "Des moments sans écran, une fin décidée avant", detail: "Pas d'écran de loisir le matin avant l'école, pendant les repas, dans la chambre ni au coucher ; l'Assurance Maladie conseille d'arrêter idéalement une à deux heures avant de dormir. Décidez du contenu et de la fin avant de commencer, et évitez d'en faire une récompense systématique." },
      { age: "Préados et ados", rec: "Une autonomie progressive", detail: "Gérer un épisode ne veut pas dire choisir seul ses vidéos, ses contacts ou ses achats. Préparez ensemble les comptes, les réglages et le premier téléphone, gardez les repas et le sommeil sans écran, et revoyez les règles au fil de l'âge." },
    ],
  },
  {
    title: "Comprendre les classifications d'âge",
    description:
      "CNC, Arcom, PEGI : qui classe quoi ? Ce que ces repères disent, leurs limites et comment notre système les complète.",
    icon: Shield,
    available: true,
    slug: "classifications",
    content: [
      { age: "Cinéma (CNC)", rec: "Tous publics, -12, -16, -18", detail: "La classification des films en salle relève du CNC : sa commission de classification examine chaque film, et un avertissement peut compléter sa décision. Une interdiction aux moins de 12, 16 ou 18 ans s'applique à l'entrée de la salle, même accompagné. « Tous publics » n'est pas une recommandation pour chaque âge." },
      { age: "Télévision (Arcom)", rec: "Tous publics, -10, -12, -16, -18", detail: "À la télévision, la signalétique jeunesse est encadrée par l'Arcom, qui a remplacé le CSA en 2022 : les chaînes classent leurs programmes selon ses règles, et l'Arcom en contrôle l'application. Un même film peut porter une catégorie différente à la télévision et au cinéma. Sur les plateformes, vérifiez quel système de classement est affiché." },
      { age: "PEGI (Jeux vidéo)", rec: "PEGI 3, 7, 12, 16, 18", detail: "Le système européen de classification des jeux. Les pictogrammes (violence, peur, langage...) complètent l'âge mais restent généraux, et PEGI ne dit rien de la difficulté, de la lecture nécessaire ou du rythme du jeu." },
      { age: "Notre approche", rec: "8 dimensions détaillées", detail: "Nous allons plus loin : violence, sexe/nudité, langage, consommérisme, substances, mais aussi messages positifs, modèles et valeur éducative. Chaque famille peut évaluer selon ses propres valeurs." },
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
      { age: "Vérifiez au-delà du PEGI", rec: "PEGI ne couvre pas tout", detail: "Un pictogramme PEGI signale les achats intégrés, mais l'âge indiqué ne tient compte ni des dépenses, ni des échanges en ligne avec d'autres joueurs, ni des mécaniques qui poussent à rejouer (coffres aléatoires, passe de combat)." },
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

export default function GuidesPage() {
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
          <div
            className="mt-6 rounded-2xl p-4 text-left"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wide mb-1"
              style={{ color: p.accent }}
            >
              Réponse rapide
            </p>
            <p className="text-sm md:text-base leading-relaxed" style={{ color: p.ink2 }}>
              Pour accompagner un enfant face aux écrans, commencez par l&apos;âge,
              puis regardez le contexte : durée, type de contenu, violence,
              interactions en ligne, achats intégrés et sensibilité de l&apos;enfant.
              Les guides ci-dessous donnent des repères pratiques sans remplacer
              votre décision de parent.
            </p>
          </div>
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
              <div className="flex items-start gap-3 sm:gap-4 mb-5">
                <div
                  className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full flex-shrink-0"
                  style={{ background: p.bg2, color: p.accent }}
                >
                  <guide.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2
                      className={`${serifClass} text-base sm:text-lg md:text-xl font-medium`}
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
                  <p className="text-xs sm:text-sm md:text-base" style={{ color: p.ink2 }}>
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
