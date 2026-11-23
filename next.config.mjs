/** @type {import('next').NextConfig} */
const isGhPages = process.env.GITHUB_PAGES === 'true'

const nextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['192.168.1.36'],

  // Static export so it can be hosted on GitHub Pages.
  output: 'export',
  trailingSlash: true,
  // Project sites are served at /<repo>/; local dev stays at /.
  basePath: isGhPages ? '/Task' : '',
  assetPrefix: isGhPages ? '/Task/' : '',

  images: { unoptimized: true },
}

export default nextConfig
