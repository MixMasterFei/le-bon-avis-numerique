import { renderApercuDecouvertePage } from "@/components/home-v2/renderApercuDecouvertePage"

interface SearchParams {
  font?: string
}

// V5 "Actualités de confiance": the canonical news feed. Only stories whose
// every contributing source is official — government / public institution
// (FR + EU) or recognized child-welfare nonprofit (see NewsStory.official,
// set strictly at ingestion). Lower legal exposure than V4's broad press
// feed, so it reuses the directSource image path safely. Admin-only.
export const dynamic = "force-dynamic"

export default async function ApercuDecouverteV5Page(props: {
  searchParams?: Promise<SearchParams>
}) {
  return renderApercuDecouvertePage(props, {
    callbackUrl: "/apercudecouverte-v5",
    imagePolicy: "directSource",
    officialOnly: true,
  })
}
