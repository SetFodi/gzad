'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

const navLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#advertisers', label: 'Advertisers' },
  { href: '#drivers', label: 'Drivers' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: scrolled ? '12px 0' : '20px 0',
          background: scrolled ? 'rgba(7, 8, 10, 0.95)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        <div className="container-custom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div className="led-matrix" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
              <svg width="22" height="14" viewBox="0 0 22 14" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                <rect x="0" y="0" width="22" height="14" rx="2" fill="#07080A"/>
                <rect x="2" y="2" width="18" height="10" rx="1" fill="#FBBF24"/>
              </svg>
            </div>
            <span style={{ fontSize: '22px', fontWeight: 600, color: '#F8FAFC', fontFamily: 'Clash Display, sans-serif' }}>
              Gzad
            </span>
          </Link>

          {/* Desktop Nav */}
          <ul style={{ display: 'flex', alignItems: 'center', gap: '36px', listStyle: 'none', margin: 0, padding: 0 }} className="hidden lg:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#FBBF24'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="hidden lg:flex">
            <Link href="#contact" className="btn-secondary" style={{ padding: '10px 20px', fontSize: '14px' }}>
              Contact
            </Link>
            <Link href="#get-started" className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ padding: '8px', color: '#F8FAFC', background: 'none', border: 'none', cursor: 'pointer' }}
            className="lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            className="lg:hidden"
          >
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '280px',
                background: '#0D0F12',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                padding: '80px 24px 24px',
              }}
            >
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {navLinks.map((link) => (
                  <li key={link.href} style={{ marginBottom: '16px' }}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '18px' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link href="#contact" onClick={() => setMobileOpen(false)} className="btn-secondary" style={{ justifyContent: 'center' }}>
                  Contact
                </Link>
                <Link href="#get-started" onClick={() => setMobileOpen(false)} className="btn-primary" style={{ justifyContent: 'center' }}>
                  Get Started
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
