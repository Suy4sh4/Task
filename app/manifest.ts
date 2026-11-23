import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const base = process.env.GITHUB_PAGES === 'true' ? '/Task' : ''

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Task',
    short_name: 'Task',
    display: 'standalone',
    start_url: `${base}/`,
    background_color: '#121313',
    theme_color: '#121313',
    icons: [
      { src: `${base}/task-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/task-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
