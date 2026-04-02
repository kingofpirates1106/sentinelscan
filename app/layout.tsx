import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'SentinelScan - URL & File Security Scanner',
  description: 'Scan URLs and files for security threats with VirusTotal intelligence',
  generator: 'v0.app',
  openGraph: {
    title: 'SentinelScan - Security Threat Scanner',
    description: 'Secure your digital footprint instantly',
  },
}

export const viewport = {
  themeColor: '#000000',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white font-sans">{children}</body>
    </html>
  )
}
