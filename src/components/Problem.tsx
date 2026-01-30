'use client';

import { motion } from 'framer-motion';
import { DollarSign, MapPin, BarChart3, Lock } from 'lucide-react';

const problems = [
  {
    icon: DollarSign,
    title: 'Billboards Are Expensive',
    description: 'Prime billboard spots cost GEL 3,000-15,000/month. Small businesses simply can\'t afford traditional outdoor advertising.',
    color: 'from-rose-500 to-red-600',
  },
  {
    icon: MapPin,
    title: 'Fixed Location = Limited Reach',
    description: 'A billboard only reaches people who pass that exact spot. You\'re paying for one location while your customers are everywhere.',
    color: 'from-orange-500 to-amber-600',
  },
  {
    icon: BarChart3,
    title: 'No Real Metrics',
    description: 'How many people actually saw your billboard? Traditional outdoor ads offer no tracking, no data, no way to measure ROI.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Lock,
    title: 'Long-Term Commitments',
    description: 'Locked into 3-6 month contracts with no flexibility. Can\'t update your message or respond to market changes.',
    color: 'from-blue-500 to-indigo-600',
  },
];

export default function Problem() {
  return (
    <section className="relative py-24 lg:py-32 bg-[var(--bg-secondary)]">
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-transparent to-[var(--bg-primary)] opacity-50" />

      <div className="container-custom relative z-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-5"
          >
            The Problem with{' '}
            <span className="gradient-text">Traditional Advertising</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[var(--text-secondary)]"
          >
            Outdoor advertising in Georgia is stuck in the past. It&apos;s time for a smarter solution.
          </motion.p>
        </div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-2 gap-5">
          {problems.map((problem, i) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all duration-300 hover:-translate-y-1"
            >
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${problem.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-300`} />

              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${problem.color} bg-opacity-10 flex items-center justify-center mb-6`}>
                <problem.icon size={24} className="text-white" />
              </div>

              <h3 className="text-xl font-semibold mb-3 text-[var(--text-primary)]">
                {problem.title}
              </h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {problem.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
