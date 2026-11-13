/** @type {import('next').NextConfig} */
const common = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'ucarecdn.com' }] },
  async headers() {
    return [
      { source: '/chatbot', headers: common },
      { source: '/((?!chatbot).*)', headers: [...common, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
      { source: '/embed.js', headers: [{ key: 'Cache-Control', value: 'public, max-age=300' }] },
    ]
  },
}

export default nextConfig
