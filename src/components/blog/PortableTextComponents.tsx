import Image from "next/image"
import Link from "next/link"
import type { PortableTextReactComponents } from "@portabletext/react"
import { urlFor } from "@/sanity/image"

export const portableTextComponents: Partial<PortableTextReactComponents> = {
  block: {
    h2: ({ children }) => (
      <h2
        className="font-serif mt-10 mb-4 text-2xl md:text-3xl font-medium leading-tight"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3
        className="font-serif mt-8 mb-3 text-xl md:text-2xl font-medium leading-tight"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className="font-serif mt-6 mb-2 text-lg md:text-xl font-medium leading-tight"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </h4>
    ),
    normal: ({ children }) => (
      <p
        className="mb-7 last:mb-0 text-[17px] leading-[1.7] md:text-[18px]"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </p>
    ),
    blockquote: ({ children }) => (
      <blockquote
        className="font-serif my-7 border-l-[3px] pl-5 text-lg italic leading-snug md:text-xl"
        style={{ borderColor: "var(--color-accent)", color: "var(--color-ink2)" }}
      >
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul
        className="mb-7 list-disc space-y-2 pl-6 text-[17px] leading-[1.7] md:text-[18px]"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol
        className="mb-7 list-decimal space-y-2 pl-6 text-[17px] leading-[1.7] md:text-[18px]"
        style={{ color: "var(--color-ink)" }}
      >
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-semibold" style={{ color: "var(--color-ink)" }}>
        {children}
      </strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => {
      const href = value?.href || ""
      const isInternal = href.startsWith("/")
      if (isInternal) {
        return (
          <Link
            href={href}
            className="underline underline-offset-4 transition-opacity hover:opacity-70"
            style={{ color: "var(--color-accent)" }}
          >
            {children}
          </Link>
        )
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--color-accent)" }}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    image: ({ value }) => {
      const imageUrl = urlFor(value)?.width(800).auto("format").url()
      if (!imageUrl) return null
      return (
        <figure className="my-8">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden">
            <Image
              src={imageUrl}
              alt={value.alt || ""}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px"
            />
          </div>
          {value.caption && (
            <figcaption className="text-sm text-gray-500 text-center mt-2">
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },
  },
}
