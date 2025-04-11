/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.pexels.com', 'www.gravatar.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
}

export default nextConfig
