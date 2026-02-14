export default function MediaDetailLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero banner skeleton */}
      <div className="relative h-[400px] bg-gradient-to-b from-violet-100 to-gray-50 animate-pulse" />

      <div className="container mx-auto px-4 -mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster skeleton */}
          <div className="flex-shrink-0">
            <div className="w-64 h-96 bg-gray-200 rounded-2xl animate-pulse shadow-xl" />
          </div>

          {/* Info skeleton */}
          <div className="flex-1 space-y-4 pt-4">
            <div className="h-10 w-3/4 bg-white/80 rounded-lg animate-pulse" />
            <div className="flex gap-2">
              <div className="h-8 w-16 bg-violet-100 rounded-full animate-pulse" />
              <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
              <div className="h-8 w-24 bg-gray-100 rounded-full animate-pulse" />
            </div>
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-4/6 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="mt-10 space-y-6">
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-28 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
