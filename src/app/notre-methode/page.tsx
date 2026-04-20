import { ShieldAlert, Users, Award, Star, ThumbsUp, BookOpen } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  title: "Notre méthode | Totem Avisé",
  description:
    "Comment Totem Avisé évalue les contenus, attribue les badges et calcule la compatibilité familiale.",
}

const sections = [
  {
    id: "age",
    icon: Award,
    title: "Nos recommandations d'âge",
    content: [
      "Chaque contenu sur Totem Avisé porte une recommandation d'âge indépendante de la classification officielle (CNC/CSA). La classification légale donne un âge minimum d'accès en salle. Nous, on regarde l'expérience dans son ensemble : est-ce que ce film risque de faire peur ? Est-ce que les thèmes abordés sont compréhensibles à cet âge ?",
      "On s'appuie sur 7 critères : violence, contenu sexuel, langage, substances, messages positifs, modèles positifs et valeur éducative. Chaque critère est évalué sur une échelle de 0 à 5.",
      "Quand les données du CNC sont disponibles, on les affiche en complément. Sur chaque fiche, vous voyez les deux côte à côte : la classification officielle et notre recommandation.",
    ],
  },
  {
    id: "badges",
    icon: Star,
    title: "Les badges",
    content: [
      "Les badges apparaissent sur les fiches et les cartes pour repérer rapidement les qualités d'un contenu :",
    ],
    list: [
      { label: "Éducatif", desc: "Le contenu a un fort potentiel éducatif (score de 5/5 en valeur éducative)." },
      { label: "Modèles+", desc: "Le contenu met en avant des modèles positifs (score de 5/5)." },
      { label: "Âge (ex : 8+)", desc: "Âge minimum recommandé par nos experts." },
      { label: "Classif. officielle", desc: "La classification CNC/CSA quand elle est disponible." },
    ],
  },
  {
    id: "famille",
    icon: Users,
    title: "Adapté à ma famille",
    content: [
      "Quand vous créez un profil famille, Totem Avisé calcule un score de compatibilité pour chaque membre. Ce score croise plusieurs facteurs :",
    ],
    list: [
      { label: "Âge", desc: "L'âge du membre par rapport à la recommandation d'âge du contenu. C'est le facteur qui pèse le plus." },
      { label: "Sensibilités", desc: "On compare les niveaux de contenu sensible (violence, peur, langage…) avec ce que chaque membre tolère." },
      { label: "Genres préférés", desc: "Correspondance entre les genres du contenu et les favoris du membre." },
      { label: "Centres d'intérêt", desc: "Les thèmes et sujets du contenu par rapport aux centres d'intérêt du membre." },
      { label: "Affinités", desc: "Si le membre a aimé des contenus similaires, ça joue en faveur." },
      { label: "Ambiance", desc: "Le ton et le rythme du contenu par rapport à l'âge et la sensibilité du membre." },
      { label: "Contenu positif", desc: "Correspondance avec les préférences en messages positifs, modèles inspirants et contenu éducatif." },
      { label: "Sujets à éviter", desc: "On vérifie que le contenu ne contient pas de sujets que le membre souhaite éviter." },
    ],
    after: "Les avatars des membres compatibles apparaissent directement sur les cartes, pour voir d'un coup d'œil à qui chaque contenu convient.",
  },
  {
    id: "warning",
    icon: ShieldAlert,
    title: "Attention famille",
    content: [
      "Le badge « Attention famille » signale les contenus qui méritent une vigilance particulière pour les foyers avec enfants. Il se déclenche dans deux cas :",
    ],
    list: [
      { label: "Détection automatique", desc: "Le contenu est recommandé à partir de 15 ans ET contient des éléments de genre (horreur, crime, thriller), de violence élevée, ou une ambiance sombre et intense." },
      { label: "Signalement communautaire*", desc: "Au moins 10 parents ont signalé ce contenu comme sensible pour les familles. L'astérisque (*) distingue ce signalement du signal automatique." },
    ],
    after: "Ce badge ne veut pas dire que le contenu est « mauvais ». Il indique qu'il vaut mieux y jeter un œil avant de le regarder en famille.",
  },
  {
    id: "votes",
    icon: ThumbsUp,
    title: "Les votes communautaires",
    content: [
      "Totem Avisé s'améliore grâce aux retours des parents. Vous pouvez contribuer de plusieurs façons :",
    ],
    list: [
      { label: "Vote sur l'âge", desc: "Confirmez ou contestez la recommandation d'âge avec un pouce en haut ou en bas. À partir de 5 votes et 70 % d'accord, un badge de consensus apparaît." },
      { label: "Signalement famille", desc: "Si vous estimez qu'un contenu mérite un avertissement familial, vous pouvez le signaler depuis la fiche. Seuls les utilisateurs avec un profil famille peuvent voter." },
      { label: "Réactions par membre", desc: "Enregistrez les réactions de chaque membre (adoré, aimé, ennuyeux, trop jeune…). Ces réactions alimentent les recommandations." },
    ],
  },
  {
    id: "sources",
    icon: BookOpen,
    title: "Nos sources",
    content: [
      "Nos données viennent de plusieurs sources complémentaires :",
    ],
    list: [
      { label: "Bases de données internationales", desc: "Informations générales (synopsis, genres, dates, équipes techniques) issues de bases collaboratives." },
      { label: "CNC / data.gouv.fr", desc: "Classifications officielles des films en France, importées depuis les données publiques du CNC." },
      { label: "Analyse de contenu", desc: "Évaluation des 7 critères par notre système d'analyse, affinée par les retours de la communauté." },
      { label: "Communauté", desc: "Avis, votes d'âge et signalements des parents utilisateurs." },
    ],
    after: "Nos recommandations sont indépendantes. On n'est affilié à aucun studio, distributeur ou plateforme de streaming.",
  },
]

