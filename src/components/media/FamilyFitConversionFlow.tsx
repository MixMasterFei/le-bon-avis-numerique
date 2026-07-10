"use client"

import { useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { ArrowRight, Check, Loader2, ShieldCheck, UserPlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useFamilyFitData } from "@/components/media/FicheDataContext"

type Variant = "dashboard" | "warm"

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const

const SENSITIVITIES = [
  { key: "sensitivityScary", label: "La peur" },
  { key: "sensitivityViolence", label: "La violence" },
  { key: "sensitivityLanguage", label: "Le langage" },
] as const

type SensitivityKey = (typeof SENSITIVITIES)[number]["key"]

function callbackFor(pathname: string): string {
  return `${pathname}?fit=1`
}

function buttonStyle(variant: Variant): React.CSSProperties {
  return variant === "dashboard"
    ? { background: "var(--f-ink)", color: "var(--f-page)" }
    : { background: "var(--color-warm-accent)", color: "#fff" }
}

export function FamilyFitSignIn({
  variant,
  compact = false,
}: {
  variant: Variant
  compact?: boolean
}) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(false)
  const callbackUrl = callbackFor(pathname)

  const startGoogle = async () => {
    setLoading(true)
    await signIn("google", { callbackUrl })
  }

  return (
    <div>
      <button
        type="button"
        onClick={startGoogle}
        disabled={loading}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 ${
          compact ? "px-3 py-2 text-[11.5px]" : "px-4 py-2.5 text-sm"
        }`}
        style={buttonStyle(variant)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Voir si ce contenu convient à ma famille
        {!compact && !loading && <ArrowRight className="h-4 w-4" />}
      </button>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-[10.5px]">
        <span style={{ color: variant === "dashboard" ? "var(--f-muted)" : "var(--color-warm-ink2)" }}>
          Gratuit · connexion Google rapide
        </span>
        <Link
          href={`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold underline underline-offset-2"
          style={{ color: variant === "dashboard" ? "var(--f-ink)" : "var(--color-warm-ink)" }}
        >
          Autre méthode
        </Link>
      </div>
    </div>
  )
}

