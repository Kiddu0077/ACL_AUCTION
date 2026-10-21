import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  experimental: {
    // Auction mutations update live clients without re-rendering whole routes.
    // Fetch fresh dynamic pages on navigation instead of reusing a 30s snapshot.
    staleTimes: { dynamic: 0 },
  },
  async redirects() {
    return [{ source: "/register", destination: "/pudurleague_registration", permanent: true }];
  },
  images: {
    // Bypass Vercel's Image Optimization proxy — we hit the free-tier quota
    // and it returns HTTP 402 for every subsequent request, breaking all
    // player photos on the live site. Serving images direct from Supabase
    // (no /_next/image transformation) is unlimited and stable.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // pptxgenjs's ES build imports `node:fs` / `node:https` for its Node
    // codepath. Strip the `node:` prefix, then null out the bare names —
    // its `browser` field already maps them to no-ops.
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;
