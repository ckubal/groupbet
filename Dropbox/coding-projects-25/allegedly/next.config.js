/** @type {import('next').NextConfig} */
const nextConfig = {
  // Better development experience
  poweredByHeader: false,
  
  // Experimental features
  experimental: {
    turbopack: true, // Keep Turbopack enabled for faster builds
  },

  // Better error handling and performance
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Development optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // PWA configuration will be added here later
}

module.exports = nextConfig