export function FamilyFitQuickSetup({
  mediaId,
  variant,
  compact = false,
  autoOpen = true,
}: {
  mediaId: string
  variant: Variant
  compact?: boolean
  autoOpen?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update } = useSession()
  const { refetch } = useFamilyFitData(mediaId)
  const currentYear = new Date().getFullYear()
  const years = useMemo(
    () => Array.from({ length: 90 }, (_, index) => currentYear - index),
    [currentYear],
  )
  const [open, setOpen] = useState(autoOpen && searchParams.get("fit") === "1")
  const [name, setName] = useState("")
  const [birthYear, setBirthYear] = useState("")
  const [birthMonth, setBirthMonth] = useState("")
  const [sensitiveTo, setSensitiveTo] = useState<Set<SensitivityKey>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleSensitivity = (key: SensitivityKey) => {
    setSensitiveTo((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !birthYear) {
      setError("Indiquez un prénom ou surnom et une année de naissance.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const createResponse = await fetch("/api/user/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthYear,
          birthMonth: birthMonth || null,
        }),
      })
      const created = await createResponse.json()
      if (!createResponse.ok || !created?.familyMember?.id) {
        throw new Error(created?.error || "Impossible de créer ce profil.")
      }

      if (sensitiveTo.size > 0) {
        const preferences = Object.fromEntries(
          [...sensitiveTo].map((key) => [key, 3]),
        )
        await fetch(`/api/user/family/${created.familyMember.id}/preferences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...preferences, useCustomSettings: true }),
        })
      }

      // POST /api/user/family marks onboarding complete atomically for the
      // first member; refresh the JWT before cleaning ?fit=1 from the URL.
      await update()
      refetch()
      setOpen(false)
      router.replace(pathname, { scroll: false })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Une erreur est survenue.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all hover:-translate-y-0.5 hover:opacity-90 ${
          compact ? "px-3 py-2 text-[11.5px]" : "px-4 py-2.5 text-sm"
        }`}
        style={buttonStyle(variant)}
      >
        <UserPlus className="h-4 w-4" />
        Ajouter mon premier profil
        {!compact && <ArrowRight className="h-4 w-4" />}
      </button>
      <p
        className="mt-2 text-center text-[10.5px]"
        style={{ color: variant === "dashboard" ? "var(--f-muted)" : "var(--color-warm-ink2)" }}
      >
        Un surnom et l’âge suffisent · moins d’une minute
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-3xl p-0"
          style={{
            background: "var(--color-warm-card)",
            border: "1px solid var(--color-warm-line)",
            color: "var(--color-warm-ink)",
          }}
        >
          <div className="border-b px-6 pb-5 pt-7 sm:px-8" style={{ borderColor: "var(--color-warm-line)" }}>
            <div
              className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ background: "var(--color-warm-bg2)", color: "var(--color-warm-accent)" }}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-medium tracking-[-0.02em]">
                Pour qui choisissez-vous&nbsp;?
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
                Créez un premier profil pour obtenir tout de suite un repère adapté à son âge.
                Vous pourrez affiner ses goûts plus tard.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={submit} className="space-y-6 px-6 pb-7 sm:px-8">
            <div className="space-y-2 pt-1">
              <label htmlFor="quick-family-name" className="text-sm font-semibold">
                Prénom ou surnom
              </label>
              <input
                id="quick-family-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                autoComplete="off"
                autoFocus
                placeholder="Par exemple : Léa"
                className="h-12 w-full rounded-xl px-4 text-sm outline-none transition-shadow focus:ring-2"
                style={{
                  background: "var(--color-warm-bg2)",
                  border: "1px solid var(--color-warm-line)",
                  color: "var(--color-warm-ink)",
                }}
              />
              <p className="text-[11px]" style={{ color: "var(--color-warm-ink2)" }}>
                Un surnom suffit — inutile d’indiquer son identité complète.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="quick-family-year" className="text-sm font-semibold">
                  Année de naissance
                </label>
                <select
                  id="quick-family-year"
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value)}
                  className="h-12 w-full rounded-xl px-3 text-sm outline-none"
                  style={{
                    background: "var(--color-warm-bg2)",
                    border: "1px solid var(--color-warm-line)",
                    color: "var(--color-warm-ink)",
                  }}
                >
                  <option value="">Choisir l’année</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="quick-family-month" className="text-sm font-semibold">
                  Mois <span className="font-normal" style={{ color: "var(--color-warm-ink2)" }}>(facultatif)</span>
                </label>
                <select
                  id="quick-family-month"
                  value={birthMonth}
                  onChange={(event) => setBirthMonth(event.target.value)}
                  className="h-12 w-full rounded-xl px-3 text-sm outline-none"
                  style={{
                    background: "var(--color-warm-bg2)",
                    border: "1px solid var(--color-warm-line)",
                    color: "var(--color-warm-ink)",
                  }}
                >
                  <option value="">Non précisé</option>
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-semibold">Particulièrement sensible à…</legend>
              <p className="mb-3 mt-1 text-[11px]" style={{ color: "var(--color-warm-ink2)" }}>
                Facultatif — sélectionnez seulement ce que vous souhaitez vraiment éviter.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SENSITIVITIES.map((item) => {
                  const selected = sensitiveTo.has(item.key)
                  return (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSensitivity(item.key)}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors"
                      style={{
                        background: selected
                          ? "color-mix(in srgb, var(--color-warm-accent) 14%, var(--color-warm-card))"
                          : "var(--color-warm-bg2)",
                        border: `1px solid ${selected ? "var(--color-warm-accent)" : "var(--color-warm-line)"}`,
                        color: selected ? "var(--color-warm-accent)" : "var(--color-warm-ink2)",
                      }}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {error && (
              <p
                role="alert"
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--color-warm-accent) 14%, var(--color-warm-card))",
                  color: "var(--color-warm-accent)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--color-warm-accent)" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? "Création du profil…" : "Voir le repère personnalisé"}
            </button>
            <p className="text-center text-[10.5px]" style={{ color: "var(--color-warm-ink2)" }}>
              Ces informations servent uniquement à personnaliser vos recommandations.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
