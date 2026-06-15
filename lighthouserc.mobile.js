/**
 * Mobile Lighthouse — REPORT ONLY.
 *
 * Complements lighthouserc.js (which runs a DESKTOP preset on a fast network
 * and is the real merge guardrail). This config runs Lighthouse's default
 * MOBILE profile (Moto G4 / slow-4G emulation) so we can see the real phone
 * experience — the audience is families on phones, and the desktop run can't
 * catch mobile LCP regressions (e.g. from the V2 fonts/chunk once
 * HOMEPAGE_V2_PUBLIC is flipped).
 *
 * Every assertion is a WARNING: mobile numbers swing with TMDB image weight, so
 * we don't gate merges on them — this is visibility, not a gate. Read the
 * printed LCP/CLS (or the temporary-public-storage report link) in the CI log.
 */
const BASE =
  process.env.LHCI_TARGET_URL ||
  process.env.LHCI_FALLBACK_URL ||
  "https://totemavise.com"

const base = BASE.replace(/\/+$/, "")

// Same Deployment-Protection bypass the desktop config uses, so Chrome can load
// protected Vercel previews.
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHeaders = bypass ? { "x-vercel-protection-bypass": bypass } : undefined

module.exports = {
  ci: {
    collect: {
      url: [`${base}/`, `${base}/films`],
      numberOfRuns: 1,
      settings: {
        // No `preset` → lhci defaults to its mobile profile (mobile emulation +
        // slow-4G + 4× CPU slowdown), which is what we want to measure here.
        ...(extraHeaders ? { extraHeaders } : {}),
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 600 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 3000 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
