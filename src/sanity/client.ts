import { createClient } from "@sanity/client"
import { projectId, dataset, apiVersion } from "./env"

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true, // Published content is public — no token needed
})
