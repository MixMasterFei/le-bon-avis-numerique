"use client"

import Link from "next/link"
import { Plus, Settings, Sparkles } from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { getMemberAge } from "@/lib/age-utils"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuFooter } from "./ApercuFooter"
import { ApercuFinalCTA } from "./ApercuFinalCTA"
import { APERCU_PALETTE } from "./apercuTheme"

interface ApercuFoyerData {
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
    avatarStyle: string | null
    avatarSeed: string | null
    avatarOptions: Record<string, unknown> | null
    memberSince: string
  }
  members: Array<{
    id: string
    name: string
    birthYear: number | null
    birthMonth: number | null
    avatarEmoji: string | null
    avatarStyle: string | null
    avatarSeed: string | null
    avatarOptions: Record<string, unknown> | null
    interests: string[]
    favoriteGenres: string[]
    useCustomSettings: boolean
    sensitivityViolence: number
    sensitivityScary: number
    reactionCount: number
  }>
  totalReactions: number
}

export function ApercuFoyer({
  data,
  serifClass,
}: {
  data: ApercuFoyerData
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div className="flex flex-col overflow-x-hidden" style={{ background: p.bg, color: p.ink }}>
        <ApercuPreviewBanner />
        <ApercuNav />

        <FoyerHero data={data} serifClass={serifClass} />
        <FoyerMembers data={data} serifClass={serifClass} />
        <FoyerQuickActions serifClass={serifClass} />

        <ApercuFinalCTA serifClass={serifClass} isLoggedIn />
        <ApercuFooter serifClass={serifClass} />
      </div>
    </FamilyFitProvider>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────

function FoyerHero({ data, serifClass }: { data: ApercuFoyerData; serifClass: string }) {
  const p = APERCU_PALETTE
  const firstName = data.user.name?.split(" ")[0] ?? "Bonjour"
  const memberCount = data.members.length

  return (
    <section style={{ background: p.bg2 }} className="py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-start">
          <div>
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Votre foyer
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl lg:text-6xl font-medium leading-[1.02] m-0`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              Bonjour,{" "}
              <em className="italic" style={{ color: p.accent }}>
                {firstName}
              </em>
              .
            </h1>
            <p
              className="mt-5 text-base md:text-lg leading-relaxed max-w-xl"
              style={{ color: p.ink2 }}
            >
              {memberCount > 0
                ? `Votre foyer compte ${memberCount} membre${memberCount > 1 ? "s" : ""}. Chaque recommandation est calibrée à leurs âges, goûts et sensibilités.`
                : "Ajoutez les membres de votre foyer pour activer les recommandations personnalisées."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/profil"
                className="px-6 py-3 rounded-[10px] text-sm font-medium transition-transform hover:scale-[1.02]"
                style={{ background: p.ink, color: p.bg }}
              >
                Ouvrir mon espace
              </Link>
              <Link
                href="/films"
                className="px-5 py-3 rounded-[10px] text-sm font-medium transition-colors"
                style={{ background: "transparent", color: p.ink, border: `1px solid ${p.line2}` }}
              >
                Parcourir le catalogue
              </Link>
            </div>

            {/* Stats row */}
            <div
              className="mt-10 pt-7 flex flex-wrap gap-8 md:gap-10"
              style={{ borderTop: `1px solid ${p.line}` }}
            >
              <Stat
                n={String(memberCount)}
                l={`membre${memberCount > 1 ? "s" : ""} du foyer`}
                serifClass={serifClass}
              />
              <Stat
                n={String(data.totalReactions)}
                l={`réaction${data.totalReactions > 1 ? "s" : ""} partagée${data.totalReactions > 1 ? "s" : ""}`}
                serifClass={serifClass}
              />
              <Stat
                n={formatRelativeYears(data.user.memberSince)}
                l="sur Totem Avisé"
                serifClass={serifClass}
                accent={p.accent}
              />
            </div>
          </div>

          {/* Owner avatar + foyer stack preview */}
          <OwnerPanel data={data} serifClass={serifClass} />
        </div>
      </div>
    </section>
  )
}

function OwnerPanel({ data, serifClass }: { data: ApercuFoyerData; serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 14px 32px rgba(0,0,0,0.10)",
      }}
    >
      <div className="flex items-center gap-4">
        <MemberAvatar
          avatarStyle={data.user.avatarStyle}
          avatarSeed={data.user.avatarSeed}
          avatarOptions={data.user.avatarOptions}
          avatarEmoji={null}
          name={data.user.name ?? "Foyer"}
          size={56}
        />
        <div className="min-w-0">
          <div
            className={`${serifClass} text-lg font-semibold`}
            style={{ color: p.ink }}
          >
            {data.user.name ?? "Votre foyer"}
          </div>
          {data.user.email && (
            <div className="text-xs truncate" style={{ color: p.ink2 }}>
              {data.user.email}
            </div>
          )}
        </div>
      </div>

      {data.members.length > 0 && (
        <div
          className="mt-5 pt-5"
          style={{ borderTop: `1px solid ${p.line}` }}
        >
          <div
            className="text-[11px] font-semibold mb-3 uppercase tracking-wide"
            style={{ color: p.ink2 }}
          >
            Membres
          </div>
          <div className="flex flex-wrap gap-3">
            {data.members.map((m) => {
              const age = getMemberAge(m.birthYear, m.birthMonth)
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 pr-3"
                  style={{ color: p.ink }}
                >
                  <MemberAvatar
                    avatarStyle={m.avatarStyle}
                    avatarSeed={m.avatarSeed}
                    avatarOptions={m.avatarOptions}
                    avatarEmoji={m.avatarEmoji}
                    name={m.name}
                    size={28}
                  />
                  <div className="text-xs leading-tight">
                    <div className="font-semibold">{m.name}</div>
                    {age !== null && (
                      <div style={{ color: p.ink2 }}>{age} ans</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Members grid ────────────────────────────────────────────────────

function FoyerMembers({ data, serifClass }: { data: ApercuFoyerData; serifClass: string }) {
  const p = APERCU_PALETTE
  const members = data.members

  return (
    <section className="py-10 md:py-14" style={{ background: p.bg }}>
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-7">
          <div>
            <div
              className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Profils personnalisés
            </div>
            <h2
              className={`${serifClass} text-2xl md:text-4xl font-medium m-0 leading-[1.05]`}
              style={{ letterSpacing: "-0.03em" }}
            >
              Un <em className="italic" style={{ color: p.accent }}>profil</em>{" "}
              par membre, une{" "}
              <em className="italic" style={{ color: p.accent2 }}>lecture</em>{" "}
              adaptée.
            </h2>
          </div>
          <Link
            href="/profil"
            className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70"
            style={{ color: p.ink }}
          >
            Gérer les membres <span>→</span>
          </Link>
        </div>

        {members.length === 0 ? (
          <EmptyMembersCard serifClass={serifClass} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} serifClass={serifClass} />
            ))}
            <AddMemberCard serifClass={serifClass} />
          </div>
        )}
      </div>
    </section>
  )
}

function MemberCard({
  member,
  serifClass,
}: {
  member: ApercuFoyerData["members"][number]
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const age = getMemberAge(member.birthYear, member.birthMonth)
  const completion = computeCompletion(member)

  return (
    <Link
      href={`/profil/membres/${member.id}`}
      className="group rounded-2xl p-5 block transition-all hover:-translate-y-0.5"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <MemberAvatar
          avatarStyle={member.avatarStyle}
          avatarSeed={member.avatarSeed}
          avatarOptions={member.avatarOptions}
          avatarEmoji={member.avatarEmoji}
          name={member.name}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`${serifClass} text-xl font-semibold`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {member.name}
          </div>
          <div className="text-sm" style={{ color: p.ink2 }}>
            {age !== null ? `${age} ans` : "Âge non renseigné"}
          </div>
        </div>
      </div>

      {/* Completion meter */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between text-[11px] mb-1.5">
          <span style={{ color: p.ink2 }}>Profil complété</span>
          <span className="font-semibold" style={{ color: p.ink }}>
            {completion}%
          </span>
        </div>
        <div
          className="relative h-1.5 rounded-full overflow-hidden"
          style={{ background: p.bg2 }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{
              width: `${completion}%`,
              background: completion >= 80 ? p.accent2 : p.accent,
            }}
          />
        </div>
      </div>

      {/* Preferences summary */}
      <div className="space-y-1.5 text-xs" style={{ color: p.ink2 }}>
        <Row
          label="Genres préférés"
          value={
            member.favoriteGenres.length > 0
              ? member.favoriteGenres.slice(0, 3).join(" · ")
              : "Non renseignés"
          }
        />
        <Row
          label="Intérêts"
          value={
            member.interests.length > 0
              ? `${member.interests.length} sélectionné${member.interests.length > 1 ? "s" : ""}`
              : "À ajouter"
          }
        />
        <Row
          label="Réactions"
          value={
            member.reactionCount > 0
              ? `${member.reactionCount} film${member.reactionCount > 1 ? "s" : ""} marqué${member.reactionCount > 1 ? "s" : ""}`
              : "Aucune pour l’instant"
          }
        />
      </div>
    </Link>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const p = APERCU_PALETTE
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex-shrink-0">{label}</span>
      <span
        className="text-right line-clamp-1"
        style={{ color: p.ink }}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

function AddMemberCard({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <Link
      href="/profil"
      className="rounded-2xl p-5 flex flex-col items-center justify-center gap-3 min-h-[200px] transition-colors"
      style={{
        background: "transparent",
        border: `2px dashed ${p.line2}`,
        color: p.ink2,
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: p.bg2 }}
      >
        <Plus className="h-5 w-5" style={{ color: p.accent }} />
      </div>
      <div className={`${serifClass} text-sm font-medium`} style={{ color: p.ink }}>
        Ajouter un membre
      </div>
    </Link>
  )
}

function EmptyMembersCard({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <Link
      href="/profil"
      className="rounded-2xl p-10 text-center block transition-colors"
      style={{
        background: p.card,
        border: `2px dashed ${p.line2}`,
        color: p.ink2,
      }}
    >
      <div
        className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: p.bg2 }}
      >
        <Plus className="h-5 w-5" style={{ color: p.accent }} />
      </div>
      <div
        className={`${serifClass} text-lg font-semibold`}
        style={{ color: p.ink }}
      >
        Commencez par ajouter un membre
      </div>
      <div className="text-sm mt-1.5">
        Une minute suffit pour obtenir vos premières recommandations.
      </div>
    </Link>
  )
}

// ─── Quick actions ───────────────────────────────────────────────────

function FoyerQuickActions({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  const actions = [
    {
      icon: Sparkles,
      title: "Recommandations",
      sub: "Films adaptés à chaque membre, mises à jour chaque semaine.",
      href: "/profil",
      accent: p.accent,
    },
    {
      icon: Settings,
      title: "Sensibilités du foyer",
      sub: "Ajustez les seuils violence, langage, peur… par membre.",
      href: "/profil/parametres-famille",
      accent: p.accent2,
    },
    {
      icon: Plus,
      title: "Soirée famille",
      sub: "Trouvez un film qui convient à toute la tablée en un clic.",
      href: "/profil",
      accent: p.ink,
    },
  ]

  return (
    <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
      <div className="container mx-auto px-4 md:px-8">
        <div
          className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
          style={{ color: p.accent }}
        >
          Continuez
        </div>
        <h2
          className={`${serifClass} text-2xl md:text-4xl font-medium m-0 mb-7 leading-[1.05]`}
          style={{ letterSpacing: "-0.03em" }}
        >
          Où voulez-vous aller ensuite ?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((a) => (
            <Link
              key={a.title}
              href={a.href}
              className="group rounded-2xl p-6 transition-all hover:-translate-y-0.5"
              style={{
                background: p.card,
                border: `1px solid ${p.line}`,
                color: p.ink,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
                style={{ background: p.bg2 }}
              >
                <a.icon className="h-5 w-5" style={{ color: a.accent }} />
              </div>
              <div
                className={`${serifClass} text-xl font-semibold mb-1`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                {a.title}
              </div>
              <div className="text-sm" style={{ color: p.ink2 }}>
                {a.sub}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function Stat({
  n,
  l,
  accent,
  serifClass,
}: {
  n: string
  l: string
  accent?: string
  serifClass: string
}) {
  return (
    <div>
      <div
        className={`${serifClass} text-2xl md:text-3xl font-medium`}
        style={{
          letterSpacing: "-0.02em",
          color: accent ?? "inherit",
        }}
      >
        {n}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>
        {l}
      </div>
    </div>
  )
}

function formatRelativeYears(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days < 30) return `${days} j`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mois`
  const years = Math.floor(days / 365)
  return `${years} an${years > 1 ? "s" : ""}`
}

function computeCompletion(member: ApercuFoyerData["members"][number]): number {
  let pct = 0
  if (member.birthYear) pct += 20
  if (member.useCustomSettings && member.favoriteGenres.length > 0) pct += 40
  if (member.reactionCount >= 3) pct += 20
  if (member.interests.length > 0) pct += 20
  return pct
}
