"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Search, Sparkles, Users, Home, ArrowDown, User } from "lucide-react"
import { Wrap, Em } from "./parts"
import { AgeChips } from "./AgeChips"
import { FamilyChips, type FamilyMemberLite } from "./FamilyChips"

// Column drift durations (s) — slow, staggered, like the prototype.
const DRIFT = [54, 63, 47, 71, 50, 67, 44, 58]
const COLS = 8

interface HeroRedesignProps {
  /** Real family-friendly poster URLs for the background wall (weekly set). */
  heroPosters: string[]
  selectedKeys: string[]
  onToggleAge: (key: string) => void
  familyMembers: FamilyMemberLite[]
  selectedMemberIds: string[]
  onToggleMember: (member: FamilyMemberLite) => void
  isLoggedIn: boolean
  /** Account display name — "Bon retour, famille X !" greeting fallback. */
  userName?: string | null
  /** User-chosen family display name (User.familyName) — wins over the
   *  last-name derivation when set ("Famille Dupont" everywhere). */
  familyDisplayName?: string | null
}

export function HeroRedesign({ heroPosters, selectedKeys, onToggleAge, familyMembers, selectedMemberIds, onToggleMember, isLoggedIn, userName = null, familyDisplayName = null }: HeroRedesignProps) {
  const router = useRouter()
  const [q, setQ] = useState("")

  // Returning family: greet by name and lead with member shortcuts instead of
  // re-asking for ages the profiles already carry. Only kicks in once at least
  // one family member exists — a fresh account still sees the age question.
  const hasFamily = isLoggedIn && familyMembers.length > 0
  // Preferred: the family name the user set in their profile. Fallback:
  // "famille Dupont" from the account name's last token; single-word names
  // fall back to the first name ("Bon retour, Xavier !").
  const nameTokens = (userName ?? "").trim().split(/\s+/).filter(Boolean)
  const familyName =
    familyDisplayName?.trim() ||
    (nameTokens.length >= 2 ? nameTokens[nameTokens.length - 1] : null)
  const firstName = nameTokens[0] ?? null

  // Distribute posters round-robin into columns; triple each column so the
  // -33.33% drift loops seamlessly.
  const columns: string[][] = Array.from({ length: COLS }, () => [])
  heroPosters.forEach((src, i) => columns[i % COLS].push(src))

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (term) router.push(`/recherche?q=${encodeURIComponent(term)}`)
  }

  return (
    <section id="v2-hero" className="relative overflow-hidden" style={{ borderBottom: "1px solid var(--line)" }}>
      {/* Poster wall — subtle, recognizable, drifting. DECORATIVE only, so it's
          hidden on mobile (`hidden sm:grid`): it rendered ~96 poster <img> tags
          (8 cols × tripled), which tanked mobile LCP (~18s on slow-4G). The veil
          gradient below carries the look on phones; the lazy images in this
          hidden container never fetch on mobile. */}
      {heroPosters.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 hidden grid-cols-8 gap-3.5 px-3.5 sm:grid"
          style={{ transform: "rotate(-8deg) scale(1.5)", transformOrigin: "center", opacity: 0.25, filter: "saturate(.9)" }}
        >
          {columns.map((col, ci) => (
            <div
              key={ci}
              className="v2-drift-col flex flex-col gap-3.5"
              style={{ animation: `v2-drift ${DRIFT[ci % DRIFT.length]}s linear infinite`, animationDirection: ci % 2 ? "reverse" : "normal" }}
            >
              {[...col, ...col, ...col].map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-[10px] object-cover" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Veil so the wall sits behind the text */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, transparent 40%, var(--paper) 86%), linear-gradient(180deg, color-mix(in srgb, var(--paper) 55%, transparent), var(--paper) 78%)",
        }}
      />

      <Wrap className="relative z-[2] py-16 text-center">
        <span
          className="inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-[13px] font-semibold"
          style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink-2)" }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--pine-2)" }} />
          <b style={{ color: "var(--pine-2)" }}>Indépendant</b> · pensé pour les familles
        </span>

        {hasFamily ? (
          <>
            <h1
              className="mx-auto mt-6 max-w-[20ch] text-[clamp(36px,5.2vw,68px)] font-bold leading-[1.05]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              Bon retour,{" "}
              <Em tone="terra">{familyName ? `famille ${familyName}` : firstName ? firstName : "chez vous"}</Em>
              &nbsp;!
            </h1>
            <p className="mx-auto mt-4 max-w-[60ch] text-[clamp(16px,2vw,19px)]" style={{ color: "var(--ink-2)" }}>
              Votre sélection du jour est prête, filtrée selon les âges et les sensibilités de votre
              famille. Dites-nous pour qui, on s&apos;occupe du reste.
            </p>
          </>
        ) : (
          <>
            <h1
              className="mx-auto mt-6 max-w-[20ch] text-[clamp(36px,5.2vw,68px)] font-bold leading-[1.05]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              Trouvez des films, séries et jeux <Em tone="terra">adaptés à votre famille</Em>.
            </h1>
            <p className="mx-auto mt-4 max-w-[60ch] text-[clamp(16px,2vw,19px)]" style={{ color: "var(--ink-2)" }}>
              Âges, goûts, sensibilités, plateformes : Totem Avisé vous aide à choisir en famille, sans mauvaise surprise.
            </p>
          </>
        )}

        {/* Personalization module */}
        <div
          className="mx-auto mt-8 max-w-[720px] rounded-[22px] p-[22px] text-left"
          style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "var(--shadow, 0 18px 40px -28px rgba(40,28,12,.55))" }}
        >
          {hasFamily ? (
            /* Returning family: the profiles already carry the ages, so lead
               with "who?" — selecting members re-ranks every rail below and
               adds the personalized rail. Age chips are dropped entirely. */
            <div className="flex items-center gap-2.5 text-[14px] font-bold" style={{ color: "var(--ink)" }}>
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: "var(--pine)" }}>
                <Users className="h-3 w-3 text-white" />
              </span>
              Pour qui cherchez-vous aujourd&apos;hui&nbsp;?
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-[14px] font-bold" style={{ color: "var(--ink)" }}>
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full text-[12px] text-white" style={{ background: "var(--pine)" }}>1</span>
              Les âges de vos enfants&nbsp;?
            </div>
          )}

          <div className="mt-3">
            {hasFamily ? (
              <FamilyChips members={familyMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} isLoggedIn={isLoggedIn} size="lg" />
            ) : (
              <AgeChips selectedKeys={selectedKeys} onToggleAge={onToggleAge} size="lg" />
            )}
          </div>

          <form onSubmit={onSubmit} className="mt-[18px] flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex w-full min-w-0 items-center gap-2.5 rounded-full px-[18px] py-[13px] sm:flex-1" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
              <Search className="h-[17px] w-[17px] shrink-0" style={{ color: "var(--ink-3)" }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={hasFamily ? "Ou cherchez un titre précis…" : "Un titre…"}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                style={{ color: "var(--ink)" }}
              />
            </label>
            <a
              href="#weekend"
              className="w-full shrink-0 whitespace-nowrap rounded-full px-5 py-[13px] text-center text-[14.5px] font-bold text-white sm:w-auto"
              style={{ background: "var(--terra)" }}
            >
              Voir la sélection
            </a>
          </form>

          {hasFamily ? (
            /* Clear proposals for a returning family — direct paths into the
               personalized surfaces, no dead ends. */
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <span className="w-full whitespace-nowrap text-[14px] font-bold sm:w-auto" style={{ color: "var(--ink)" }}>
                Idées rapides&nbsp;:
              </span>
              <a
                href="#weekend"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <ArrowDown className="h-3.5 w-3.5" style={{ color: "var(--terra)" }} />
                La sélection du jour
              </a>
              <Link
                href="/coin-famille"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <Home className="h-3.5 w-3.5" style={{ color: "var(--terra)" }} />
                Le Coin Famille
              </Link>
              <Link
                href="/profil"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-bold transition-opacity hover:opacity-80"
                style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <User className="h-3.5 w-3.5" style={{ color: "var(--terra)" }} />
                Ma famille
              </Link>
            </div>
          ) : (
            /* Votre sélection, sur mesure — member shortcuts inline on one row
                (or a sign-up nudge when there's no family yet). Kept compact. */
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
              <span className="w-full whitespace-nowrap text-[14px] font-bold sm:w-auto" style={{ color: "var(--ink)" }}>
                Votre sélection, sur mesure :
              </span>
              <FamilyChips members={familyMembers} selectedMemberIds={selectedMemberIds} onToggleMember={onToggleMember} isLoggedIn={isLoggedIn} size="lg" />
            </div>
          )}
        </div>
      </Wrap>
    </section>
  )
}
