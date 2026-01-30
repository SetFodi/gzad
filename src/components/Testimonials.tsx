'use client';

import { motion } from 'framer-motion';

const testimonials = [
  {
    text: "I was spending GEL 4,000/month on a billboard near Rustaveli. Now I spend GEL 600 and get better coverage across the whole city. The targeting feature is amazing - I can focus my ads near my restaurant during lunch hours.",
    author: 'Giorgi K.',
    role: 'Restaurant Owner, Vera District',
    initials: 'GK',
  },
  {
    text: "Extra GEL 450 last month just for having the display on my taxi. I don't have to do anything - it runs automatically. Best decision I made this year. Already told three other drivers to sign up.",
    author: 'Davit M.',
    role: 'Taxi Driver, 5 years experience',
    initials: 'DM',
  },
  {
    text: "We run events every weekend and needed flexible advertising. With Gzad, we can update our promotions the same day. The real-time tracking lets us see exactly where our ads are being shown.",
    author: 'Nino B.',
    role: 'Event Promoter',
    initials: 'NB',
  },
  {
    text: "As a marketing agency, we're always looking for innovative channels for our clients. Gzad gives us programmatic capabilities in outdoor advertising - something that didn't exist in Georgia before.",
    author: 'Lasha T.',
    role: 'Marketing Agency Director',
    initials: 'LT',
  },
];

export default function Testimonials() {
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
            What People Are{' '}
            <span className="gradient-text">Saying</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[var(--text-secondary)]"
          >
            Early feedback from our pilot partners
          </motion.p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 lg:p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors duration-300"
            >
              {/* Quote */}
              <p className="text-[var(--text-primary)] leading-relaxed mb-6">
                &ldquo;{testimonial.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--amber)] to-[var(--amber-dark)] flex items-center justify-center">
                  <span className="text-sm font-semibold text-[var(--bg-primary)]">
                    {testimonial.initials}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-[var(--text-primary)]">
                    {testimonial.author}
                  </h4>
                  <p className="text-sm text-[var(--text-muted)]">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
