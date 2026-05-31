import { AdminOperationsView } from "@/components/admin/AdminOperationsView"

interface PageProps {
  searchParams?: Promise<{ type?: string }>
}

export default async function AdminOperationsPage(props: PageProps) {
  const searchParams = await props.searchParams
  return <AdminOperationsView initialEnrichType={searchParams?.type} />
}
