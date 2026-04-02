'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-slate-700/40 py-12 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Branding */}
          <div className="space-y-3">
            <Link
              href="/"
              className="text-xl font-bold tracking-tighter text-cyan-300 hover:text-cyan-200 transition inline-block"
            >
              SentinelScan
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              A modern cybersecurity platform focused on phishing detection and security awareness.
            </p>
          </div>

          {/* Our Tools */}
          <div className="space-y-3">
            <h3 className="font-semibold text-cyan-100">Our Tools</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/scan-url"
                  className="text-sm text-slate-400 hover:text-cyan-300 transition"
                >
                  URL Scanner
                </Link>
              </li>
              <li>
                <Link
                  href="/file-scanner"
                  className="text-sm text-slate-400 hover:text-cyan-300 transition"
                >
                  File & Screenshot Scanner
                </Link>
              </li>
              <li>
                <Link
                  href="/security-insights"
                  className="text-sm text-slate-400 hover:text-cyan-300 transition"
                >
                  Security Insights
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700/40 pt-8">
          <p className="text-sm text-slate-500 text-center">
            Â© 2026 SentinelScan â€” Made by Aman Adhav and Om Patil
          </p>
        </div>
      </div>
    </footer>
  )
}

