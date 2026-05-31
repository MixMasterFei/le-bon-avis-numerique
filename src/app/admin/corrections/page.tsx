import { redirect } from "next/navigation"

export default function CorrectionsRedirectPage() {
  redirect("/admin/operations#moderation")
}
