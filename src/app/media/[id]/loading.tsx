// Route-level skeleton shown instantly while the fiche renders. Mirrors the
// warm redesign of page.tsx (cream background, contained white hero card,
// poster left / main column / family panel right) so the transition to the
// real page is a fade-in, not a theme swap — the previous skeleton still
// mimicked the retired dark hero and flashed navy before every fiche.

const warmCard = {
  background: "var(--color-warm-card)",
  border: "1px solid var(--color-warm-line)",
  boxShadow:
    "0 1px 2px rgba(58,46,34,.05), 0 14px 34px -18px rgba(58,46,34,.18)",
} as const

function Bar({ className }: { className: string }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ background: "var(--color-warm-placeholder)" }}
    />
  )
}

export default function MediaDetailLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-warm-bg)" }}>
      <div className="container mx-auto px-4 pt-6 pb-10">
        {/* Back link */}
        <Bar className="h-6 w-24 mb-6" />

        {/* Hero card */}
        <div className="rounded-2xl p-5 sm:p-7" style={warmCard}>
          <div className="grid gap-6 lg:gap-7 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_320px] lg:items-start">
            {/* Poster */}
            <div className="mx-auto w-40 sm:w-48 lg:mx-0 lg:w-full">
              <div
                className="aspect-[2/3] rounded-xl animate-pulse"
                style={{ background: "var(--color-warm-placeholder)" }}
              />
            </div>

            {/* Main column */}
            <div className="min-w-0 space-y-4">
              {/* Badge pills */}
              <div className="flex gap-2">
                <Bar className="h-6 w-16 !rounded-full" />
                <Bar className="h-6 w-20 !rounded-full" />
                <Bar className="h-6 w-28 !rounded-full" />
              </div>
              {/* Title + original title */}
              <Bar className="h-9 w-3/4" />
              <Bar className="h-5 w-1/3" />
              {/* Age recommendation card */}
              <div
                className="h-24 w-full rounded-xl animate-pulse"
                style={{ background: "var(--color-warm-bg2)" }}
              />
              {/* Synopsis lines */}
              <div className="space-y-2 pt-1">
                <Bar className="h-4 w-full" />
                <Bar className="h-4 w-5/6" />
                <Bar className="h-4 w-2/3" />
              </div>
              {/* Action buttons row */}
              <div className="flex gap-2 pt-1">
                <Bar className="h-10 w-36 !rounded-full" />
                <Bar className="h-10 w-24 !rounded-full" />
                <Bar className="h-10 w-24 !rounded-full" />
              </div>
            </div>

            {/* Family panel (desktop only) */}
            <div
              className="hidden xl:block rounded-xl p-5 space-y-3"
              style={{ background: "var(--color-warm-bg2)" }}
            >
              <Bar className="h-5 w-2/3" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-5/6" />
              <Bar className="h-10 w-full !rounded-full mt-2" />
              <Bar className="h-10 w-full !rounded-full" />
            </div>
          </div>
        </div>

        {/* Content cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 rounded-2xl animate-pulse" style={warmCard} />
            <div className="h-64 rounded-2xl animate-pulse" style={warmCard} />
          </div>
          <div className="space-y-6">
            <div className="h-40 rounded-2xl animate-pulse" style={warmCard} />
            <div className="h-60 rounded-2xl animate-pulse" style={warmCard} />
          </div>
        </div>
      </div>
    </div>
  )
}
