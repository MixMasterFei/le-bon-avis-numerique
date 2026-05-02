import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

interface SearchParams {
  font?: string
  cat?: string
}

/**
 * /apercudecouverte was previously the "digest" landing — one feature
 * story + a few rails. Xavier found it too sparse: users have to click
 * through to see the rest of the news. Redirecting to /actualites gives
 * the all-news view as the default landing instead. Auth check stays
 * here so unauthenticated visitors still get bounced to /connexion.
 *
 * To restore the digest landing later, swap this back to the previous
 * implementation (see git history for `DecouverteDigest` usage).
 */
export default async function ApercuDecouvertePage(props: {
  searchParams?: Promise<SearchParams>
}) {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/connexion?callbackUrl=/apercudecouverte")
  }
  if (!session?.user?.id) {
    redirect("/connexion?callbackUrl=/apercudecouverte")
  }

  // Forward query params (font, cat) so deep links keep working.
  const sp = (await props.searchParams) ?? {}
  const qs = new URLSearchParams()
  if (sp.font) qs.set("font", sp.font)
  if (sp.cat) qs.set("cat", sp.cat)
  const target = qs.toString()
    ? `/apercudecouverte/actualites?${qs.toString()}`
    : "/apercudecouverte/actualites"

  redirect(target)
}
