'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

const faqs = [
  {
    question: 'How quickly can I launch a campaign?',
    answer: 'Most campaigns go live within 24 hours. Once you upload your creative and set your targeting preferences, our team reviews the content and pushes it to our taxi network.',
  },
  {
    question: 'What size should my ad creative be?',
    answer: 'Our displays support various formats. The required size is 280x80 pixels for all video and image content. Our design team can help optimize your creative for best visibility.',
  },
  {
    question: 'How do you calculate impressions?',
    answer: 'We use GPS data combined with traffic density information to estimate impressions. Each taxi reports its location every 30 seconds, and we calculate exposure based on time spent in different areas.',
  },
  {
    question: 'Can I target specific neighborhoods?',
    answer: 'Yes! You can select specific districts of Tbilisi or draw custom zones on a map. Your ads will only display when taxis are in your targeted areas.',
  },
  {
    question: 'What does the driver have to do?',
    answer: 'Nothing! The display runs automatically via 4G connection. Drivers just drive normally while earning passive income. We handle all maintenance and support.',
  },
  {
    question: 'Is there a minimum commitment?',
    answer: 'No long-term contracts required. Both advertisers and drivers can join month-to-month and cancel anytime. We believe in earning your business every month.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-24 lg:py-32 bg-[var(--bg-secondary)]">
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
            Frequently Asked{' '}
            <span className="gradient-text">Questions</span>
          </motion.h2>
        </div>

        {/* FAQ items */}
        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="border-b border-[var(--border)]"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-6 text-left group"
              >
                <h3 className="text-lg font-medium text-[var(--text-primary)] group-hover:text-[var(--amber)] transition-colors pr-8">
                  {faq.question}
                </h3>
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center transition-all duration-300 ${openIndex === i
                      ? 'bg-[var(--amber)] border-[var(--amber)] rotate-45'
                      : 'group-hover:border-[var(--amber)]'
                    }`}
                >
                  <Plus
                    size={16}
                    className={`transition-colors ${openIndex === i ? 'text-[var(--bg-primary)]' : 'text-[var(--text-muted)]'
                      }`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="pb-6 text-[var(--text-secondary)] leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
