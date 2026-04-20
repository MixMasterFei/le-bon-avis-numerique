import { auth } from "@/lib/auth"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user

  return <HomepageApercu isLoggedIn={isLoggedIn} serifClass="font-serif" />
}
