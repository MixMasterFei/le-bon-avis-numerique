import { redirect } from "next/navigation"

export default function RequestsRedirectPage() {
  redirect("/admin/operations#moderation")
}
