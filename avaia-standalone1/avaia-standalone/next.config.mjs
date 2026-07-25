/** @type {import('next').NextConfig} */

// Avaia is its own site, deployed as a standalone Vercel project at
// avaiainstitute.com (and .org). It serves at the domain root — no basePath,
// no static-export mount. Kept as a normal Next.js app (not `output: export`)
// so the login + Workbook + Claude conversation engine can be added as real
// server routes on the same project, backed by Supabase.
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
