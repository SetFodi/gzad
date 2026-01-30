'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';
import LEDDisplay from './LEDDisplay';

const stats = [
  { value: '50K+', label: 'Daily Impressions' },
  { value: '10x', label: 'Cheaper Than Billboards' },
  { value: '24/7', label: 'City Coverage' },
];

export default function Hero() {
  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      paddingTop: '120px',
      paddingBottom: '80px',
      overflow: 'hidden',
    }}>
      {/* Background effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 40% 20%, rgba(251, 191, 36, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 0%, rgba(59, 130, 246, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 0% 50%, rgba(139, 92, 246, 0.03) 0%, transparent 50%)
        `,
      }} />

      {/* Grid pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: `linear-gradient(#64748B 1px, transparent 1px), linear-gradient(90deg, #64748B 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      {/* Glow */}
      <div className="animate-pulse-glow" style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.1) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div className="container-custom" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '60px',
          alignItems: 'center',
        }} className="lg:grid-cols-2 lg:gap-20">
          {/* Content */}
          <div style={{ maxWidth: '560px' }}>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontSize: 'clamp(36px, 5vw, 58px)',
                fontWeight: 600,
                lineHeight: 1.1,
                marginBottom: '24px',
                color: '#F8FAFC',
              }}
            >
              Turn Every Taxi Into a{' '}
              <span className="gradient-text">Moving Billboard</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontSize: '17px',
                color: '#94A3B8',
                marginBottom: '36px',
                lineHeight: 1.7,
              }}
            >
              Georgia&apos;s mobile digital advertising network. Reach thousands of customers
              daily with GPS-targeted LED displays on Tbilisi&apos;s taxi fleet.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '50px' }}
            >
              <Link href="#advertisers" className="btn-primary">
                <Zap size={18} />
                Start Advertising
                <ArrowRight size={16} />
              </Link>
              <Link href="#drivers" className="btn-secondary">
                Become a Driver Partner
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: 'flex',
                gap: '40px',
                paddingTop: '36px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {stats.map((stat, i) => (
                <div key={i}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: 600,
                    color: '#FBBF24',
                    fontFamily: 'Clash Display, sans-serif',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="hidden lg:flex"
          >
            <LEDDisplay />
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '120px',
        background: 'linear-gradient(to top, #07080A, transparent)',
        pointerEvents: 'none',
      }} />
    </section>
  );
}
