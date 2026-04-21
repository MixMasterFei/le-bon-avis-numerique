import { Heart, Users, Sparkles, ArrowRight, Film, Tv, Gamepad2, BookOpen } from "lucide-react"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export const metadata = {
  title: "À propos | Totem Avisé",
  description:
    "Totem Avisé aide les familles françaises à trouver les films, séries et jeux adaptés à chaque membre du foyer.",
}

const howItWorks = [
  {
    step: "1",
    title: "Créez votre profil famille",
    description:
      "Ajoutez chaque membre avec son âge et ses préférences. 30 secondes, c'est fait.",
    icon: Users,
  },
  {
    step: "2",
    title: "On analyse, vous choisissez",
    description:
      "Chaque contenu est passé au crible sur 7 critères (violence, langage, messages positifs…) et croisé avec le profil de votre famille.",
    icon: Sparkles,
  },
  {
    step: "3",
    title: "Découvrez ensemble",
    description:
      "Filtrez par âge, par humeur ou par thème. Trouvez le bon film pour le mercredi soir ou le jeu du week-end.",
    icon: Heart,
  },
]

const stats = [
  { label: "Contenus analysés", value: "8 000+" },
  { label: "Critères évalués", value: "7" },
  { label: "Types de médias", value: "4" },
]

export default async function AProposPage() {
  const session = await auth()
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
            Notre histoire
          </div>
          <h1
            className={`${serifClass} text-4xl md:text-5xl font-medium mb-5 leading-[1.05]`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            À propos de{" "}
            <em className="italic" style={{ color: p.accent }}>
              Totem Avisé
            </em>
          </h1>
          <p className="text-lg md:text-xl leading-relaxed" style={{ color: p.ink2 }}>
            Le bon film pour le bon enfant, au bon moment. On aide les familles
            à s&apos;y retrouver dans la jungle des écrans.
          </p>
        </div>
      </section>

      <section className="py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl">
          <div
            className="rounded-3xl p-8 lg:p-10 mb-12"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <h2
              className={`${serifClass} text-2xl md:text-3xl font-medium mb-5`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              L&apos;histoire de Totem Avisé
            </h2>
            <div
              className="space-y-4 leading-relaxed text-base"
              style={{ color: p.ink2 }}
            >
              <p>
                <strong style={{ color: p.ink }}>
                  « Qu&apos;est-ce qu&apos;on regarde ce soir ? »
                </strong>{" "}
                La question revient chaque semaine. Et chaque semaine,
                c&apos;est le même problème : le petit veut un dessin animé,
                l&apos;aîné veut de l&apos;action, et les parents veulent être
                sûrs que personne ne va voir quelque chose d&apos;inadapté.
              </p>
              <p>
                Les classifications officielles donnent un âge, point final.
                Elles ne disent pas si le film va faire peur au petit dernier,
                ni si la série va captiver l&apos;ado. Chaque enfant est
                différent.
              </p>
              <p>
                Totem Avisé est né de ce constat. On analyse chaque film,
                série et jeu sur 7 critères, on croise ça avec le profil de
                votre famille, et on vous dit ce qui colle vraiment. Pas de
                pub, pas de partenariat avec des studios. Juste des
                recommandations honnêtes pour les familles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-12">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p
                  className={`${serifClass} text-3xl lg:text-4xl font-medium mb-1`}
                  style={{ color: p.accent, letterSpacing: "-0.02em" }}
                >
                  {stat.value}
                </p>
                <p className="text-sm" style={{ color: p.ink2 }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <h2
            className={`${serifClass} text-2xl md:text-3xl font-medium mb-6 text-center`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Comment ça{" "}
            <em className="italic" style={{ color: p.accent }}>
              fonctionne
            </em>
          </h2>
          <div className="grid md:grid-cols-3 gap-4 md:gap-5 mb-12">
            {howItWorks.map((step) => (
              <div
                key={step.step}
                className="rounded-2xl p-6 text-center"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
                  style={{ background: p.bg2, color: p.accent2 }}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <div
                  className="text-[11px] font-semibold uppercase tracking-wide mb-2"
                  style={{ color: p.accent }}
                >
                  Étape {step.step}
                </div>
                <h3
                  className={`${serifClass} text-lg font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: p.ink2 }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-8 mb-12"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            <h2
              className={`${serifClass} text-xl md:text-2xl font-medium mb-5 text-center`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Ce que vous pouvez découvrir
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Film, label: "Films" },
                { icon: Tv, label: "Séries" },
                { icon: Gamepad2, label: "Jeux vidéo" },
                { icon: BookOpen, label: "Livres" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl"
                  style={{ background: p.bg2, color: p.ink }}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-3xl p-8 text-center"
            style={{ background: p.card, border: `1px solid ${p.line}` }}
          >
            {session ? (
              <>
                <h2
                  className={`${serifClass} text-2xl md:text-3xl font-medium mb-3`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Trouvez votre prochain{" "}
                  <em className="italic" style={{ color: p.accent }}>
                    coup de cœur
                  </em>
                </h2>
                <p
                  className="mb-6 max-w-lg mx-auto text-sm md:text-base"
                  style={{ color: p.ink2 }}
                >
                  Explorez nos collections par thème ou laissez-vous surprendre
                  par les recommandations de votre famille.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/collections"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: p.ink, color: p.bg }}
                  >
                    Explorer les collections
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/profil"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{
                      background: "transparent",
                      color: p.ink,
                      border: `1px solid ${p.line2}`,
                    }}
                  >
                    Mon foyer
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2
                  className={`${serifClass} text-2xl md:text-3xl font-medium mb-3`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Essayez{" "}
                  <em className="italic" style={{ color: p.accent }}>
                    gratuitement
                  </em>
                </h2>
                <p
                  className="mb-6 max-w-lg mx-auto text-sm md:text-base"
                  style={{ color: p.ink2 }}
                >
                  Créez votre profil famille en 30 secondes. On s&apos;occupe
                  du reste.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/inscription"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: p.ink, color: p.bg }}
                  >
                    Créer mon profil famille
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/films"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{
                      background: "transparent",
                      color: p.ink,
                      border: `1px solid ${p.line2}`,
                    }}
                  >
                    Découvrir les films
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
