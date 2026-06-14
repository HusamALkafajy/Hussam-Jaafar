import type { NextConfig } from 'next';

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
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'http://api:4000/api/:path*' // Docker backend container name
          : 'http://localhost:4000/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: process.env.NODE_ENV === 'production'
          ? 'http://api:4000/uploads/:path*'
          : 'http://localhost:4000/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
