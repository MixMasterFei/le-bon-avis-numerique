import type { Metadata } from "next"

// Self-canonical so /apps doesn't inherit the root layout's canonical "/".
// (Currently omitted from the sitemap — if/when the apps vertical is launched,
// keep this canonical and add /apps to src/app/sitemap.ts.)
export const metadata: Metadata = {
  alternates: { canonical: "/apps" },
}

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return children
}
