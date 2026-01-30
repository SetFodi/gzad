'use client';

import Link from 'next/link';

const footerLinks = {
  platform: [
    { label: 'For Advertisers', href: '#advertisers' },
    { label: 'For Drivers', href: '#drivers' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Press', href: '#' },
  ],
  contact: [
    { label: 'hello@gzad.ge', href: 'mailto:hello@gzad.ge' },
    { label: '+995 555 123 456', href: 'tel:+995555123456' },
    { label: 'Tbilisi, Georgia', href: '#' },
  ],
};

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-[var(--border)] pt-16 pb-8">
      <div className="container-custom">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--amber)] to-[var(--amber-dark)] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 led-matrix opacity-30" />
                <svg width="22" height="14" viewBox="0 0 22 14" fill="none" className="relative z-10">
                  <rect x="0" y="0" width="22" height="14" rx="2" fill="#07080A"/>
                  <rect x="2" y="2" width="18" height="10" rx="1" fill="#FBBF24"/>
                </svg>
              </div>
              <span className="text-xl font-semibold tracking-tight" style={{ fontFamily: 'Clash Display, sans-serif' }}>
                Gzad
              </span>
            </Link>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs leading-relaxed">
              Georgia&apos;s mobile digital advertising network. Transforming Tbilisi&apos;s taxi fleet
              into a powerful, GPS-targeted advertising platform.
            </p>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-[var(--text-primary)]">Platform</h4>
            <ul className="space-y-3">
              {footerLinks.platform.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--amber)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-[var(--text-primary)]">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--amber)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-[var(--text-primary)]">Contact</h4>
            <ul className="space-y-3">
              {footerLinks.contact.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] hover:text-[var(--amber)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[var(--border)] gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            &copy; 2026 Gzad Georgia. All rights reserved.
          </p>

          {/* Social links */}
          <div className="flex items-center gap-4">
            {/* Facebook */}
            <Link
              href="#"
              className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--amber)] hover:bg-white/10 transition-all"
              aria-label="Facebook"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </Link>
            {/* Instagram */}
            <Link
              href="#"
              className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--amber)] hover:bg-white/10 transition-all"
              aria-label="Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </Link>
            {/* LinkedIn */}
            <Link
              href="#"
              className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--amber)] hover:bg-white/10 transition-all"
              aria-label="LinkedIn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
