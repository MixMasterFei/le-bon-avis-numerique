interface Span { _type: string; text?: string; marks?: string[] }
interface Mark { _key: string; _type: string; href?: string }
export interface EditorialBlock {
  _type: string; style?: string; children?: Span[]; markDefs?: Mark[]
  listItem?: string; level?: number; alt?: string; caption?: string
  asset?: { _ref?: string }
}
function escapeText(text: string) { return text.replace(/[\\`*_[\]<>]/g, "\\$&") }
export function editorialUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl)
    return ["https:", "http:"].includes(url.protocol) ? url.href.replace(/\(/g, "%28").replace(/\)/g, "%29") : null
  } catch { return null }
}

/** Published Portable Text only. Preserve headings, source links, lists,
 * quotations, image descriptions and captions without a second editorial copy. */
export function portableTextMarkdown(blocks: EditorialBlock[], baseUrl: string, imageUrl?: (block: EditorialBlock) => string | null): string {
  const lines: string[] = []
  for (const block of blocks) {
    if (block._type === "image") {
      const image = imageUrl?.(block)
      const url = image ? editorialUrl(image, baseUrl) : null
      if (url) lines.push(`![${escapeText(block.alt ?? "")}](${url})`, "")
      else if (block.alt) lines.push(`Illustration : ${escapeText(block.alt)}`, "")
      if (block.caption) lines.push(escapeText(block.caption), "")
      continue
    }
    if (block._type !== "block") continue
    const text = (block.children ?? []).map((span) => {
      let value = escapeText(span.text ?? "")
      for (const mark of span.marks ?? []) {
        if (mark === "strong") value = `**${value}**`
        else if (mark === "em") value = `*${value}*`
        else if (mark === "code") value = `\`${(span.text ?? "").replace(/`/g, "ˋ")}\``
        else if (mark === "strike-through") value = `~~${value}~~`
        else {
          const definition = block.markDefs?.find((m) => m._key === mark && m._type === "link")
          const href = definition?.href ? editorialUrl(definition.href, baseUrl) : null
          if (href) value = `[${value}](${href})`
        }
      }
      return value
    }).join("")
    const heading = /^h[1-6]$/.test(block.style ?? "") ? `${"#".repeat(Number(block.style![1]))} ` : ""
    if (block.listItem) {
      const indent = "    ".repeat(Math.max(0, Math.min((block.level ?? 1) - 1, 8)))
      lines.push(`${indent}${block.listItem === "number" ? "1." : "-"} ${text.replace(/\n/g, `\n${indent}    `)}`, "")
    } else if (block.style === "blockquote") lines.push(text.split("\n").map((line) => `> ${line}`).join("\n"), "")
    else lines.push(`${heading}${text}`, "")
  }
  return lines.join("\n").trim()
}
