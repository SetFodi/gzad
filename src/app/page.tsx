'use client';

import { useState, useEffect } from 'react';
import { translations } from './translations';
import { Pricing } from "@/components/blocks/pricing";
import { motion } from "framer-motion";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('advertisers');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [displayText, setDisplayText] = useState('Your Ad Here');
  const [lang, setLang] = useState<'en' | 'ge'>('en');

  const t = translations[lang];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (lang === 'ge') {
      document.body.classList.add('lang-ge');
    } else {
      document.body.classList.remove('lang-ge');
    }
  }, [lang]);

  useEffect(() => {
    const messages = ['Your Ad Here', 'GEL 400/mo', 'GEL 100/week', 'GPS Targeted', '50K+ Views'];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setDisplayText(messages[index]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <>
      {/* Navigation */}
      <nav id="navbar" className={scrolled ? 'scrolled' : ''}>
        <div className="custom-container">
          <a href="#" className="logo">
            <div className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="8" width="18" height="10" rx="2" fill="var(--dark)" />
                <rect x="5" y="10" width="14" height="6" rx="1" fill="var(--primary)" />
              </svg>
            </div>
            Gzad
          </a>
          <ul className="nav-links">
            <li><a href="#how-it-works">{t.nav.howItWorks}</a></li>
            <li><a href="#advertisers">{t.nav.advertisers}</a></li>
            <li><a href="#drivers">{t.nav.drivers}</a></li>
            <li><a href="#pricing">{t.nav.pricing}</a></li>
            <li><a href="#faq">{t.nav.faq}</a></li>
          </ul>
          <div className="nav-right" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="lang-switch">
              <button
                onClick={() => setLang('en')}
                className={lang === 'en' ? 'active' : ''}
              >
                EN
              </button>
              <button
                onClick={() => setLang('ge')}
                className={lang === 'ge' ? 'active' : ''}
              >
                GE
              </button>
            </div>
            <div className="nav-cta">
              <a href="#contact" className="btn btn-secondary">{t.nav.contact}</a>
              <a href="#get-started" className="btn btn-primary">{t.nav.getStarted}</a>
            </div>
          </div>
          <div className="mobile-menu">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="custom-container">
          <div className="hero-grid">
            <div className="hero-content">
              <h1>{t.hero.titlePrefix} <span className="gradient-text">{t.hero.titleGradient}</span></h1>
              <p>{t.hero.description}</p>
              <div className="hero-buttons">
                <a href="#advertisers" className="btn btn-primary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  {t.hero.startAdvertising}
                </a>
                <a href="#drivers" className="btn btn-secondary">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t.hero.becomeDriver}
                </a>
              </div>
              <div className="hero-stats">
                <div className="stat">
                  <div className="stat-value">50K+</div>
                  <div className="stat-label">{t.hero.stats.impressions}</div>
                </div>
                <div className="stat">
                  <div className="stat-value">10x</div>
                  <div className="stat-label">{t.hero.stats.cheaper}</div>
                </div>
                <div className="stat">
                  <div className="stat-value">24/7</div>
                  <div className="stat-label">{t.hero.stats.coverage}</div>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <div className="taxi-display">
                <div className="display-screen">
                  <div className="display-content">
                    <span>{displayText}</span>
                  </div>
                  <div className="display-dots"></div>
                </div>
              </div>
              <div className="taxi-body"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="problem">
        <div className="custom-container">
          <div className="section-header">
            <h2>{t.problem.titlePrefix} <span className="gradient-text">{t.problem.titleGradient}</span></h2>
            <p>{t.problem.subtitle}</p>
          </div>
          <div className="problem-grid">
            {t.problem.cards.map((card, i) => (
              <div key={i} className="problem-card">
                <div className="problem-card-icon">
                  {[
                    <svg key="0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, // Dollar Sign
                    <svg key="1" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>, // Map Pin
                    <svg key="2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>, // Bar Chart
                    <svg key="3" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> // Lock
                  ][i]}
                </div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="solution" id="how-it-works">
        <div className="custom-container">
          <div className="solution-content">
            <div className="solution-text">
              <h2>{t.solution.titlePrefix} <span className="gradient-text">{t.solution.titleGradient}</span> {t.solution.titleSuffix}</h2>
              <p>{t.solution.description}</p>
              <div className="solution-features">
                {t.solution.features.map((feature, i) => (
                  <div key={i} className="solution-feature">
                    <div className="solution-feature-icon">
                      {[
                        <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>, // Target
                        <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>, // Zap
                        <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>, // Trending Up
                        <svg key="3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> // Credit Card
                      ][i]}
                    </div>
                    <div>
                      <h4>{feature.title}</h4>
                      <p>{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="solution-visual">
              <div className="phone-mockup">
                <div className="phone-screen">
                  <div className="phone-header">
                    <h3>{t.solution.dashboard.title}</h3>
                    <p>{t.solution.dashboard.subtitle}</p>
                  </div>
                  <div className="phone-stats">
                    <div className="phone-stat">
                      <div className="phone-stat-value">12.4K</div>
                      <div className="phone-stat-label">{t.solution.dashboard.impressions}</div>
                    </div>
                    <div className="phone-stat">
                      <div className="phone-stat-value">8</div>
                      <div className="phone-stat-label">{t.solution.dashboard.activeTaxis}</div>
                    </div>
                    <div className="phone-stat">
                      <div className="phone-stat-value">₾142</div>
                      <div className="phone-stat-label">{t.solution.dashboard.spent}</div>
                    </div>
                    <div className="phone-stat">
                      <div className="phone-stat-value">4.2x</div>
                      <div className="phone-stat-label">{t.solution.dashboard.vsBillboard}</div>
                    </div>
                  </div>
                  <div className="phone-map">
                    <div className="map-dot"></div>
                    <div className="map-dot"></div>
                    <div className="map-dot"></div>
                    <div className="map-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="custom-container">
          <div className="section-header">
            <h2>{t.howItWorks.titlePrefix} <span className="gradient-text">{t.howItWorks.titleGradient}</span></h2>
            <p>{t.howItWorks.subtitle}</p>
          </div>
          <div className="steps">
            {t.howItWorks.steps.map((step, i) => (
              <div key={i} className="step">
                <div className="step-number">{i + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two Sided Section */}
      <section className="two-sided" id="advertisers">
        <div className="custom-container">
          <div className="section-header">
            <h2>{t.twoSided.titlePrefix} <span className="gradient-text">{t.twoSided.titleGradient}</span></h2>
            <p>{t.twoSided.subtitle}</p>
          </div>
          <div className="audience-tabs">
            <button
              className={`audience-tab ${activeTab === 'advertisers' ? 'active' : ''}`}
              onClick={() => setActiveTab('advertisers')}
            >
              {t.twoSided.advertisersTab}
            </button>
            <button
              className={`audience-tab ${activeTab === 'drivers' ? 'active' : ''}`}
              onClick={() => setActiveTab('drivers')}
            >
              {t.twoSided.driversTab}
            </button>
          </div>
          <div id="advertisers-content" className={`audience-content ${activeTab === 'advertisers' ? 'active' : ''}`}>
            <div className="benefits-grid">
              {t.twoSided.advertisersBenefits.map((benefit, i) => (
                <div key={i} className="benefit-card">
                  <div className="benefit-icon">{['🎯', '💰', '📊', '⚡', '🚀', '🤝'][i]}</div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div id="drivers-content" className={`audience-content ${activeTab === 'drivers' ? 'active' : ''}`}>
            <div className="benefits-grid">
              {t.twoSided.driversBenefits.map((benefit, i) => (
                <div key={i} className="benefit-card blue">
                  <div className="benefit-icon">{['💵', '🆓', '📱', '🔄', '🛡️', '⭐'][i]}</div>
                  <h3>{benefit.title}</h3>
                  <p>{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <Pricing
          plans={[
            {
              name: t.pricing.standard1.title,
              price: t.pricing.standard1.price,
              yearlyPrice: t.pricing.standard1.price,
              period: t.pricing.standard1.period,
              features: t.pricing.standard1.features,
              description: t.pricing.standard1.desc,
              buttonText: t.pricing.standard1.btn,
              href: "#contact",
              isPopular: false,
            },
            {
              name: t.pricing.standard2.title,
              price: t.pricing.standard2.price,
              yearlyPrice: t.pricing.standard2.price,
              period: t.pricing.standard2.period,
              features: t.pricing.standard2.features,
              description: t.pricing.standard2.desc,
              buttonText: t.pricing.standard2.btn,
              href: "#contact",
              isPopular: true,
            },
            {
              name: t.pricing.event.title,
              price: t.pricing.event.price,
              yearlyPrice: t.pricing.event.price,
              period: t.pricing.event.period,
              features: t.pricing.event.features,
              description: t.pricing.event.desc,
              buttonText: t.pricing.event.btn,
              href: "mailto:gzadvertisment@gmail.com",
              isPopular: false,
            }
          ]}
          title={t.pricing.titlePrefix + " " + t.pricing.titleGradient}
          description={t.pricing.subtitle}
          calculatorLabels={t.pricing.calculator}
          switchLabels={t.pricing.switch}
        />
      </section>

      {/* Comparison Section */}
      <section className="comparison-section" id="comparison">
        <div className="custom-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="section-header"
          >
            <h2>{t.comparison.titlePrefix} <span className="gradient-text">{t.comparison.titleGradient}</span></h2>
            <p>{t.comparison.subtitle}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="comparison-container"
          >
            <div className="comparison-grid header">
              <div className="comparison-feature">{t.comparison.headers[0]}</div>
              <div className="comparison-traditional">{t.comparison.headers[1]}</div>
              <div className="comparison-gzad">{t.comparison.headers[2]}</div>
            </div>
            {t.comparison.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 * i + 0.4 }}
                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)", x: 5 }}
                className="comparison-grid row"
              >
                <div className="comparison-feature">{item.feature}</div>
                <div className="comparison-traditional">{item.traditional}</div>
                <div className="comparison-gzad">
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className="gzad-highlight"
                  >
                    {item.gzad}
                  </motion.span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Background Decoration */}
        <div className="comparison-glow"></div>
      </section>

      {/* FAQ Section */}
      <section className="faq" id="faq">
        <div className="custom-container">
          <div className="section-header">
            <h2>{t.faq.titlePrefix} <span className="gradient-text">{t.faq.titleGradient}</span></h2>
          </div>
          <div className="faq-grid">
            {t.faq.items.map((faq, index) => (
              <div key={index} className={`faq-item ${activeFaq === index ? 'active' : ''}`}>
                <button className="faq-question" onClick={() => toggleFaq(index)}>
                  <h3>{faq.question}</h3>
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta" id="get-started">
        <div className="custom-container">
          <div className="cta-content">
            <h2>{t.cta.titlePrefix} <span className="gradient-text">{t.cta.titleGradient}</span></h2>
            <p>{t.cta.description}</p>
            <div className="cta-buttons">
              <a href="mailto:gzadvertisment@gmail.com" className="btn btn-primary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {t.cta.contact}
              </a>
              <a href="tel:+995591410914" className="btn btn-secondary">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {t.cta.call}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact">
        <div className="custom-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="logo">
                <div className="logo-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="8" width="18" height="10" rx="2" fill="var(--dark)" />
                    <rect x="5" y="10" width="14" height="6" rx="1" fill="var(--primary)" />
                  </svg>
                </div>
                Gzad
              </a>
              <p>{t.footer.tagline}</p>
            </div>
            <div className="footer-links">
              <h4>{t.footer.platform}</h4>
              <ul>
                <li><a href="#advertisers">{t.nav.advertisers}</a></li>
                <li><a href="#drivers">{t.nav.drivers}</a></li>
                <li><a href="#pricing">{t.nav.pricing}</a></li>
                <li><a href="#faq">{t.nav.faq}</a></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>{t.footer.company}</h4>
              <ul>
                <li><a href="#">{t.footer.about}</a></li>
                <li><a href="#">{t.footer.careers}</a></li>
                <li><a href="#">{t.footer.blog}</a></li>
                <li><a href="#">{t.footer.press}</a></li>
              </ul>
            </div>
            <div className="footer-links">
              <h4>{t.footer.contact}</h4>
              <ul>
                <li><a href="mailto:gzadvertisment@gmail.com">gzadvertisment@gmail.com</a></li>
                <li><a href="tel:+995591410914">+995 591 410 914</a></li>
                <li><a href="#">{lang === 'ge' ? 'თბილისი, საქართველო' : 'Tbilisi, Georgia'}</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>{t.footer.rights}</p>
            <div className="social-links">
              <a href="#" aria-label="Facebook">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                  <rect x="2" y="9" width="4" height="12" />
                  <circle cx="4" cy="4" r="2" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
