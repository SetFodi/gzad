'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    price: '300',
    description: 'Perfect for testing the waters',
    features: [
      '5,000 impressions/month',
      '1 ad creative',
      'Basic analytics',
      'Email support',
      'Citywide coverage',
    ],
    featured: false,
  },
  {
    name: 'Growth',
    price: '600',
    description: 'For businesses ready to grow',
    features: [
      '15,000 impressions/month',
      '3 ad creatives',
      'Advanced analytics',
      'Priority support',
      'GPS zone targeting',
      'Time-based scheduling',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '1,200',
    description: 'Maximum visibility and control',
    features: [
      '50,000 impressions/month',
      'Unlimited creatives',
      'Real-time dashboard',
      'Dedicated account manager',
      'Custom targeting rules',
      'API access',
    ],
    featured: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative py-24 lg:py-32">
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
            Simple,{' '}
            <span className="gradient-text">Transparent Pricing</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[var(--text-secondary)]"
          >
            No hidden fees. Start small and scale as you grow.
          </motion.p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative p-8 rounded-2xl border transition-all duration-300 hover:-translate-y-2 ${
                plan.featured
                  ? 'bg-gradient-to-b from-[var(--amber)]/10 to-transparent border-[var(--amber)]/30'
                  : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--border-hover)]'
              }`}
            >
              {/* Popular badge */}
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-[var(--amber)] to-[var(--amber-dark)] text-[var(--bg-primary)] rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>

              <div className="mb-4">
                <span
                  className="text-4xl font-bold"
                  style={{ fontFamily: 'Clash Display, sans-serif' }}
                >
                  ₾{plan.price}
                </span>
                <span className="text-[var(--text-muted)]">/month</span>
              </div>

              <p className="text-sm text-[var(--text-secondary)] pb-6 mb-6 border-b border-[var(--border)]">
                {plan.description}
              </p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check size={18} className="flex-shrink-0 text-[var(--amber)] mt-0.5" />
                    <span className="text-[var(--text-secondary)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="#contact"
                className={`block w-full py-3 rounded-xl text-center font-medium transition-all duration-300 ${
                  plan.featured
                    ? 'bg-gradient-to-r from-[var(--amber)] to-[var(--amber-dark)] text-[var(--bg-primary)] hover:shadow-lg hover:shadow-[var(--amber)]/25'
                    : 'border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--amber)] hover:text-[var(--amber)]'
                }`}
              >
                {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
