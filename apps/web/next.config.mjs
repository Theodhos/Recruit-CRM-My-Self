/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' copies traced dependencies with symlinks, which Windows only
  // allows for admins / Developer Mode (`next build` fails with EPERM). Docker
  // and CI build on Linux and keep it; set NEXT_OUTPUT_STANDALONE=1 to force it.
  ...(process.platform !== 'win32' || process.env.NEXT_OUTPUT_STANDALONE === '1'
    ? { output: 'standalone' }
    : {}),
  // Allow importing TS source directly from workspace packages without a
  // separate build step for each (Turborepo handles the actual build graph).
  transpilePackages: ['@crm/ui', '@crm/types', '@crm/utils', '@crm/validation'],
  // pdfjs-dist (the CV editor) mentions the Node-only 'canvas' package; the browser build never loads it
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // Production on Vercel: the browser talks to /api/v1 on the SAME origin as the site and Next forwards it to the API
  // (API_PROXY_TARGET, e.g. https://my-api.onrender.com). That keeps the httpOnly session cookies first-party, so the
  // login cookie is accepted and visible to the middleware. Unset (local dev) = no rewrite, the app calls the API directly.
  async rewrites() {
    const target = (process.env.API_PROXY_TARGET ?? '').replace(/\/$/, '');
    return target ? [{ source: '/api/v1/:path*', destination: `${target}/api/v1/:path*` }] : [];
  },
  experimental: {
    // Per-icon/per-component imports instead of pulling the whole package
    // into every route that uses one icon or one chart — the icon set and
    // recharts are both large enough for this to matter.
    optimizePackageImports: ['@crm/ui', 'recharts'],
  },
};

export default nextConfig;
