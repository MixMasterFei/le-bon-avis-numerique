import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aperçu · Totem Avisé",
  description: "Aperçu interne du design v2. Non public.",
  robots: { index: false, follow: false },
}

export default function ApercuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        Scoped overrides for the apercu route only:
        - Hide the global violet <Footer /> so our warm ApercuFooter
          is the only one shown.
        - Tint the sticky site <Header /> to the warm cream palette so
          it stops breaking the art direction at the top of the page.
      */}
      <style>{`
        body > footer:not([data-apercu-footer]) { display: none !important; }
        body > header {
          background-color: #F5F1E9 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          border-bottom-color: rgba(30,26,21,0.08) !important;
        }
      `}</style>
      {children}
    </>
  )
}
