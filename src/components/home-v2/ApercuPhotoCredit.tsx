// Small overlay pill rendered in the bottom-right corner of every
// news card image. Mirrors the Perplexity pattern where the source
// of the photo is always visible (e.g. "adweek.com" on their hero).
//
// Two modes:
//   - STOCK images get a clickable link back to the Pexels/Unsplash
//     source page (free-tier license requirement).
//   - PUBLISHER_RSS / PUBLISHER_OG / AGENCY get plain text — clicking
//     the card already navigates to the story; we don't want to
//     traffic-launder a backlink to the publisher from the credit pill.

export interface PhotoCreditProps {
  credit: string | null | undefined
  licenseUrl?: string | null | undefined
}

export function ApercuPhotoCredit({ credit, licenseUrl }: PhotoCreditProps) {
  if (!credit) return null

  const baseClass =
    "absolute bottom-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded text-[10px] leading-none font-medium tracking-tight max-w-[60%] truncate"
  const baseStyle = {
    background: "rgba(0,0,0,0.55)",
    color: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(2px)",
  } as const
  const label = `Photo : ${credit}`

  if (licenseUrl) {
    return (
      <a
        href={licenseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClass} hover:bg-black/70 transition-colors`}
        style={baseStyle}
        title={label}
        // Stop the click bubbling up to the card's <Link> wrapper —
        // otherwise clicking the credit would also navigate to the
        // story instead of opening the photo source.
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>
    )
  }

  return (
    <span className={baseClass} style={baseStyle} title={label}>
      {label}
    </span>
  )
}
