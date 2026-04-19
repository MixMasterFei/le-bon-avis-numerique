import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ApercuInscription } from "@/components/home-v2/ApercuInscription"
import { fraunces } from "@/components/home-v2/apercuFont"
import { isFraunces } from "@/components/home-v2/apercuTheme"

export const dynamic = "force-dynamic"

const OWNER_EMAIL = "masterfei@gmail.com"

interface SearchParams {
  font?: string
}

export default async function ApercuInscriptionPage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const user = session?.user as
    | { email?: string | null; role?: string }
    | undefined
  const isOwner =
    user?.email === OWNER_EMAIL || user?.role === "ADMIN"
  if (!isOwner) redirect("/")

  const searchParams = await props.searchParams
  const useFraunces = isFraunces(searchParams?.font)
  const serifClass = useFraunces
    ? fraunces.className
    : "font-[var(--font-heading)]"

  return (
    <div className={useFraunces ? fraunces.variable : undefined}>
      <ApercuInscription serifClass={serifClass} />
    </div>
  )
}
