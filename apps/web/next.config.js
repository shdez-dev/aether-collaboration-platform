const withPWA = require('next-pwa')({
  dest: 'public',
  // 🔴 PWA DISABLED BY DEFAULT - Change to false to enable PWA features
  disable: process.env.NEXT_PUBLIC_PWA_ENABLED !== 'true',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /^https?:\/\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'others',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@aether/types'],
  // Enable standalone output for Docker/production deployment
  output: 'standalone',
  // Disable ESLint and TypeScript checks during build (run separately in CI)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
  },
  webpack: (config, { isServer }) => {
    // Exclude node-only modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
      };

      // Ignore ws module in client-side bundle
      config.externals = config.externals || [];
      config.externals.push({
        ws: 'ws',
      });
    }
    return config;
  },
};

// 🔴 PWA is DISABLED by default
// To enable: Set NEXT_PUBLIC_PWA_ENABLED=true in your .env file
module.exports = withPWA(nextConfig);
