import { auth } from "@/lib/auth"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"
import { ApercuTimeAwareHero } from "@/components/home-v2/ApercuTimeAwareHero"

export default async function HomePage() {
  const session = await auth()
  const isLoggedIn = !!session?.user
  const isAdmin = session?.user?.role === "ADMIN"

  // Time-aware hero is built server-side here and passed down as a
  // slot. HomepageApercu is "use client", so async server components
  // can't be imported there directly — only composed in via prop.
  const topSlot = <ApercuTimeAwareHero serifClass="font-serif" />

  return (
    <HomepageApercu
      isLoggedIn={isLoggedIn}
      isAdmin={isAdmin}
      serifClass="font-serif"
      topSlot={topSlot}
    />
  )
}
