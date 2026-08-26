import { ShieldAlert, Users, Award, Star, ThumbsUp, BookOpen, Sparkles, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { methodeSections, type MethodeIcon } from "./notre-methode.data"

export const metadata = {
  // Lengthened from "Notre méthode | Totem Avisé" (28 chars, below 30
  // recommended) to clarify what the page covers in search results.
  title: "Notre méthode d'évaluation des contenus",
  // Lengthened from 96 to 144 chars (target 120+) so Google has more
  // signal for the page topic in SERPs.
  description:
    "Comment Totem Avisé évalue les films, séries et jeux pour les familles : analyse en 8 dimensions, recommandations d'âge, compatibilité familiale.",
  alternates: {
    canonical: "/notre-methode",
    types: { "text/markdown": "/md/notre-methode" },
  },
  openGraph: {
    title: "Notre méthode d'évaluation des contenus | Totem Avisé",
    description:
      "Comment Totem Avisé évalue les films, séries et jeux pour les familles : analyse en 8 dimensions, recommandations d'âge, compatibilité familiale.",
    url: "https://totemavise.com/notre-methode",
  },
}

const iconByName: Record<MethodeIcon, LucideIcon> = {
  sparkles: Sparkles,
  award: Award,
  "book-open": BookOpen,
  star: Star,
  users: Users,
  "shield-alert": ShieldAlert,
  "thumbs-up": ThumbsUp,
}

const sections = methodeSections.map((s) => ({ ...s, icon: iconByName[s.icon] }))

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
