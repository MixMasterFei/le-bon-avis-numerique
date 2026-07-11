"use client"

import Link from "next/link"
import { Check, X, Crown, Heart, Users, Sparkles } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

interface PlanFeature {
  text: string
  included: boolean
  highlight?: boolean
}

interface Plan {
  name: string
  description: string
  price: string
  period: string
  highlight: boolean
  badge?: string
  features: PlanFeature[]
  cta: string
  ctaHref: string
  ctaDisabled?: boolean
}

const plans: Plan[] = [
  {
    name: "Gratuit",
    description: "Tout ce dont vous avez besoin pour faire les bons choix",
    price: "0",
    period: "pour toujours",
    highlight: false,
    features: [
      { text: "Tous les avis et évaluations", included: true },
      { text: "Recherche et filtres par âge", included: true },
      { text: "Recommandations par âge", included: true },
      { text: "Classifications françaises (CNC, PEGI)", included: true },
      { text: "Métriques de contenu détaillées", included: true },
      { text: "Accès sur tous vos appareils", included: true },
      { text: "Profils famille multiples", included: false },
      { text: "Recommandations personnalisées avancées", included: false },
      { text: "Personnalisation familiale avancée", included: false },
    ],
    cta: "Créer un compte gratuit",
    ctaHref: "/inscription",
  },
  {
    name: "Premium",
    description: "Pour les familles qui veulent aller plus loin",
    price: "2,99",
    period: "/mois",
    highlight: true,
    badge: "Bientôt disponible",
    features: [
      { text: "Tout du plan Gratuit", included: true },
      { text: "Profils famille multiples", included: true, highlight: true },
      { text: "Recommandations personnalisées avancées", included: true, highlight: true },
      { text: "« Ce soir on regarde » suggestions", included: true, highlight: true },
      { text: "Listes de lecture synchronisées", included: true, highlight: true },
      { text: "Personnalisation familiale avancée", included: true, highlight: true },
      { text: "Accès anticipé aux nouveautés", included: true, highlight: true },
      { text: "Badge Soutien sur votre profil", included: true },
      { text: "Support prioritaire", included: true },
    ],
    cta: "M'avertir du lancement",
    ctaHref: "/inscription?notify=premium",
    ctaDisabled: true,
  },
]

