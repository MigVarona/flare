import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@flare/core'],
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
