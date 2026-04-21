import { auth } from "@/lib/auth"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user
  const isAdmin = session?.user?.role === "ADMIN"

  return <HomepageApercu isLoggedIn={isLoggedIn} isAdmin={isAdmin} serifClass="font-serif" />
}
