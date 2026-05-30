import { methodeIntro, methodeSections } from "@/app/notre-methode/notre-methode.data"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 86400

const MD_HEADERS: Record<string, string> = {
  "Content-Type": "text/markdown; charset=utf-8",
  "X-Robots-Tag": "noindex, follow",
  "Link": `<${baseUrl}/notre-methode>; rel="canonical"`,
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
}

export async function GET() {
  const lines: string[] = []
  lines.push(`# ${methodeIntro.title}`, "")
  lines.push(`URL canonique: ${baseUrl}/notre-methode`)
  lines.push(`Langue: français`)
  lines.push("")
  lines.push(methodeIntro.lead, "")

  for (const section of methodeSections) {
    lines.push(`## ${section.title}`, "")
    for (const par of section.content) {
      lines.push(par, "")
    }
    if (section.list) {
      for (const item of section.list) {
        lines.push(`- **${item.label}** — ${item.desc}`)
      }
      lines.push("")
    }
    if (section.after) {
      lines.push(section.after, "")
    }
  }

  return new Response(lines.join("\n"), { headers: MD_HEADERS })
}
