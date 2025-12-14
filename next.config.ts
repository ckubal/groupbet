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
  webpack: (config, { isServer }) => {
    // Exclude firebase-admin from client-side bundle
    // It uses Node.js modules (net, tls, fs) that aren't available in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
      
      // Exclude firebase-admin from client bundle
      config.externals = config.externals || [];
      config.externals.push({
        'firebase-admin': 'commonjs firebase-admin',
        '@firebase/database-compat': 'commonjs @firebase/database-compat',
      });
    }
    
    return config;
  },
};

export default nextConfig;
