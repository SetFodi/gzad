'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Create Your Ad',
    description: 'Upload your image or text. Our team can help design eye-catching creatives for your campaign.',
  },
  {
    number: '02',
    title: 'Set Your Targeting',
    description: 'Choose neighborhoods, time slots, and budget. Pay only for the impressions you want.',
  },
  {
    number: '03',
    title: 'Go Live & Track',
    description: 'Your ad goes live on our taxi fleet. Monitor performance in real-time from your dashboard.',
  },
];

export default function HowItWorks() {
  return (
    <section className="relative py-24 lg:py-32 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-secondary)]">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-5"
          >
            Get Started in{' '}
            <span className="gradient-text">3 Simple Steps</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[var(--text-secondary)]"
          >
            Launch your first campaign in less than 24 hours
          </motion.p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line - desktop */}
          <div className="hidden lg:block absolute top-16 left-[15%] right-[15%] h-px bg-gradient-to-r from-[var(--amber)] via-[var(--blue)] to-[var(--amber)] opacity-30" />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative text-center"
              >
                {/* Number circle */}
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--amber)] to-[var(--amber-dark)] flex items-center justify-center shadow-lg shadow-[var(--amber)]/20">
                    <span
                      className="text-2xl font-bold text-[var(--bg-primary)]"
                      style={{ fontFamily: 'Clash Display, sans-serif' }}
                    >
                      {step.number}
                    </span>
                  </div>
                  {/* Glow ring */}
                  <div className="absolute inset-0 rounded-full bg-[var(--amber)] opacity-20 blur-xl" />
                </div>

                <h3 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="text-[var(--text-secondary)] max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
