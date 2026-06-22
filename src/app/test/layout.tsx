import type { Metadata } from "next"

// Internal/dev test pages: never index, and don't inherit the root canonical "/".
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
