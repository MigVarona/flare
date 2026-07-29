import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@flare/core'],
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://flare-app.web.app/__/auth/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.giphy.com',
      },
    ],
  },
};

export default nextConfig;
