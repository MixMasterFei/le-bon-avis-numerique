import type { Metadata } from "next"

// Auth utility page: noindex, and don't inherit the root canonical "/".
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function ReinitialiserMotDePasseLayout({ children }: { children: React.ReactNode }) {
  return children
}
