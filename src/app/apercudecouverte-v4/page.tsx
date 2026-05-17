import { renderApercuDecouvertePage } from "../apercudecouverte-v3/page"

interface SearchParams {
  font?: string
}

// V4 is intentionally a visual A/B variant of V3: same component tree,
// same layout, but media cards use the strict legal-safe image policy.
export const dynamic = "force-dynamic"

export default async function ApercuDecouverteV4Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  return renderApercuDecouvertePage(props, {
    callbackUrl: "/apercudecouverte-v4",
    imagePolicy: "safeFallback",
  })
}
