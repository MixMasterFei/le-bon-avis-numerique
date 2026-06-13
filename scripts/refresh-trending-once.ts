/**
 * One-off: run the "tendance du moment" refresh manually and print stats.
 * Safe to delete. Useful to populate trendingScore right after the
 * migration / on demand without an admin session.
 *   npx tsx scripts/refresh-trending-once.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { refreshTrending } from "../src/lib/trending"

async function main() {
  const start = Date.now()
  const stats = await refreshTrending()
  const secs = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`Trending refresh done in ${secs}s:`, stats)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
