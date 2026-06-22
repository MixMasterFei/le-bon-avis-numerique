import type { Metadata } from "next"

// Transactional auth page: noindex, and don't inherit the root canonical "/".
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function VerifierEmailLayout({ children }: { children: React.ReactNode }) {
  return children
}
