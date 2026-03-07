export default function MediaDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero skeleton — matches actual dark hero layout */}
      <div className="relative bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="container mx-auto px-4 py-8">
          {/* Back button */}
          <div className="h-10 w-24 bg-white/10 rounded-full mb-8 animate-pulse" />

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
            {/* Poster skeleton */}
            <div className="lg:w-1/4 shrink-0">
              <div className="aspect-[2/3] rounded-xl bg-white/10 animate-pulse" />
            </div>

            {/* Info skeleton */}
            <div className="flex-1 space-y-4">
              {/* Badges */}
              <div className="flex gap-3">
                <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
              </div>
              {/* Title */}
              <div className="h-8 w-3/4 bg-white/10 rounded animate-pulse" />
              {/* Meta line */}
              <div className="h-5 w-1/2 bg-white/10 rounded animate-pulse" />
              {/* Synopsis lines */}
              <div className="space-y-2 pt-2">
                <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-white/10 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-white/10 rounded animate-pulse" />
              </div>
              {/* Rating bar */}
              <div className="h-16 w-full bg-white/10 rounded-xl animate-pulse mt-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
