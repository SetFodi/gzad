import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#FDF8F1] dark:bg-[#1A0E0E] text-[#541A1A] dark:text-[#F1E2D1]">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity mb-10"
        >
          <ArrowLeft size={16} /> Back to Gzad
        </Link>

        <h1 className="text-4xl md:text-5xl font-normal tracking-[-0.022em] leading-[1.05] mb-3">
          {title}
        </h1>
        <p className="text-sm opacity-60 mb-12">Last updated: {lastUpdated}</p>

        <div className="legal-prose flex flex-col gap-6 text-[15px] leading-relaxed">
          {children}
        </div>

        <hr className="my-12 border-current opacity-10" />

        <p className="text-sm opacity-60">
          Questions about this page? Write to{' '}
          <a href="mailto:legal@gzad.ge" className="underline hover:opacity-100">legal@gzad.ge</a>.
        </p>
      </div>
    </main>
  )
}

// A <div>, not a <section>: the global landing-page stylesheet gives every
// <section> 120px of vertical padding, which pulls a text page apart.
export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-medium tracking-[-0.01em] mt-4">{heading}</h2>
      {children}
    </div>
  )
}
