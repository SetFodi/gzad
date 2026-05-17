'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MIN_DURATION_MS = 1500;

export default function Preloader() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const start = Date.now();

    const finish = () => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, MIN_DURATION_MS - elapsed);
      window.setTimeout(() => setShow(false), wait);
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish);
      return () => window.removeEventListener('load', finish);
    }
  }, []);

  useEffect(() => {
    if (show) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="preloader-shell flex items-center justify-center bg-[#F1E2D1] dark:bg-[#160606] paper-grain"
          aria-hidden
        >
          {/* Decorative top/bottom hairlines */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-12 left-1/2 z-[1] -translate-x-1/2 h-px w-40 origin-center bg-[#810B38]/35 dark:bg-[#D6A569]/35"
          />
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-12 left-1/2 z-[1] -translate-x-1/2 h-px w-40 origin-center bg-[#810B38]/35 dark:bg-[#D6A569]/35"
          />

          <motion.div
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-[1] flex flex-col items-center gap-10 lg:gap-12 px-6"
          >

            {/* Eyebrow */}
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="text-[10px] tracking-[0.45em] uppercase font-bold text-[#541A1A]/55 dark:text-[#DCC3AA]/55"
            >
              Gzad · Tbilisi
            </motion.span>

            {/* Wordmark with pulsing brand dot */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-end gap-3 lg:gap-4 relative"
            >
              <span className="font-serif italic text-[72px] sm:text-[96px] lg:text-[120px] text-[#541A1A] dark:text-[#F1E2D1] leading-[0.85] tracking-[-0.02em]">
                Gzad
              </span>

              {/* Brand dot — pulses like an LED power indicator */}
              <span className="relative mb-3 lg:mb-5">
                <span
                  className="block w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full bg-[#810B38] dark:bg-[#D6A569]"
                  style={{
                    boxShadow:
                      '0 0 10px rgba(214, 165, 105, 0.55), 0 0 22px rgba(214, 165, 105, 0.35)',
                  }}
                />
                <motion.span
                  className="absolute inset-0 rounded-full bg-[#810B38] dark:bg-[#D6A569]"
                  animate={{ scale: [1, 2.6, 1], opacity: [0.65, 0, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            </motion.div>

            {/* Tagline */}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.7 }}
              className="font-serif italic text-[14px] lg:text-[15px] text-[#810B38]/75 dark:text-[#D6A569]/85 -mt-1"
            >
              Advertising — in motion.
            </motion.span>

            {/* Progress hairline */}
            <div className="relative mt-3 w-[200px] h-px bg-[#DCC3AA] dark:bg-[#D6A569]/15 overflow-hidden">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.25 }}
                className="absolute inset-0 bg-[#810B38] dark:bg-[#D6A569]"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
