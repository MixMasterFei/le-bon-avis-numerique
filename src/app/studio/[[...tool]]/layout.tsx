export const metadata = {
  title: "Studio — Totem Avisé",
  robots: { index: false, follow: false },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-white">
      {children}
    </div>
  )
}
