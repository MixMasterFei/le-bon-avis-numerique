"use client"

import { useCallback, useEffect, useState } from "react"
import { Gauge, Loader2, Search, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminPalette } from "../shared/admin-ui"

/**
 * Who may open /steph.
 *
 * /steph is the read-only pilotage console — deliberately open to MODERATOR so
 * someone can follow the project without holding the keys to /admin. But until
 * this panel existed the only way to grant that role was a hand-written SQL
 * UPDATE, so in practice nobody ever had it: the catalogue had 2 admins, 48
 * plain users and zero moderators. A door with no handle is a closed door.
 *
 * ADMIN accounts are shown but not editable here: promoting someone to full
 * admin stays a deliberate act at the database, so this panel can never widen
 * access beyond the read-only console.
 */

type Role = "USER" | "ADMIN" | "MODERATOR"

interface Account {
  id: string
  name: string | null
  email: string
  role: Role
  createdAt: string
}

export function StaffAccessPanel() {
  const p = adminPalette
  const [query, setQuery] = useState("")
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Chargement impossible")
      setAccounts(data.users ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => void load(query), query ? 300 : 0)
    return () => clearTimeout(t)
  }, [query, load])

  async function toggle(account: Account, pilotage: boolean) {
    setSavingId(account.id)
    setError(null)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, pilotage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Modification impossible")
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, role: data.user.role } : a)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modification impossible")
    } finally {
      setSavingId(null)
    }
  }

  const staff = accounts.filter((a) => a.role !== "USER")

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: p.ink2 }}>
        Donner l&apos;accès à <strong>Pilotage</strong> ({" "}
        <code className="text-xs">/steph</code> ) : le tableau de bord en lecture seule, le
        dossier projet et la carte mentale. Aucun bouton d&apos;action, aucune donnée
        modifiable — c&apos;est une console pour comprendre le site, pas pour l&apos;opérer.
        L&apos;accès à <code className="text-xs">/admin</code> n&apos;est pas concerné.
      </p>

      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: p.ink2 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un compte par nom ou e-mail…"
          className="w-full bg-transparent text-sm outline-none"
          style={{ color: p.ink }}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: "#B4483C" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: p.ink2 }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm" style={{ color: p.ink2 }}>
          Aucun compte ne correspond. Si la personne n&apos;a pas encore de compte, elle doit
          d&apos;abord s&apos;inscrire sur le site — l&apos;accès se donne ensuite ici.
        </p>
      ) : (
        <>
          <p className="text-xs" style={{ color: p.ink2 }}>
            {staff.length === 0
              ? "Personne n'a encore l'accès Pilotage."
              : `${staff.length} compte${staff.length > 1 ? "s" : ""} avec accès Pilotage.`}
          </p>

          <ul className="divide-y" style={{ borderColor: p.line2 }}>
            {accounts.map((a) => {
              const isAdmin = a.role === "ADMIN"
              const hasPilotage = a.role === "MODERATOR" || isAdmin
              return (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: p.bg2, color: p.ink2 }}
                  >
                    {isAdmin ? (
                      <ShieldCheck className="h-4 w-4" />
                    ) : hasPilotage ? (
                      <Gauge className="h-4 w-4" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm" style={{ color: p.ink }}>
                      {a.name || "Sans nom"}
                    </span>
                    <span className="block truncate text-xs" style={{ color: p.ink2 }}>
                      {a.email}
                    </span>
                  </span>

                  {isAdmin ? (
                    <span className="shrink-0 text-xs" style={{ color: p.ink2 }}>
                      Administrateur
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={hasPilotage ? "secondary" : "outline"}
                      disabled={savingId === a.id}
                      onClick={() => void toggle(a, !hasPilotage)}
                      className="shrink-0"
                    >
                      {savingId === a.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : hasPilotage ? (
                        "Retirer l'accès"
                      ) : (
                        "Donner l'accès"
                      )}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
