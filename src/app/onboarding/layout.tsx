import type { Metadata } from "next"

// Authenticated onboarding flow: noindex, and don't inherit the root canonical "/".
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
