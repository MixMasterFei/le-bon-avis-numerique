import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Bot, Lock, MessageCircleQuestion, Plug, Info, Globe, Link2 } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { isAdmin } from "@/lib/auth"
import { isAiConnectorsPagePublic } from "@/lib/ai-connectors-flag"
import {
  CONNECTOR_URL,
  EXAMPLE_QUESTIONS,
  GOOD_TO_KNOW,
  PRIVACY_POINTS,
  REVIEWER_SECTION,
  SETUP_GUIDES,
  SUPPORT_EMAIL,
  TOOLS,
} from "./assistants-ia.data"

// Public documentation of the connector for AI assistants — the page a
// connector directory links to. Admin-only until AI_CONNECTORS_PAGE_PUBLIC
// (see src/lib/ai-connectors-flag.ts for why the default is closed).

export const dynamic = "force-dynamic"

const DESCRIPTION =
  "Branchez Totem Avisé à votre assistant IA : âges conseillés, indicateurs de contenu et sélections par âge, " +
  "sans compte ni donnée personnelle."

export function generateMetadata(): Metadata {
  return {
    // No assistant names in meta tags: the naming exception covers the
    // page body, where families need them to find the right setup steps.
    title: "Totem Avisé dans votre assistant IA : le connecteur familial",
    description: DESCRIPTION,
    alternates: { canonical: "/assistants-ia" },
    robots: isAiConnectorsPagePublic() ? undefined : { index: false, follow: false },
    openGraph: {
      title: "Totem Avisé dans votre assistant IA",
      description: DESCRIPTION,
      url: "https://totemavise.com/assistants-ia",
    },
  }
}

function Card({ id, icon: Icon, title, children }: { id: string; icon: typeof Bot; title: string; children: React.ReactNode }) {
  const p = APERCU_PALETTE
  return (
    <div
      id={id}
      className="scroll-mt-24 rounded-3xl p-7 md:p-9"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="inline-flex items-center justify-center w-11 h-11 rounded-full"
          style={{ background: p.bg2, color: p.accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-serif text-xl md:text-2xl font-medium" style={{ color: p.ink, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
      </div>
      <div className="space-y-4 leading-relaxed text-sm md:text-base" style={{ color: p.ink2 }}>
        {children}
      </div>
    </div>
  )
}

function Bullets({ items }: { items: { label: string; desc: string }[] }) {
  const p = APERCU_PALETTE
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex gap-3">
          <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />
          <div>
            <span className="font-semibold" style={{ color: p.ink }}>
              {item.label}
            </span>
            <span> — {item.desc}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ConnectorUrl() {
  const p = APERCU_PALETTE
  return (
    <code
      className="block select-all break-all rounded-xl px-4 py-3 text-sm md:text-base font-mono"
      style={{ background: p.bg2, color: p.ink, border: `1px solid ${p.line2}` }}
    >
      {CONNECTOR_URL}
    </code>
  )
}

export default async function AssistantsIaPage() {
  // Public: no session lookup at all. Otherwise admins only (preview).
  if (!isAiConnectorsPagePublic() && !(await isAdmin())) notFound()
  const p = APERCU_PALETTE

  return (
    <div className="flex flex-col flex-1" style={{ background: p.bg, color: p.ink }}>
      <section className="py-16 md:py-20" style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}>
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="text-[11px] font-semibold mb-3 uppercase tracking-wide" style={{ color: p.accent }}>
            Assistants IA
          </div>
          <h1
            className="font-serif text-4xl md:text-5xl font-medium mb-5 leading-[1.05]"
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Totem Avisé,{" "}
            <em className="italic" style={{ color: p.accent }}>
              dans votre assistant
            </em>
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: p.ink2 }}>
            Vous demandez déjà à un assistant IA quel film regarder ce soir ? Branchez-y Totem Avisé : il vous
            répondra avec nos âges conseillés, nos indicateurs de contenu et le lien vers la fiche, plutôt qu&apos;avec
            un avis trouvé au hasard.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 max-w-4xl space-y-6">
          <Card id="ce-que-ca-apporte" icon={Bot} title="Ce que Totem apporte dans la conversation">
            <Bullets items={TOOLS.map((t) => ({ label: t.label, desc: t.desc }))} />
          </Card>

          <Card id="adresse" icon={Link2} title="L'adresse du connecteur">
            <p>À copier dans votre assistant. Aucun compte, aucune clé : l&apos;adresse suffit.</p>
            <ConnectorUrl />
          </Card>

          <Card id="exemples" icon={MessageCircleQuestion} title="Des questions à lui poser">
            <ul className="space-y-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <li key={q} className="rounded-xl px-4 py-2.5" style={{ background: p.bg2, color: p.ink }}>
                  « {q} »
                </li>
              ))}
            </ul>
          </Card>

          <Card id="confidentialite" icon={Lock} title="Votre vie privée">
            <Bullets items={PRIVACY_POINTS} />
            <p>
              Le détail est dans notre{" "}
              <Link href="/confidentialite" className="underline underline-offset-2" style={{ color: p.ink }}>
                politique de confidentialité
              </Link>
              .
            </p>
          </Card>

          <Card id="installer" icon={Plug} title="L'installer, pas à pas">
            <div className="space-y-6">
              {SETUP_GUIDES.map((g) => (
                <div key={g.id} id={g.id} className="scroll-mt-24">
                  <h3 className="font-semibold text-base md:text-lg mb-1" style={{ color: p.ink }}>
                    {g.assistant}
                  </h3>
                  <p className="text-xs md:text-sm mb-2">{g.availability}</p>
                  <ol className="list-decimal pl-5 space-y-1.5">
                    {g.steps.map((step) => (
                      <li key={step} className="break-words">
                        {step}
                      </li>
                    ))}
                  </ol>
                  {g.note && <p className="text-xs md:text-sm mt-2">{g.note}</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card id="bon-a-savoir" icon={Info} title="Bon à savoir">
            <ul className="space-y-2 list-disc pl-5">
              {GOOD_TO_KNOW.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>
              Une question, un souci ?{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2" style={{ color: p.ink }}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </Card>

          <div lang="en">
            <Card id="reviewers" icon={Globe} title={REVIEWER_SECTION.title}>
              {REVIEWER_SECTION.paragraphs.map((para) => (
                <p key={para} className="break-words">
                  {para}
                </p>
              ))}
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
