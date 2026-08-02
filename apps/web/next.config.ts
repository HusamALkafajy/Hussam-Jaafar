import type { NextConfig } from 'next';
import { resolveInternalApiOrigin } from './src/config/internal-api-origin';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  compress: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  // Ensure we can proxy or call API directly
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/files',
        permanent: false,
      },
      {
        source: '/upload',
        destination: '/files',
        permanent: false,
      },
      {
        source: '/folders',
        destination: '/files',
        permanent: false,
      },
      {
        source: '/notes',
        destination: '/files',
        permanent: false,
      },
      {
        source: '/subjects',
        destination: '/files',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const internalApiOrigin = resolveInternalApiOrigin();
    return [
      {
        source: '/api/:path*',
        destination: `${internalApiOrigin}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${internalApiOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
