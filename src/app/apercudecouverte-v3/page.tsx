import { redirect } from "next/navigation"

// V3 decommissioned (June 2026). The shared renderer moved to
// src/components/home-v2/renderApercuDecouvertePage.tsx and the canonical
// news feed is now V5 (trusted official sources). This stub keeps old
// bookmarks / Totem links / callbackUrls working. The former /historique
// archive was dropped with V3.
export default function ApercuDecouverteV3Redirect() {
  redirect("/apercudecouverte-v5")
}
