import { defineField, defineType } from "sanity"

export const post = defineType({
  name: "post",
  title: "Article de blog",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Titre",
      type: "string",
      validation: (rule) => rule.required().min(10).max(120),
    }),
    defineField({
      name: "slug",
      title: "Slug (URL)",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "author",
      title: "Auteur",
      type: "string",
      initialValue: "L'équipe Totem Avisé",
    }),
    defineField({
      name: "publishedAt",
      title: "Date de publication",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "category",
      title: "Catégorie",
      type: "string",
      options: {
        list: [
          { title: "Temps d'écran", value: "temps-ecran" },
          { title: "Films & séries", value: "films-series" },
          { title: "Jeux vidéo", value: "jeux-video" },
          { title: "Parentalité numérique", value: "parentalite-numerique" },
          { title: "Guides pratiques", value: "guides-pratiques" },
          { title: "Actualités", value: "actualites" },
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Résumé (affiché sur les cartes et dans les résultats Google)",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required().min(50).max(300),
    }),
    defineField({
      name: "mainImage",
      title: "Image principale",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Texte alternatif",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Contenu",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Texte alternatif",
              type: "string",
            }),
            defineField({
              name: "caption",
              title: "Légende",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "seoTitle",
      title: "Titre SEO (optionnel — remplace le titre dans les résultats Google)",
      type: "string",
      validation: (rule) => rule.max(70),
    }),
    defineField({
      name: "seoDescription",
      title: "Description SEO (optionnel — remplace le résumé dans Google)",
      type: "text",
      rows: 2,
      validation: (rule) => rule.max(160),
    }),
  ],
  preview: {
    select: {
      title: "title",
      author: "author",
      media: "mainImage",
      category: "category",
    },
    prepare({ title, author, media, category }) {
      return {
        title,
        subtitle: `${category || "Sans catégorie"} — ${author || "Anonyme"}`,
        media,
      }
    },
  },
  orderings: [
    {
      title: "Date de publication (récent)",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
})
