import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"
import { schemaTypes } from "./src/sanity/schemas"
import { projectId, dataset } from "./src/sanity/env"

export default defineConfig({
  name: "totem-avise-blog",
  title: "Totem Avisé — Blog",
  projectId,
  dataset,
  plugins: [structureTool()],
  schema: { types: schemaTypes },
})
