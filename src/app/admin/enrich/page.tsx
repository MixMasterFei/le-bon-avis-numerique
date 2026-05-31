import { redirect } from "next/navigation"

interface PageProps {
  searchParams?: Promise<{ type?: string }>
}

export default async function EnrichRedirectPage(props: PageProps) {
  const searchParams = await props.searchParams
  const q = searchParams?.type ? `?type=${encodeURIComponent(searchParams.type)}` : ""
  redirect(`/admin/operations${q}#enrich`)
}
