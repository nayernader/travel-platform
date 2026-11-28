import type { NextConfig } from "next";

// The NestJS backend. The browser only ever talks to the Next.js server (http://localhost:3000),
// which forwards /api and /uploads to the backend. Same origin = the httpOnly login cookies just work, no CORS.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Our pages load their data in the browser (login check, useApi), so the dev-only
    // "instant navigation" check would warn on every page. Only check pages that opt in.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BACKEND_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
