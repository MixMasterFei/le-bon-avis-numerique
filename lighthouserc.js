/**
 * Lighthouse CI configuration.
 *
 * The base URL is picked up from the LHCI_TARGET_URL env var in the
 * GitHub Action (set to the Vercel preview URL for PRs). Falls back to
 * production for pushes to main. Running locally:
 *
 *   LHCI_TARGET_URL=http://localhost:3000 npx lhci autorun
 *
 * Budgets are deliberately set slightly below "perfect" so legitimate
 * trade-offs (heavy poster images, TMDB backdrops) don't cause noise,
 * while real regressions (blocking scripts, oversized bundles, CLS)
 * still fail fast.
 */

const BASE =
  process.env.LHCI_TARGET_URL ||
  process.env.LHCI_FALLBACK_URL ||
  "https://totemavise.com"

// Strip trailing slash so we build consistent URLs.
const base = BASE.replace(/\/+$/, "")

module.exports = {
  ci: {
    collect: {
      url: [
        `${base}/`,
        `${base}/films`,
        `${base}/inscription`,
        `${base}/connexion`,
      ],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      assertions: {
        // Category scores — warnings so they don't block merges,
        // but visible in the PR comment.
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.85 }],
        "categories:seo": ["warn", { minScore: 0.9 }],

        // Core Web Vitals — errors, these are the real guardrails.
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],

        // Secondary metrics — warnings.
        "total-blocking-time": ["warn", { maxNumericValue: 300 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 1800 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
