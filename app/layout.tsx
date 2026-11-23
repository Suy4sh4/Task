import type { Metadata, Viewport } from 'next'
import './globals.css'

const base = process.env.GITHUB_PAGES === 'true' ? '/Task' : ''

export const metadata: Metadata = {
  title: 'Task',
  applicationName: 'Task',
  description: 'Your daily tasks, priorities, and categories in one quiet place.',
  icons: {
    icon: `${base}/task.svg`,
    apple: [{ url: `${base}/task-180.png`, sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Task', statusBarStyle: 'black-translucent' },
  manifest: `${base}/manifest.webmanifest`,
}
export const viewport: Viewport = {
  themeColor: '#101012',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
