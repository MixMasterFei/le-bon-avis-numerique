import type { Metadata } from "next"

// Auth page: keep out of the index, and don't inherit the root canonical "/".
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return children
}
