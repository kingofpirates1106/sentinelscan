import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SplineHero } from '@/components/spline-hero'
import { MainNav } from '@/components/main-nav'
import { Footer } from '@/components/footer'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen text-white flex flex-col">
      <MainNav user={user} />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative bg-black">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-tight text-white">
                    <div>Your Doubt</div>
                    <div>Our Solution</div>
                  </h1>
                  <p className="text-xl text-slate-300 leading-relaxed">
                    Scan URLs and files for security threats with enterprise-grade threat intelligence from VirusTotal
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <Link
                    href="/scan-url"
                    className="px-6 py-3 rounded font-medium bg-cyan-500 text-black hover:bg-cyan-400 transition"
                  >
                    Scan URL
                  </Link>
                  <Link
                    href="/file-scanner"
                    className="px-6 py-3 rounded border border-slate-600 text-slate-200 hover:border-slate-500 hover:text-white transition"
                  >
                    Scan File
                  </Link>
                </div>

                <div className="pt-8 border-t border-slate-800">
                  <p className="text-sm text-slate-400">
                    {user ? 'Unlimited scans' : 'Free: 3 scans per day | Sign up for unlimited access'}
                  </p>
                </div>
              </div>

              {/* Right Spline */}
              <SplineHero />
            </div>
          </div>
        </section>

        {/* Our System Section */}
        <section className="border-t border-slate-800 bg-slate-950/30 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center">
              <h2 className="text-4xl font-bold mb-4 text-white">Our System</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                href="/scan-url"
                className="card-minimal p-6 rounded-lg hover:border-slate-600 group"
              >
                <h3 className="text-lg font-semibold mb-3 text-white group-hover:text-slate-100">URL Phishing Detection</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li> Identify malicious URLs and phishing pages</li>
                  <li> Enterprise-grade threat intelligence analysis</li>
                  <li> Instant scan results and risk assessment</li>
                </ul>
              </Link>

              <Link
                href="/file-scanner"
                className="card-minimal p-6 rounded-lg hover:border-slate-600 group"
              >
                <h3 className="text-lg font-semibold mb-3 text-white group-hover:text-slate-100">File Security Analysis</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li> Detect malware and viruses in files</li>
                  <li> Comprehensive threat scanning</li>
                  <li> Safe file upload and analysis</li>
                </ul>
              </Link>

              <Link
                href="/security-insights"
                className="card-minimal p-6 rounded-lg hover:border-slate-600 group"
              >
                <h3 className="text-lg font-semibold mb-3 text-white group-hover:text-slate-100">Security Insights</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li> Learn phishing detection techniques</li>
                  <li> Security best practices and awareness</li>
                  <li> Educational security resources</li>
                </ul>
              </Link>

              <div className="card-minimal p-6 rounded-lg group">
                <h3 className="text-lg font-semibold mb-3 text-white group-hover:text-slate-100">AI Screenshot Analyzer</h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li> Detect fake login forms and impersonation attempts</li>
                  <li> Flag suspicious domains, urgency scams, and malware popups</li>
                  <li> Actionable guidance with structured risk scoring</li>
                </ul>
                <div className="mt-4 text-xs text-slate-500">
                  Available in File Scanner for image screenshots
                </div>
              </div>
            </div>

            {/* See how it is button */}
            <div className="text-center pt-8">
              <Link
                href="/about"
                className="inline-block px-6 py-3 rounded-lg border border-slate-600 text-slate-200 hover:border-slate-500 hover:text-white transition font-medium"
              >
                See how it is   ➜
              </Link>
            </div>
          </div>
        </section>

        {/* Why SentinelScan Section */}
        <section className="border-t border-slate-800 bg-slate-950/30 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-4xl font-bold text-white">Why SentinelScan?</h2>
              <p className="text-lg text-slate-300 max-w-2xl mx-auto">
                Enterprise-grade security features designed for everyone
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="card-minimal p-6 rounded-lg space-y-3">
                <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <div className="text-xl">🛡️</div>
                </div>
                <h3 className="font-semibold text-white">Multi-Layer Threat Detection</h3>
                <p className="text-sm text-slate-300">Advanced scanning powered by multiple security vendors for comprehensive threat analysis.</p>
              </div>

              <div className="card-minimal p-6 rounded-lg space-y-3">
                <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <div className="text-xl">🌐</div>
                </div>
                <h3 className="font-semibold text-white">Real-Time Scanning</h3>
                <p className="text-sm text-slate-300">Instant threat analysis with immediate results and detailed threat reports.</p>
              </div>

              <div className="card-minimal p-6 rounded-lg space-y-3">
                <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <div className="text-xl">🔗</div>
                </div>
                <h3 className="font-semibold text-white">Security Awareness</h3>
                <p className="text-sm text-slate-300">Educational resources and insights to help you understand cybersecurity threats.</p>
              </div>

              <div className="card-minimal p-6 rounded-lg space-y-3">
                <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <div className="text-xl">🖧</div>
                </div>
                <h3 className="font-semibold text-white">User-Friendly Design</h3>
                <p className="text-sm text-slate-300">Intuitive interface accessible to both technical experts and everyday users.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}


