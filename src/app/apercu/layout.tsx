import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aperçu — Totem Avisé",
  description: "Aperçu interne du design v2 — non public.",
  robots: { index: false, follow: false },
}

export default function ApercuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        Hide the global site <Footer /> on this route so the apercu
        page can render its own warm-palette footer without the
        violet site footer stacking underneath.
      */}
      <style>{`body > footer:not([data-apercu-footer]) { display: none !important; }`}</style>
      {children}
    </>
  )
}
