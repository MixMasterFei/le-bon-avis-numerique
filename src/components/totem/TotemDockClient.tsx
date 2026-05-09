"use client"

import dynamic from "next/dynamic"

// Thin client wrapper so the Server Component layout.tsx can mount
// the dock without triggering Next 16's "ssr:false not allowed in
// Server Components" build error. The dock itself uses localStorage,
// sessionStorage, window events and Radix Dialog portals, so it
// must not run on the server.
const TotemDockInner = dynamic(
  () => import("./TotemDock").then((m) => ({ default: m.TotemDock })),
  { ssr: false },
)

export function TotemDockClient() {
  return <TotemDockInner />
}
