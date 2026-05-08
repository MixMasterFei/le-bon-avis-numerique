import { ShieldAlert, Users, Award, Star, ThumbsUp, BookOpen, Sparkles } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  // Lengthened from "Notre méthode | Totem Avisé" (28 chars, below 30
  // recommended) to clarify what the page covers in search results.
  title: "Notre méthode d'évaluation des contenus | Totem Avisé",
  // Lengthened from 96 to 144 chars (target 120+) so Google has more
  // signal for the page topic in SERPs.
  description:
    "Comment Totem Avisé évalue les films, séries et jeux pour les familles : analyse en 8 dimensions, recommandations d'âge, compatibilité familiale.",
  // Override the root layout's canonical "/" so this page isn't
  // merged with the homepage in Google's index.
  alternates: { canonical: "/notre-methode" },
}

const sections = [
  {
    id: "analyse-automatisee",
    icon: Sparkles,
    title: "Comment on analyse — en toute honnêteté",
    content: [
      "On préfère vous le dire clairement : nos recommandations d'âge, nos métriques de contenu, les points clés pour les parents et les thèmes détectés sont générés par une analyse automatisée du contenu. On croise les synopsis, les classifications officielles (CNC/CSA, PEGI), les genres et les données publiques pour produire une première estimation sur 8 dimensions.",
      "Cette estimation n'est pas un verdict d'expert. C'est un point de départ, qui s'affine avec le temps grâce aux votes et réactions des foyers inscrits. Quand au moins 5 parents ont voté et que 70 % sont d'accord, un badge de consensus apparaît — vos retours remplacent progressivement l'analyse automatisée.",
      "On ne promet pas une recommandation magique. On dit « en calibrage » parce que c'est ce qui se passe : vous aidez à régler le cadran, pas à valider un résultat figé.",
    ],
    list: [
      { label: "Recommandation d'âge", desc: "Estimée automatiquement à partir du synopsis + classifications officielles. Ajustée par vos votes « j'approuve / je conteste »." },
      { label: "Métriques de contenu", desc: "Les 8 dimensions (violence, sexe, langage, substances, consumérisme, messages positifs, modèles positifs, valeur éducative) sont estimées automatiquement. Les scores évaluables par les parents sont ensuite recalibrés par la communauté." },
      { label: "Points clés pour les parents", desc: "Extraits automatiquement du contenu analysé. Indicatifs — à recouper avec la fiche complète et les avis." },
      { label: "Thèmes détectés", desc: "Les tags thématiques sont détectés automatiquement. Ils peuvent être affinés par les signalements de la communauté." },
    ],
    after: "Pour chaque surface concernée, une petite pastille « Analyse automatisée · en calibrage » est visible sur les fiches. Elle vous rappelle la nature de l'estimation et vous invite à contribuer.",
  },
  {
    id: "recommandations-age",
    icon: Award,
    title: "D'où viennent nos recommandations d'âge",
    content: [
      "Chaque contenu sur Totem Avisé porte une recommandation d'âge indépendante de la classification officielle (CNC/CSA). La classification légale donne un âge minimum d'accès en salle. Nous, on regarde l'expérience dans son ensemble : est-ce que ce film risque de faire peur ? Est-ce que les thèmes abordés sont compréhensibles à cet âge ?",
      "La recommandation initiale est générée par analyse automatisée (voir « Comment on analyse » ci-dessus). Elle est ensuite calibrée par les votes des foyers inscrits. Sur chaque fiche vous trouverez les pouces en haut / en bas : c'est le levier pour contester ou confirmer.",
      "Quand les données du CNC sont disponibles, on les affiche en complément. Sur chaque fiche, vous voyez les deux côte à côte : la classification officielle et notre recommandation.",
    ],
  },
  {
    id: "metriques-contenu",
    icon: BookOpen,
    title: "Les métriques de contenu (0–5)",
    content: [
      "Chaque contenu est noté sur 8 dimensions, une échelle de 0 à 5. Violence, sexe et nudité, langage, substances, consumérisme pour les éléments sensibles ; messages positifs, modèles positifs et valeur éducative pour les apports positifs.",
      "Comme les recommandations d'âge, ces scores démarrent en analyse automatisée. Les dimensions évaluables par les parents sont ensuite recalibrées par les familles qui notent elles-mêmes le contenu. Vous pouvez proposer vos propres scores depuis la fiche via « Évaluer ce contenu » — quand assez de parents contribuent, les scores communautaires remplacent progressivement les estimations initiales.",
    ],
  },
  {
    id: "points-cles",
    icon: BookOpen,
    title: "Les points clés pour les parents",
    content: [
      "Le bloc « Ce que les parents doivent savoir » résume, en 3 à 5 points, les éléments du contenu qui méritent une attention particulière : scène impressionnante, thématique complexe, scène d'amour explicite, langage cru, etc.",
      "Ces points sont extraits automatiquement par analyse du contenu. Ils sont indicatifs et ne remplacent pas votre propre lecture de la fiche ni les avis des autres parents. Si un point manque ou semble incorrect, vous pouvez le signaler depuis la fiche.",
    ],
  },
  {
    id: "themes-detectes",
    icon: BookOpen,
    title: "Les thèmes détectés",
    content: [
      "Les tags thématiques (amitié, deuil, voyage, écologie, etc.) sont détectés automatiquement à partir du synopsis, des genres et des classifications. Ils servent à connecter des œuvres similaires et à alimenter le moteur de recommandation personnalisée.",
      "Comme les autres signaux automatisés, ils peuvent être affinés par les signalements de la communauté. Si un thème central est absent ou si un thème listé ne correspond pas, vous pouvez nous le signaler.",
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
      { label: "Âge (ex : 8+)", desc: "Âge minimum recommandé par l'analyse Totem Avisé, puis calibré par les retours des parents." },
      { label: "Classif. officielle", desc: "La classification CNC/CSA quand elle est disponible." },
    ],
  },
  {
    id: "famille",
    icon: Users,
    title: "Adapté à ma famille",
    content: [
      "Quand vous créez un profil famille, Totem Avisé calcule un repère de compatibilité pour chaque membre. Le calcul reste interne : côté parent, on affiche des niveaux simples comme « Très adapté », « Bon choix » ou « À vérifier ». Ce repère croise plusieurs facteurs :",
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
    after: "Les avatars des membres concernés apparaissent directement sur les cartes, avec une couleur de repère, pour voir d'un coup d'œil à qui le contenu semble convenir ou mérite une vérification.",
  },
  {
    id: "warning",
    icon: ShieldAlert,
    title: "Attention famille",
    content: [
      "Le badge « Attention famille » signale les contenus qui méritent une vigilance particulière pour les foyers avec enfants. Il se déclenche dans deux cas :",
    ],
    list: [
      { label: "Détection automatique", desc: "Le contenu présente des signaux sensibles pour un foyer avec enfants : genre horreur/crime/thriller, violence ou sexualité élevée, ambiance sombre ou intense, ou combinaison âge recommandé + métriques sensibles." },
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
      { label: "Analyse de contenu", desc: "Évaluation des 8 dimensions par notre système d'analyse, affinée par les retours de la communauté." },
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
