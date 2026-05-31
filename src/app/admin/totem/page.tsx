import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { TotemControlTower } from "@/components/admin/totem/TotemControlTower"

export const dynamic = "force-dynamic"

export default async function AdminTotemPage() {
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

  return <TotemControlTower />
}
