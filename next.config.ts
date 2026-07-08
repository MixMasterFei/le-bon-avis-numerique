import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Enable production source maps temporarily — needed to debug the
  // React #418 hydration crash on the Aperçu news feeds (shared
  // ApercuDecouverteV3 component, now used by v4/v5) (the minified
  // stack trace just shows React internals like rK/io/sc with no
  // component name). Revert this once the culprit is fixed; adds
  // ~50KB to the bundle but no runtime perf cost.
  productionBrowserSourceMaps: true,
  experimental: {
    scrollRestoration: true,
  },
  images: {
    // Optimization ON (AVIF/WebP + responsive resizing). Every remote host that
    // reaches next/image must be listed below, OR the render passes
    // `unoptimized` (used on the news cards that hotlink arbitrary publisher
    // CDNs — those hosts can't be enumerated). See the news components.
    formats: ["image/avif", "image/webp"],
    // Poster/cover art is immutable (content-addressed TMDB/IGDB/Books URLs), so
    // cache an optimized variant for 31 days. This lifts the /_next/image cache
    // hit-rate (repeat views + re-crawls stop re-invoking the optimizer) — the
    // 38% miss rate was turning a bot/crawler burst across the catalogue into a
    // Function-Invocation + Edge-Request spike.
    minimumCacheTTL: 60 * 60 * 24 * 31, // 31 days
    // Pin the single quality the app renders at. Without this the optimizer
    // accepts any q=1..100, so one poster URL can fan out into ~100 distinct
    // optimization jobs (invocations) for a crawler probing the query string.
    qualities: [75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        // Google OAuth profile avatars (user.image) — rendered by UserAvatar
        // and review cards. lh3..lh6 are the load-balanced variants.
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "image.api.playstation.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images-na.ssl-images-amazon.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.themoviedb.org",
        pathname: "/assets/**",
      },
      {
        protocol: "https",
        hostname: "images.igdb.com",
        pathname: "/igdb/image/upload/**",
      },
      {
        protocol: "https",
        hostname: "books.google.com",
        pathname: "/books/**",
      },
      {
        protocol: "https",
        hostname: "compressed.photo.goodreads.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces (requires SENTRY_AUTH_TOKEN)
  org: "xavier-manzanares",
  project: "javascript-nextjs",

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,
});
