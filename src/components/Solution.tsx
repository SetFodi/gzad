'use client';

import { motion } from 'framer-motion';
import { Target, Zap, TrendingUp, CreditCard } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: 'GPS-Targeted Advertising',
    description: 'Show your ads only in specific neighborhoods, near competitors, or around your business location.',
  },
  {
    icon: Zap,
    title: 'Real-Time Content Updates',
    description: 'Change your message instantly. Run lunch specials at noon, happy hour promos in the evening.',
  },
  {
    icon: TrendingUp,
    title: 'Verified Impressions',
    description: 'Get real data on where your ads were shown, how many impressions you received, and campaign performance.',
  },
  {
    icon: CreditCard,
    title: 'Flexible Budgets',
    description: 'Start from just GEL 300/month. Scale up or down anytime. No long-term commitments required.',
  },
];

export default function Solution() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-6"
            >
              The <span className="gradient-text">Smart Alternative</span> to Static Billboards
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg text-[var(--text-secondary)] mb-10"
            >
              Our LED-equipped taxis travel throughout the city, displaying your ads to thousands of potential customers every day.
            </motion.p>

            <div className="space-y-6">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--amber)]/10 flex items-center justify-center">
                    <feature.icon size={22} className="text-[var(--amber)]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[var(--text-primary)] mb-1">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Phone mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative flex justify-center"
          >
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--amber)]/10 to-[var(--blue)]/10 blur-3xl" />

            {/* Phone */}
            <div className="relative w-[280px] h-[580px] bg-gradient-to-b from-[#1a1d24] to-[#12151a] rounded-[3rem] p-3 shadow-2xl shadow-black/50">
              {/* Screen */}
              <div className="w-full h-full bg-[var(--bg-primary)] rounded-[2.5rem] overflow-hidden relative">
                {/* Status bar */}
                <div className="absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-[var(--amber)]/5 to-transparent flex items-center justify-center">
                  <div className="w-24 h-6 bg-black rounded-full" />
                </div>

                {/* App content */}
                <div className="pt-16 px-5">
                  <h3 className="text-lg font-semibold mb-1">Dashboard</h3>
                  <p className="text-xs text-[var(--text-muted)] mb-5">Today&apos;s Performance</p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {[
                      { value: '12.4K', label: 'Impressions' },
                      { value: '8', label: 'Active Taxis' },
                      { value: '₾142', label: 'Spent Today' },
                      { value: '4.2x', label: 'vs Billboard' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-4 rounded-xl bg-white/5">
                        <div className="text-xl font-semibold text-[var(--amber)]" style={{ fontFamily: 'Clash Display, sans-serif' }}>
                          {stat.value}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-1">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Map placeholder */}
                  <div className="relative h-40 rounded-xl bg-gradient-to-br from-[#0f1520] to-[#0a0d12] overflow-hidden">
                    {/* Grid */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: `linear-gradient(var(--blue) 1px, transparent 1px),
                                         linear-gradient(90deg, var(--blue) 1px, transparent 1px)`,
                        backgroundSize: '20px 20px',
                      }}
                    />
                    {/* Dots */}
                    {[
                      { top: '25%', left: '20%' },
                      { top: '45%', left: '55%' },
                      { top: '65%', left: '30%' },
                      { top: '30%', left: '70%' },
                    ].map((pos, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-3 h-3 bg-[var(--amber)] rounded-full"
                        style={{ top: pos.top, left: pos.left }}
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [1, 0.5, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.5,
                        }}
                      >
                        <div className="absolute inset-0 rounded-full bg-[var(--amber)] animate-ping opacity-30" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
