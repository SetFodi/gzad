'use client';

import { motion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';
import Link from 'next/link';

export default function CTA() {
  return (
    <section id="get-started" className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-[var(--primary)] rounded-full opacity-[0.04] blur-[120px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="text-center max-w-2xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-6"
          >
            Ready to{' '}
            <span className="gradient-text">Get Started?</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-muted-foreground mb-10"
          >
            Join Georgia&apos;s mobile digital advertising network. Whether you want to advertise
            your business or earn extra income as a driver, we&apos;re here to help.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <Link
              href="mailto:hello@gzad.ge"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#CCF381] text-black font-bold rounded-xl hover:shadow-[0_8px_32px_rgba(204,243,129,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110"
            >
              <Mail size={18} />
              Contact Us
            </Link>
            <Link
              href="tel:+995555123456"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-black text-[#CCF381] border border-[#CCF381] font-bold rounded-xl hover:bg-[#CCF381] hover:text-black hover:shadow-[0_0_20px_rgba(204,243,129,0.4)] transition-all duration-300 hover:-translate-y-0.5"
            >
              <Phone size={18} />
              Call Us
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
