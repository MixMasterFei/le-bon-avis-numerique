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
  // Books / BD / apps aren't part of the offering (catalog is films / séries
  // / jeux). The routes were removed; redirect their URLs — /livres was in the
  // sitemap and may be indexed — permanently (308) to home instead of 404-ing.
  async redirects() {
    return [
      { source: "/livres", destination: "/", permanent: true },
      { source: "/livres/:path*", destination: "/", permanent: true },
      { source: "/bd", destination: "/", permanent: true },
      { source: "/bd/:path*", destination: "/", permanent: true },
      { source: "/apps", destination: "/", permanent: true },
      { source: "/apps/:path*", destination: "/", permanent: true },
      { source: "/notre-histoire", destination: "/a-propos", permanent: true },
    ]
  },
  images: {
    // Optimization ON (AVIF/WebP + responsive resizing). Every remote host that
    // reaches next/image must be listed below, OR the render passes
    // `unoptimized` (used on the news cards that hotlink arbitrary publisher
    // CDNs — those hosts can't be enumerated). See the news components.
    formats: ["image/avif", "image/webp"],
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
