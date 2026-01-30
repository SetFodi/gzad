'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Coins, BarChart2, Zap, Rocket, Handshake, Wallet, Gift, Smartphone, RefreshCw, Shield, Star } from 'lucide-react';

const tabs = [
  { id: 'advertisers', label: 'For Advertisers' },
  { id: 'drivers', label: 'For Drivers' },
];

const advertiserBenefits = [
  {
    icon: Target,
    title: 'Hyperlocal Targeting',
    description: 'Show ads near your store, in specific neighborhoods, or along popular routes. Reach customers where they live and work.',
  },
  {
    icon: Coins,
    title: '10x Better Value',
    description: 'Get citywide coverage for a fraction of billboard costs. Start with just GEL 300/month and scale as you grow.',
  },
  {
    icon: BarChart2,
    title: 'Real Analytics',
    description: 'Track impressions, coverage area, and campaign performance. Know exactly what you\'re getting for your money.',
  },
  {
    icon: Zap,
    title: 'Instant Updates',
    description: 'Change your ad anytime. Run time-sensitive promotions, respond to events, or A/B test different messages.',
  },
  {
    icon: Rocket,
    title: 'Fast Launch',
    description: 'Go from signup to live campaign in 24 hours. No lengthy negotiations or production delays.',
  },
  {
    icon: Handshake,
    title: 'No Commitments',
    description: 'Month-to-month flexibility. Pause, adjust, or cancel anytime. Your advertising, your terms.',
  },
];

const driverBenefits = [
  {
    icon: Wallet,
    title: 'Passive Income',
    description: 'Earn GEL 300-800 extra per month just by driving. No extra work required - the display runs automatically.',
  },
  {
    icon: Gift,
    title: 'Zero Investment',
    description: 'We provide and install the LED display for free. No upfront costs, no maintenance fees, no risk.',
  },
  {
    icon: Smartphone,
    title: 'Easy App',
    description: 'Track your earnings, see your routes, and manage everything from our simple driver app.',
  },
  {
    icon: RefreshCw,
    title: 'Flexible Terms',
    description: 'Join or leave anytime. Month-to-month partnership with no long-term contracts binding you.',
  },
  {
    icon: Shield,
    title: 'Full Support',
    description: 'Our team handles everything - installation, maintenance, and support. You just drive.',
  },
  {
    icon: Star,
    title: 'Stand Out',
    description: 'Your taxi looks modern and professional. Passengers notice the difference and remember you.',
  },
];

export default function Benefits() {
  const [activeTab, setActiveTab] = useState('advertisers');
  const benefits = activeTab === 'advertisers' ? advertiserBenefits : driverBenefits;
  const accentColor = activeTab === 'advertisers' ? 'var(--amber)' : 'var(--blue)';

  return (
    <section id="advertisers" className="relative py-24 lg:py-32 bg-[var(--bg-secondary)]">
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-5"
          >
            A Win-Win for{' '}
            <span className="gradient-text">Everyone</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[var(--text-secondary)]"
          >
            We create value for both sides of our marketplace
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-3 mb-12">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'text-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)]'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute inset-0 rounded-xl ${
                    tab.id === 'advertisers'
                      ? 'bg-gradient-to-r from-[var(--amber)] to-[var(--amber-dark)]'
                      : 'bg-gradient-to-r from-[var(--blue)] to-[var(--violet)]'
                  }`}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Benefits grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            id="drivers"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <benefit.icon size={24} style={{ color: accentColor }} />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">
                  {benefit.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
