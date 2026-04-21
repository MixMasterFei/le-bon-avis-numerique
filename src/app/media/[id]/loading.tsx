import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

export default function MediaDetailLoading() {
  const p = APERCU_PALETTE
  const block = (extra: string = "") => ({
    className: `rounded-xl animate-pulse ${extra}`,
    style: { background: p.placeholder },
  })

  return (
    <div
      className="flex flex-col overflow-x-hidden min-h-screen"
      style={{ background: p.bg, color: p.ink }}
    >
      {/* Hero skeleton — matches warm hero layout */}
      <section className="relative" style={{ background: p.bg }}>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              rgba(209, 106, 74, 0.08) 0%,
              rgba(245, 241, 233, 0.80) 45%,
              ${p.bg} 100%)`,
          }}
        />
        <div className="container mx-auto px-4 md:px-8 pt-4 md:pt-6 pb-10 md:pb-14 relative">
          <div className="h-5 w-20 rounded-full mb-8 animate-pulse" style={{ background: p.placeholder }} />

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
            {/* Poster */}
            <div className="lg:w-1/4 shrink-0">
              <div
                className="relative aspect-[2/3] rounded-2xl animate-pulse mx-auto lg:mx-0 max-w-[280px] lg:max-w-none"
                style={{ background: p.placeholder }}
              />
            </div>

            {/* Info column */}
            <div className="flex-1 space-y-4">
              <div className="flex gap-3">
                <div className="h-6 w-16 rounded-full animate-pulse" style={{ background: p.placeholder }} />
                <div className="h-6 w-20 rounded-full animate-pulse" style={{ background: p.placeholder }} />
              </div>
              <div className="h-10 w-3/4 rounded animate-pulse" style={{ background: p.placeholder }} />
              <div className="h-5 w-1/2 rounded animate-pulse" style={{ background: p.placeholder }} />
              <div className="space-y-2 pt-2">
                <div className="h-4 w-full rounded animate-pulse" style={{ background: p.placeholder }} />
                <div className="h-4 w-5/6 rounded animate-pulse" style={{ background: p.placeholder }} />
                <div className="h-4 w-2/3 rounded animate-pulse" style={{ background: p.placeholder }} />
              </div>
              <div {...block("h-16 w-full mt-4")} />
            </div>

            {/* Family-fit widget skeleton */}
            <div className="lg:w-72 xl:w-80 shrink-0">
              <div {...block("h-56 w-full")} />
            </div>
          </div>
        </div>
      </section>

      {/* Body skeleton on bg2 */}
      <section className="py-8 md:py-12" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div {...block("h-56 w-full")} />
              <div {...block("h-64 w-full")} />
            </div>
            <div className="space-y-8">
              <div {...block("h-52 w-full")} />
              <div {...block("h-72 w-full")} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
