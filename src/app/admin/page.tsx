import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { fetchAdminKpis, serializeAdminKpis } from "@/lib/admin-kpis"
import { AdminDashboardView } from "@/components/admin/AdminDashboardView"

export const dynamic = "force-dynamic"
export const revalidate = 60

export default async function AdminDashboardPage() {
  let session
  try {
    session = await auth()
  } catch {
    redirect("/")
  }
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== "ADMIN" && role !== "MODERATOR") {
    redirect("/")
  }

  const kpis = await fetchAdminKpis()
  return <AdminDashboardView kpis={serializeAdminKpis(kpis)} />
}
