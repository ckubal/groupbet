import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix turbopack root directory warning
  turbopack: {
    root: __dirname,
  },
  // Ensure proper module resolution
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
