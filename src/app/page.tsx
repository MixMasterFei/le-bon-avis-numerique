import { auth } from "@/lib/auth"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"
import { canUseTotem } from "@/lib/totem/access"

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user
  const isAdmin = session?.user?.role === "ADMIN"
  const totemEnabled = canUseTotem({ isAuthenticated: isLoggedIn, role: session?.user?.role ?? null })

  return (
    <HomepageApercu
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      serifClass="font-serif"
      totemEnabled={totemEnabled}
    />
  )
}
