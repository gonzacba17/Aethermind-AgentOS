const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  // output: 'standalone', // Disabled for Windows compatibility - Vercel handles this automatically

  distDir: '.next',
  experimental: {
    instrumentationHook: true,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

const sentryWebpackPluginOptions = {
  org: "aethermind-xt",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  disableLogger: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableServerWebpackPlugin: process.env.NODE_ENV !== "production",
  disableClientWebpackPlugin: process.env.NODE_ENV !== "production",
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
