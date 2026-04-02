import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MainNav } from '@/components/main-nav'
import { Footer } from '@/components/footer'

export const metadata = {
  title: 'About SentinelScan',
  description: 'Learn about SentinelScan - a cybersecurity platform focused on phishing detection and security awareness',
}

export default async function AboutPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen text-white flex flex-col">
      <MainNav user={user} />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="border-b border-slate-800 bg-slate-950/30 py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight text-white">About SentinelScan</h1>
            <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
              An academic cybersecurity project focused on phishing detection and security awareness using modern web technologies and threat intelligence APIs.
            </p>
          </div>
        </section>

        {/* About This Project */}
        <section id="about-project" className="border-b border-slate-800 bg-slate-950/30 py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-6 text-white">About This Project</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  SentinelScan is an innovative academic cybersecurity platform designed to combat phishing threats and raise security awareness through intelligent threat detection and user education.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Built with modern web technologies and powered by enterprise-grade threat intelligence, SentinelScan brings professional-grade security scanning to everyday users.
                </p>
              </div>
              <div className="card-minimal rounded-lg p-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Project Type</p>
                    <p className="text-lg font-semibold text-white">Academic Cybersecurity Platform</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Focus Area</p>
                    <p className="text-lg font-semibold text-white">Phishing Detection & Security Awareness</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Technology</p>
                    <p className="text-lg font-semibold text-white">Modern Web Stack & Threat APIs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Statement */}
        <section id="problem" className="border-b border-slate-800 py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold mb-12 text-white">The Problem</h2>
            <div className="space-y-6 text-slate-300">
              <p className="leading-relaxed">
                Phishing remains one of the most persistent cybersecurity threats. Existing systems rely heavily on static blacklists and predefined patterns, making them ineffective against newly created phishing websites and evolving attack techniques.
              </p>
              <p className="leading-relaxed">
                Traditional antivirus solutions focus primarily on malware, not social engineering tactics, leaving users vulnerable to deceptive yet technically harmless sites. Additionally, most tools lack integration between detection and user awareness, resulting in a reactive rather than preventive cybersecurity approach.
              </p>
              <div className="mt-8 card-minimal rounded-lg p-6">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold text-white">The Gap:</span> Users need comprehensive protection combined with educational resources to understand and prevent phishing attacks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Objectives */}
        <section id="objectives" className="border-b border-slate-800 bg-slate-950/30 py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold mb-12 text-white">Our Objectives</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { num: '01', text: 'Design and develop a phishing detection system capable of analyzing URLs, files, and images.' },
                { num: '02', text: 'Provide a clean, user-friendly interface accessible to non-technical users.' },
                { num: '03', text: 'Implement scan history tracking for URLs and files.' },
                { num: '04', text: 'Raise awareness about phishing techniques through educational insights.' },
                { num: '05', text: 'Reduce phishing-related data theft, financial loss, and reputational damage.' },
              ].map((obj, idx) => (
                <div key={idx} className="card-minimal p-6 rounded-lg">
                  <div className="flex gap-4">
                    <div className="text-2xl font-bold text-slate-600">{obj.num}</div>
                    <p className="text-slate-300 leading-relaxed">{obj.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>



        {/* Technology Stack */}
        <section id="technology" className="border-b border-slate-800 bg-slate-950/30 py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold mb-8 text-white">Technology Stack</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-white">Frontend</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Next.js (App Router)</li>
                  <li>• TypeScript</li>
                  <li>• Tailwind CSS</li>
                  <li>• React components</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4 text-white">Backend & Database</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Supabase (Authentication & Database)</li>
                  <li>• Next.js API Routes</li>
                  <li>• Server Actions</li>
                  <li>• Row Level Security (RLS)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4 text-white">External APIs</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• VirusTotal API</li>
                  <li>• Spline 3D</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4 text-white">Deployment</h3>
                <ul className="space-y-2 text-slate-300">
                  <li>• Vercel (Hosting)</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-slate-800 bg-slate-950/30 py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-3xl font-bold text-white">Ready to Secure Your Digital Footprint?</h2>
            <p className="text-slate-300 text-lg">Start scanning and analyzing security threats today.</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/scan-url"
                className="px-6 py-3 rounded bg-cyan-500 text-black hover:bg-cyan-400 transition font-medium"
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
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
