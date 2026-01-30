'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const messages = [
  { text: 'YOUR AD HERE', bg: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)' },
  { text: 'GPS TARGETED', bg: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)' },
  { text: '50K+ VIEWS', bg: 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)' },
  { text: 'REAL-TIME', bg: 'linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)' },
];

export default function LEDDisplay() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        setIsTransitioning(false);
      }, 200);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentMessage = messages[messageIndex];

  return (
    <div style={{ position: 'relative' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        inset: '-80px',
        background: 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.15) 0%, transparent 60%)',
        filter: 'blur(40px)',
      }} />

      {/* Main display unit - WIDE aspect ratio */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative' }}
      >
        {/* Display housing - wide and short like real taxi displays */}
        <div style={{
          position: 'relative',
          width: '480px',
          height: '130px',
          background: 'linear-gradient(180deg, #1a1d24 0%, #12151a 100%)',
          borderRadius: '16px',
          padding: '10px',
          boxShadow: '0 50px 100px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* Inner bezel */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.05)',
            pointerEvents: 'none',
          }} />

          {/* Screen */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#0a0a0f',
          }}>
            {/* LED content */}
            <motion.div
              style={{
                position: 'absolute',
                inset: 0,
                background: currentMessage.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: isTransitioning ? 0 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {/* LED dot matrix overlay */}
              <div className="led-matrix" style={{ position: 'absolute', inset: 0 }} />

              {/* Scanline effect */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
                pointerEvents: 'none',
              }} />

              {/* Text */}
              <span style={{
                position: 'relative',
                zIndex: 1,
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: '#07080A',
                fontFamily: 'Clash Display, sans-serif',
                textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              }}>
                {currentMessage.text}
              </span>
            </motion.div>

            {/* Screen reflection */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)',
              pointerEvents: 'none',
            }} />
          </div>

          {/* Status LED */}
          <div style={{
            position: 'absolute',
            top: '6px',
            right: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 8px #10B981',
              animation: 'pulse-glow 2s infinite',
            }} />
            <span style={{ fontSize: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span>
          </div>
        </div>

        {/* Mount/Stand */}
        <div style={{ position: 'relative', marginTop: '-4px' }}>
          <div style={{
            width: '120px',
            height: '28px',
            margin: '0 auto',
            background: 'linear-gradient(180deg, #1a1d24 0%, #0d0f12 100%)',
            borderRadius: '0 0 12px 12px',
          }} />
          <div style={{
            width: '180px',
            height: '12px',
            margin: '0 auto',
            background: 'linear-gradient(180deg, #0d0f12 0%, #07080a 100%)',
            borderRadius: '0 0 16px 16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }} />
        </div>

        {/* Taxi roof silhouette */}
        <div style={{
          position: 'relative',
          marginTop: '-6px',
          width: '300px',
          height: '50px',
          margin: '-6px auto 0',
          background: 'linear-gradient(180deg, #15171c 0%, #0d0f12 100%)',
          borderRadius: '0 0 50px 50px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            position: 'absolute',
            inset: '0',
            top: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
          }} />
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.25em',
            color: '#FBBF24',
            fontFamily: 'Clash Display, sans-serif',
          }}>
            TAXI
          </span>
        </div>
      </motion.div>

      {/* Floating info cards */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="animate-float"
        style={{
          position: 'absolute',
          right: '-20px',
          top: '-10px',
          background: 'rgba(13, 15, 18, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '14px',
          padding: '14px 18px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07080A" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>GPS Targeted</p>
            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Zone-based delivery</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        className="animate-float-delayed"
        style={{
          position: 'absolute',
          left: '-20px',
          bottom: '80px',
          background: 'rgba(13, 15, 18, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: '14px',
          padding: '14px 18px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#F8FAFC', margin: 0 }}>Real-Time</p>
            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Instant updates</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
