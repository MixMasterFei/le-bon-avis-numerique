export default function SeriesLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <div className="space-y-3">
        <div className="h-10 w-48 bg-violet-100 rounded-lg animate-pulse" />
        <div className="h-5 w-72 bg-gray-100 rounded animate-pulse" />
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-4">
          <div className="h-7 w-56 bg-violet-50 rounded animate-pulse" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="flex-shrink-0 w-44 space-y-2">
                <div className="h-64 w-44 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