export default function NotreMethodePage() {
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
            Méthode
          </div>
          <h1
            className={`${serifClass} text-4xl md:text-5xl font-medium mb-5 leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Notre{" "}
            <em className="italic" style={{ color: p.accent }}>
              méthode
            </em>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: p.ink2 }}>
            Comment on évalue les contenus, attribue les badges et calcule la
            compatibilité avec votre famille.
          </p>
        </div>
      </section>

      <section
        className="py-6"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-wrap justify-center gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
                style={{
                  background: p.bg2,
                  color: p.ink,
                  border: `1px solid ${p.line}`,
                }}
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl space-y-6">
          {sections.map((section) => (
            <div
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-3xl p-7 md:p-9"
              style={{
                background: p.card,
                border: `1px solid ${p.line}`,
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full"
                  style={{ background: p.bg2, color: p.accent }}
                >
                  <section.icon className="h-5 w-5" />
                </div>
                <h2
                  className={`${serifClass} text-xl md:text-2xl font-medium`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  {section.title}
                </h2>
              </div>

              <div className="space-y-4 leading-relaxed text-sm md:text-base" style={{ color: p.ink2 }}>
                {section.content.map((par, i) => (
                  <p key={i}>{par}</p>
                ))}

                {section.list && (
                  <ul className="space-y-2.5 mt-3">
                    {section.list.map((item) => (
                      <li key={item.label} className="flex gap-3">
                        <span
                          className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full"
                          style={{ background: p.accent }}
                        />
                        <div>
                          <span
                            className="font-semibold"
                            style={{ color: p.ink }}
                          >
                            {item.label}
                          </span>
                          <span> — {item.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {section.after && <p className="mt-4">{section.after}</p>}
              </div>
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
              Une{" "}
              <em className="italic" style={{ color: p.accent }}>
                question
              </em>{" "}
              ?
            </h2>
            <p className="mb-6 max-w-lg mx-auto text-sm md:text-base" style={{ color: p.ink2 }}>
              Notre méthode évolue grâce aux retours des familles. Écrivez-nous,
              on lit tout.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: p.ink, color: p.bg }}
              >
                Nous écrire
              </Link>
              <Link
                href="/a-propos"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "transparent",
                  color: p.ink,
                  border: `1px solid ${p.line2}`,
                }}
              >
                À propos
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
