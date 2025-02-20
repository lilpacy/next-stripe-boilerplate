import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    newDevOverlay: true,
  },
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: "http://localhost:8787/api/:path*",
    },
  ],
};

export default nextConfig;
