/**
 * V2 family monogram — a colored circle with the member's first two letters.
 * Replaces the DiceBear MemberAvatar inside the V2 family surfaces (the
 * catalogue "Adapter à" rows + the "POUR" appreciation meters) per the
 * claude-design, which uses simple member-color monograms rather than
 * generated avatars. Scoped to V2; the global MemberAvatar is untouched.
 */
export function MemberMonogram({
  name,
  color,
  size = 24,
}: {
  name: string
  color: string
  size?: number
}) {
  const letters = name.trim().slice(0, 2)
  const initials = letters
    ? letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()
    : "?"

  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.42),
        fontFamily: "var(--font-bricolage)",
        letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </span>
  )
}
