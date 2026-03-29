import Image from "next/image"
import Link from "next/link"
import type { PortableTextReactComponents } from "@portabletext/react"
import { urlFor } from "@/sanity/image"

export const portableTextComponents: Partial<PortableTextReactComponents> = {
  block: {
    h2: ({ children }) => (
      <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-lg font-semibold text-gray-900 mt-6 mb-2">{children}</h4>
    ),
    normal: ({ children }) => (
      <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary/30 pl-4 italic text-gray-600 my-6">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4 pl-2">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4 pl-2">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => {
      const href = value?.href || ""
      const isInternal = href.startsWith("/")
      if (isInternal) {
        return (
          <Link href={href} className="text-primary hover:text-primary/80 underline underline-offset-2">
            {children}
          </Link>
        )
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline underline-offset-2"
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
