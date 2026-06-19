import { renderApercuDecouvertePage } from "../apercudecouverte-v3/page"

interface SearchParams {
  font?: string
}

// V4 "Actualités": the clean feed. Renders each story's raw publisher image
// straight from the RSS feed (no stock/official-press/catalog/editorial
// substitution, no Supabase re-host), with a branded category card only when
// a story has no real photo. See the "directSource" policy in rowToCard.
export const dynamic = "force-dynamic"

export default async function ApercuDecouverteV4Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  return renderApercuDecouvertePage(props, {
    callbackUrl: "/apercudecouverte-v4",
    imagePolicy: "directSource",
  })
}
