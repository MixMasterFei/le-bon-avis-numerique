import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aperçu fiche film · Totem Avisé",
  description: "Aperçu interne du design v2 pour la fiche film. Non public.",
  robots: { index: false, follow: false },
}

export default function ApercuFilmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