export default function TarifsPage() {
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
            Tarification
          </div>
          <h1
            className={`${serifClass} text-4xl md:text-5xl font-medium mb-5 leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Gratuit pour l&apos;essentiel,{" "}
            <em className="italic" style={{ color: p.accent }}>
              Premium
            </em>{" "}
            pour aller plus loin
          </h1>
          <p className="text-lg" style={{ color: p.ink2 }}>
            Notre mission est d&apos;aider toutes les familles. Les fonctions
            essentielles resteront toujours gratuites.
          </p>
        </div>
      </section>

      <section className="py-12" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-3xl p-5 sm:p-6 md:p-8"
                style={{
                  background: p.card,
                  border: `${plan.highlight ? "2px" : "1px"} solid ${
                    plan.highlight ? p.accent : p.line
                  }`,
                }}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: p.accent, color: "#fff" }}
                    >
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="text-center pb-2">
                  <div className="flex justify-center mb-3">
                    <div
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full"
                      style={{
                        background: plan.highlight ? p.bg2 : p.bg2,
                        color: plan.highlight ? p.accent : p.ink2,
                      }}
                    >
                      {plan.highlight ? (
                        <Crown className="h-5 w-5" />
                      ) : (
                        <Heart className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                  <h2
                    className={`${serifClass} text-2xl font-medium`}
                    style={{ color: p.ink, letterSpacing: "-0.02em" }}
                  >
                    {plan.name}
                  </h2>
                  <p className="text-sm mt-1 mb-4" style={{ color: p.ink2 }}>
                    {plan.description}
                  </p>

                  <div className="mb-6">
                    <span
                      className={`${serifClass} text-4xl font-medium`}
                      style={{ color: p.ink, letterSpacing: "-0.02em" }}
                    >
                      {plan.price}€
                    </span>
                    <span className="ml-1 text-sm" style={{ color: p.ink2 }}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      {feature.included ? (
                        <Check
                          className="h-4 w-4 mt-0.5 flex-shrink-0"
                          style={{
                            color: feature.highlight ? SAGE : p.ink2,
                          }}
                        />
                      ) : (
                        <X
                          className="h-4 w-4 mt-0.5 flex-shrink-0"
                          style={{ color: p.line2 }}
                        />
                      )}
                      <span
                        className="text-sm"
                        style={{
                          color: feature.included
                            ? feature.highlight
                              ? p.ink
                              : p.ink
                            : p.ink2,
                          fontWeight: feature.highlight ? 500 : 400,
                        }}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  aria-disabled={plan.ctaDisabled}
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background: plan.highlight ? p.ink : "transparent",
                    color: plan.highlight ? p.bg : p.ink,
                    border: `1px solid ${
                      plan.highlight ? p.ink : p.line2
                    }`,
                    opacity: plan.ctaDisabled ? 0.5 : 1,
                    pointerEvents: plan.ctaDisabled ? "none" : "auto",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14" style={{ background: p.bg }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <h2
              className={`${serifClass} text-2xl md:text-3xl font-medium mb-2`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Pourquoi c&apos;est{" "}
              <em className="italic" style={{ color: p.accent }}>
                gratuit
              </em>{" "}
              ?
            </h2>
            <p className="max-w-2xl mx-auto" style={{ color: p.ink2 }}>
              Chaque parent mérite d&apos;avoir accès à des informations
              fiables pour protéger ses enfants, quel que soit son budget.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Heart,
                title: "Mission sociale",
                body: "Aider les familles est notre priorité, pas les profits.",
              },
              {
                icon: Users,
                title: "Communauté",
                body: "Les membres Premium financent l'accès gratuit pour tous.",
              },
              {
                icon: Sparkles,
                title: "Pas de surprise",
                body: "Les fonctions gratuites le resteront. Promis.",
              },
            ].map((it) => (
              <div
                key={it.title}
                className="text-center rounded-2xl p-6"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
                  style={{ background: p.bg2, color: p.accent2 }}
                >
                  <it.icon className="h-5 w-5" />
                </div>
                <h3
                  className={`${serifClass} text-lg font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  {it.title}
                </h3>
                <p className="text-sm" style={{ color: p.ink2 }}>
                  {it.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-2xl">
          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-6 text-center`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Questions fréquentes
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Le plan gratuit est-il vraiment gratuit pour toujours ?",
                a: "Oui. Nous nous engageons à maintenir l'accès gratuit aux avis, évaluations et recommandations par âge. C'est le cœur de notre mission.",
              },
              {
                q: "Quand le plan Premium sera-t-il disponible ?",
                a: "Nous travaillons sur les fonctionnalités Premium. Inscrivez-vous pour être averti du lancement et bénéficier d'une offre early adopter.",
              },
              {
                q: "Puis-je annuler mon abonnement Premium à tout moment ?",
                a: "Absolument. Aucun engagement, vous pouvez annuler quand vous voulez et continuer à utiliser toutes les fonctions gratuites.",
              },
            ].map((f) => (
              <div
                key={f.q}
                className="rounded-2xl p-5"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <h3
                  className="font-semibold mb-2 text-sm md:text-base"
                  style={{ color: p.ink }}
                >
                  {f.q}
                </h3>
                <p className="text-sm" style={{ color: p.ink2 }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="py-12 text-center"
        style={{ background: p.ink, color: p.bg }}
      >
        <div className="container mx-auto px-4 max-w-2xl">
          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-3`}
            style={{ letterSpacing: "-0.02em" }}
          >
            Prêt à faire les bons choix pour votre famille ?
          </h2>
          <p className="mb-6 max-w-xl mx-auto opacity-70">
            Rejoignez les parents qui choisissent en confiance avec Totem Avisé.
          </p>
          <Link
            href="/inscription"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: p.bg, color: p.ink }}
          >
            Commencer gratuitement
          </Link>
        </div>
      </section>
    </div>
  )
}
