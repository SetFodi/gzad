'use client';

import { useState, useEffect } from 'react';
import { translations } from './translations';
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('advertisers');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [adIndex, setAdIndex] = useState(0);
  const [lang, setLang] = useState<'en' | 'ge'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check local storage or system memory
    const savedTheme = localStorage.getItem('gzad-theme');
    if (savedTheme) {
      setTheme(savedTheme as 'light' | 'dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gzad-theme', theme);
  }, [theme]);

  const t = translations[lang];

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
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
    const interval = setInterval(() => {
      setAdIndex((i) => (i + 1) % t.hero.marqueeAds.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [t.hero.marqueeAds.length]);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 1.2 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F1E2D1] dark:bg-[#541A1A] text-[#541A1A] dark:text-[#F1E2D1] selection:bg-[#810B38]/20 dark:selection:bg-[#810B38]/40 selection:text-[#810B38] dark:selection:text-[#F1E2D1] overflow-hidden font-sans font-light transition-colors duration-500">
      
      {/* Navbar — refined boutique */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-[#F1E2D1]/95 dark:bg-[#541A1A]/95 backdrop-blur-md border-b border-[#DCC3AA] dark:border-[#DCC3AA]/20 py-4' : 'bg-transparent py-7'}`}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex items-center justify-between">
          
          {/* Left Flex: Logo */}
          <div className="flex-1 flex justify-start">
            <a href="#" className="flex items-center gap-2.5 group">
              <span className="font-serif italic text-2xl tracking-tight text-[#541A1A] dark:text-[#F1E2D1]">Gzad</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#810B38] dark:bg-[#DCC3AA] group-hover:scale-150 transition-transform duration-300" />
            </a>
          </div>

          {/* Center Flex: Links */}
          <ul className="hidden lg:flex flex-1 justify-center items-center gap-10 text-[12px] font-medium tracking-[0.15em] uppercase text-[#541A1A]/80 dark:text-[#DCC3AA]">
            <li><a href="#how-it-works" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">{t.nav.howItWorks}</a></li>
            <li><a href="#advertisers" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">{t.nav.advertisers}</a></li>
            <li><a href="#drivers" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">{t.nav.drivers}</a></li>
            <li><a href="#pricing" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">{t.nav.pricing}</a></li>
          </ul>

          {/* Right Flex: Actions */}
          <div className="flex-1 flex justify-end items-center gap-6">
            <div lang="en" className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-[#541A1A]/70 dark:text-[#DCC3AA]">
              <button
                lang="en"
                onClick={() => setLang('en')}
                className={`transition-all duration-300 pb-0.5 border-b ${lang === 'en' ? 'border-[#810B38] text-[#810B38] dark:border-[#DCC3AA] dark:text-[#DCC3AA]' : 'border-transparent hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'}`}
              >
                EN
              </button>
              <span lang="en" className="text-[#DCC3AA]">·</span>
              <button
                lang="en"
                onClick={() => setLang('ge')}
                className={`transition-all duration-300 pb-0.5 border-b ${lang === 'ge' ? 'border-[#810B38] text-[#810B38] dark:border-[#DCC3AA] dark:text-[#DCC3AA]' : 'border-transparent hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'}`}
              >
                GE
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-9 h-9 border border-[#541A1A]/20 dark:border-[#DCC3AA]/30 flex items-center justify-center text-[#810B38] dark:text-[#DCC3AA] hover:bg-[#810B38] hover:text-[#F1E2D1] hover:border-[#810B38] dark:hover:bg-[#DCC3AA] dark:hover:text-[#541A1A] transition-colors duration-300"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </button>

            {/* Login Button */}
            <a href="/portal/login" className="hidden lg:inline-flex items-center justify-center text-[#541A1A]/75 dark:text-[#DCC3AA] text-[12px] font-medium tracking-[0.15em] uppercase hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">
              {lang === 'en' ? 'Log In' : 'შესვლა'}
            </a>

            {/* Fleet Signup Button */}
            <a href="/portal/fleet-signup" className="hidden lg:inline-flex items-center justify-center px-6 py-2.5 bg-[#810B38] dark:bg-[#810B38] text-[#F1E2D1] text-[11px] font-semibold tracking-[0.25em] uppercase hover:bg-[#541A1A] dark:hover:bg-[#DCC3AA] dark:hover:text-[#541A1A] transition-colors duration-300">
              {lang === 'en' ? 'Sign Up' : 'რეგისტრაცია'}
            </a>
          </div>

        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative paper-grain pt-24 pb-12 lg:pt-28 lg:pb-16 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 flex flex-col items-center text-center">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-4xl mx-auto flex flex-col items-center relative z-10">

          <motion.h1 variants={fadeIn} className="text-5xl md:text-6xl lg:text-[80px] font-normal leading-[1.02] tracking-tight mb-8 text-[#541A1A] dark:text-[#F1E2D1] text-balance">
            {t.hero.titlePrefix} <br className="hidden md:block"/>
            <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">{t.hero.titleGradient}</span>
          </motion.h1>

          <motion.p variants={fadeIn} className="text-lg md:text-xl text-[#541A1A]/75 dark:text-[#DCC3AA] max-w-2xl font-light mb-12 leading-relaxed">
            <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">— </span>{t.hero.description}
          </motion.p>

          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-5 items-center">
            <a href="#advertisers" className="px-10 py-4 bg-[#810B38] dark:bg-[#810B38] text-[#F1E2D1] font-semibold tracking-wide text-[13px] uppercase hover:bg-[#541A1A] dark:hover:bg-[#DCC3AA] dark:hover:text-[#541A1A] transition-colors duration-300">
              {t.hero.startAdvertising}
            </a>
            <a href="#drivers" className="px-10 py-4 text-[#541A1A] dark:text-[#F1E2D1] font-semibold text-[13px] uppercase tracking-wide border border-[#541A1A]/30 dark:border-[#DCC3AA]/30 bg-transparent hover:bg-[#541A1A] hover:text-[#F1E2D1] dark:hover:bg-[#DCC3AA] dark:hover:text-[#541A1A] transition-colors duration-300 flex items-center gap-3 group">
              {t.hero.becomeDriver}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:translate-x-1 transition-transform duration-300">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>
        </motion.div>

        {/* Vintage Marquee LED — Boutique signage style with rotating ad creative */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4 }}
          className="w-full max-w-[680px] mx-auto mt-16 relative z-10"
        >
          {/* Top-mount brackets — minimal brass tabs */}
          <div className="absolute -top-3 left-12 w-10 h-3 bg-gradient-to-b from-[#DCC3AA] to-[#810B38] rounded-t-sm" />
          <div className="absolute -top-3 right-12 w-10 h-3 bg-gradient-to-b from-[#DCC3AA] to-[#810B38] rounded-t-sm" />

          <div className="marquee-frame">
            <div className="marquee-screen">
              <AnimatePresence mode="wait">
                <motion.div
                  key={adIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.6 }}
                  className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10"
                >
                  <span className="text-[9px] md:text-[10px] tracking-[0.4em] text-[#810B38] uppercase font-semibold">
                    {t.hero.marqueeAds[adIndex].eyebrow}
                  </span>
                  <span className="mt-2 font-serif italic text-3xl md:text-5xl lg:text-6xl text-[#541A1A] leading-none">
                    {t.hero.marqueeAds[adIndex].brand}
                  </span>
                  <span className="mt-3 text-[11px] md:text-sm text-[#810B38] tracking-wide font-light">
                    {t.hero.marqueeAds[adIndex].tagline}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between mt-3 px-2 text-[9px] text-[#DCC3AA]/80 tracking-[0.3em]">
              <span>GZAD MATRIX&trade;</span>
              <span className="flex items-center gap-1.5">
                {t.hero.marqueeAds.map((_, i) => (
                  <span key={i} className={`h-1 w-1 rounded-full transition-colors duration-500 ${i === adIndex ? 'bg-[#DCC3AA]' : 'bg-[#DCC3AA]/30'}`} />
                ))}
              </span>
              <span>{String(adIndex + 1).padStart(2, '0')} / {String(t.hero.marqueeAds.length).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Soft cast shadow under marquee (warm, not pure black) */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[80%] h-8 bg-[#541A1A]/20 blur-2xl rounded-full pointer-events-none" />
        </motion.div>
      </section>

      {/* Stats — magazine pull-quote treatment */}
      <section className="paper-grain py-28 border-y border-[#DCC3AA] dark:border-[#DCC3AA]/20 bg-[#F1E2D1]/40 dark:bg-[#541A1A] relative z-10">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center divide-y md:divide-y-0 md:divide-x divide-[#DCC3AA] dark:divide-[#DCC3AA]/20">
            <motion.div variants={fadeIn} className="pt-8 md:pt-0 flex flex-col items-center">
              <span className="font-serif italic text-6xl md:text-7xl text-[#810B38] dark:text-[#DCC3AA] mb-4 leading-none">50K+</span>
              <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[#541A1A]/70 dark:text-[#DCC3AA]/80">{t.hero.stats.impressions}</span>
            </motion.div>
            <motion.div variants={fadeIn} className="pt-8 md:pt-0 flex flex-col items-center">
              <span className="font-serif italic text-6xl md:text-7xl text-[#810B38] dark:text-[#DCC3AA] mb-4 leading-none">10x</span>
              <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[#541A1A]/70 dark:text-[#DCC3AA]/80">{t.hero.stats.cheaper}</span>
            </motion.div>
            <motion.div variants={fadeIn} className="pt-8 md:pt-0 flex flex-col items-center">
              <span className="font-serif italic text-6xl md:text-7xl text-[#810B38] dark:text-[#DCC3AA] mb-4 leading-none">24/7</span>
              <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-[#541A1A]/70 dark:text-[#DCC3AA]/80">{t.hero.stats.coverage}</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problem — boutique editorial tiles */}
      <section className="py-32 lg:py-44 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 relative">
        <motion.div className="mb-24 text-center max-w-3xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}>
          <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 leading-tight text-[#541A1A] dark:text-[#F1E2D1]">
            {t.problem.titlePrefix} <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">{t.problem.titleGradient}</span>
          </h2>
          <p className="text-lg text-[#541A1A]/70 dark:text-[#DCC3AA] font-light max-w-xl mx-auto">{t.problem.subtitle}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {t.problem.cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, duration: 1 }}
              className="boutique-card p-10 lg:p-14 group"
            >
              <div className="flex items-start justify-between mb-6">
                <span className="font-serif italic text-3xl text-[#810B38] dark:text-[#DCC3AA] leading-none">
                  {['I', 'II', 'III', 'IV'][i]}
                </span>
                <span className="text-[#810B38] dark:text-[#DCC3AA] opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                  {[
                    <svg key="0" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
                    <svg key="1" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
                    <svg key="2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
                    <svg key="3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  ][i]}
                </span>
              </div>
              <div className="h-px bg-[#DCC3AA] dark:bg-[#DCC3AA]/30 w-12 mb-6" />
              <h3 className="text-2xl font-normal tracking-tight mb-4 text-[#541A1A] dark:text-[#F1E2D1]">{card.title}</h3>
              <p className="text-[#541A1A]/75 dark:text-[#DCC3AA] font-light leading-relaxed">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Solution Section */}
      <section id="how-it-works" className="py-24 lg:py-32 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 relative">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="order-2 lg:order-1 relative">
            {/* Phone mockup — brass-frame boutique treatment */}
            <motion.div variants={fadeIn} className="w-full max-w-[320px] mx-auto lg:mx-0 aspect-[9/19] rounded-[40px] p-[3px] relative" style={{ background: 'linear-gradient(180deg, #DCC3AA 0%, #810B38 100%)', boxShadow: '0 40px 70px -20px rgba(84, 26, 26, 0.25)' }}>
              <div className="w-full h-full rounded-[38px] bg-[#F1E2D1] dark:bg-[#541A1A] paper-grain overflow-hidden relative flex flex-col">
                <div className="absolute top-0 w-full h-7 flex justify-center z-50">
                  <div className="w-24 h-6 bg-[#541A1A] dark:bg-[#810B38] rounded-b-3xl" />
                </div>

                <div className="flex-1 pt-14 p-6 flex flex-col relative z-10">

                  <span className="text-[10px] tracking-[0.3em] text-[#810B38] dark:text-[#DCC3AA] uppercase font-semibold mb-2">{t.solution.dashboard.subtitle}</span>
                  <h3 className="font-serif italic text-2xl text-[#541A1A] dark:text-[#F1E2D1] mb-1 leading-none">{t.solution.dashboard.title}</h3>
                  <div className="h-px w-10 bg-[#810B38] dark:bg-[#DCC3AA] mt-3 mb-6" />

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="boutique-card p-4">
                      <div className="font-serif italic text-2xl text-[#810B38] dark:text-[#DCC3AA] mb-1 leading-none">12.4K</div>
                      <div className="text-[9px] text-[#541A1A]/70 dark:text-[#DCC3AA]/80 uppercase tracking-[0.25em] font-semibold">{t.solution.dashboard.impressions}</div>
                    </div>
                    <div className="boutique-card p-4">
                      <div className="font-serif italic text-2xl text-[#810B38] dark:text-[#DCC3AA] mb-1 leading-none">8</div>
                      <div className="text-[9px] text-[#541A1A]/70 dark:text-[#DCC3AA]/80 uppercase tracking-[0.25em] font-semibold">{t.solution.dashboard.activeTaxis}</div>
                    </div>
                    <div className="boutique-card p-4">
                      <div className="font-serif italic text-2xl text-[#810B38] dark:text-[#DCC3AA] mb-1 leading-none">₾142</div>
                      <div className="text-[9px] text-[#541A1A]/70 dark:text-[#DCC3AA]/80 uppercase tracking-[0.25em] font-semibold">{t.solution.dashboard.spent}</div>
                    </div>
                    <div className="boutique-card p-4 !bg-[#810B38] dark:!bg-[#810B38]" style={{ borderColor: '#541A1A' }}>
                      <div className="font-serif italic text-2xl text-[#F1E2D1] mb-1 leading-none">4.2x</div>
                      <div className="text-[9px] text-[#F1E2D1]/80 uppercase tracking-[0.25em] font-semibold">{t.solution.dashboard.vsBillboard}</div>
                    </div>
                  </div>

                  <div className="flex-1 boutique-card relative overflow-hidden flex flex-col items-center justify-center">
                    <span className="absolute top-3 left-4 text-[#541A1A]/70 dark:text-[#DCC3AA]/80 text-[9px] tracking-[0.3em] font-semibold uppercase">Live Map</span>
                    <div className="w-3 h-3 bg-[#810B38] rounded-full ring-2 ring-[#DCC3AA] ring-offset-2 ring-offset-[#F1E2D1] dark:ring-offset-[#541A1A]" />
                    <span className="absolute bottom-3 right-4 text-[#541A1A]/40 dark:text-[#DCC3AA]/50 text-[9px] tracking-widest">Tbilisi</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="order-1 lg:order-2">
            <motion.h2 variants={fadeIn} className="text-4xl md:text-5xl font-normal tracking-tight mb-6 leading-tight text-[#541A1A] dark:text-[#F1E2D1]">
              {t.solution.titlePrefix} <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA] block pb-2">{t.solution.titleGradient}</span> <span className="text-[#541A1A]/70 dark:text-[#DCC3AA]">{t.solution.titleSuffix}</span>
            </motion.h2>
            <motion.p variants={fadeIn} className="text-lg text-[#541A1A]/75 dark:text-[#DCC3AA] font-light mb-16 leading-relaxed max-w-lg">
              <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">— </span>{t.solution.description}
            </motion.p>

            <div className="flex flex-col">
              {t.solution.features.map((feature, i) => (
                <motion.div key={i} variants={fadeIn} className="flex gap-8 items-start group py-6 border-t border-[#DCC3AA] dark:border-[#DCC3AA]/20 first:border-t-0">
                  <div className="w-11 h-11 rounded-full border border-[#810B38] dark:border-[#DCC3AA]/50 flex items-center justify-center text-[#810B38] dark:text-[#DCC3AA] shrink-0 transition-all duration-300 group-hover:bg-[#810B38] group-hover:text-[#F1E2D1] dark:group-hover:bg-[#DCC3AA] dark:group-hover:text-[#541A1A]">
                    {[
                      <svg key="0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
                      <svg key="1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
                      <svg key="2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
                      <svg key="3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                    ][i]}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-normal tracking-tight mb-2 text-[#541A1A] dark:text-[#F1E2D1]">{feature.title}</h4>
                    <p className="text-[#541A1A]/70 dark:text-[#DCC3AA] text-[15px] font-light leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Two Sided — refined hairline tabs + SVG icons */}
      <section id="advertisers" className="py-32 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 relative">
        <div className="text-center mb-16 max-w-2xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 leading-tight text-[#541A1A] dark:text-[#F1E2D1]">
            {t.twoSided.titlePrefix} <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">{t.twoSided.titleGradient}</span>
          </h2>
          <p className="text-[#541A1A]/70 dark:text-[#DCC3AA] font-light text-lg">{t.twoSided.subtitle}</p>
        </div>

        <div className="flex justify-center mb-16 relative z-10">
          <div className="inline-flex border-b border-[#DCC3AA] dark:border-[#DCC3AA]/30">
            <button
              onClick={() => setActiveTab('advertisers')}
              className={`px-8 py-4 -mb-px border-b-2 text-[12px] font-semibold uppercase tracking-[0.25em] transition-colors duration-300 ${activeTab === 'advertisers' ? 'border-[#810B38] text-[#810B38] dark:text-[#DCC3AA] dark:border-[#DCC3AA]' : 'border-transparent text-[#541A1A]/50 dark:text-[#DCC3AA]/50 hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'}`}
            >
              {t.twoSided.advertisersTab}
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-8 py-4 -mb-px border-b-2 text-[12px] font-semibold uppercase tracking-[0.25em] transition-colors duration-300 ${activeTab === 'drivers' ? 'border-[#810B38] text-[#810B38] dark:text-[#DCC3AA] dark:border-[#DCC3AA]' : 'border-transparent text-[#541A1A]/50 dark:text-[#DCC3AA]/50 hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'}`}
            >
              {t.twoSided.driversTab}
            </button>
          </div>
        </div>

        <div className="relative min-h-[400px] z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {(activeTab === 'advertisers' ? t.twoSided.advertisersBenefits : t.twoSided.driversBenefits).map((benefit, i) => {
                const advertiserIcons = [
                  <svg key="0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
                  <svg key="1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                  <svg key="2" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                  <svg key="3" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                  <svg key="4" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
                  <svg key="5" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                ];
                const driverIcons = [
                  <svg key="0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
                  <svg key="1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                  <svg key="2" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
                  <svg key="3" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
                  <svg key="4" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                  <svg key="5" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ];
                const icon = activeTab === 'advertisers' ? advertiserIcons[i] : driverIcons[i];
                return (
                  <div key={i} className="boutique-card p-10 group">
                    <span className="inline-flex w-12 h-12 items-center justify-center rounded-full border border-[#810B38] dark:border-[#DCC3AA]/50 text-[#810B38] dark:text-[#DCC3AA] mb-8 transition-colors duration-300 group-hover:bg-[#810B38] group-hover:text-[#F1E2D1] dark:group-hover:bg-[#DCC3AA] dark:group-hover:text-[#541A1A]">
                      {icon}
                    </span>
                    <h3 className="text-xl font-normal tracking-tight mb-3 text-[#541A1A] dark:text-[#F1E2D1] group-hover:font-serif group-hover:italic transition-all duration-300">{benefit.title}</h3>
                    <div className="h-px w-8 bg-[#DCC3AA] dark:bg-[#DCC3AA]/30 mb-4" />
                    <p className="text-[#541A1A]/70 dark:text-[#DCC3AA] text-[15px] font-light leading-relaxed">{benefit.desc}</p>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Pricing — bespoke card on tan paper */}
      <section id="pricing" className="paper-grain py-32 px-6 lg:px-12 relative border-y border-[#DCC3AA] dark:border-[#DCC3AA]/20 bg-[#DCC3AA] dark:bg-[#541A1A]">
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto flex flex-col items-center">
            <span className="eyebrow-rule mb-8" style={{ color: '#810B38' }}>{t.pricing.eyebrow}</span>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 leading-tight text-[#541A1A] dark:text-[#F1E2D1]">
              {t.pricing.titlePrefix} <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">{t.pricing.titleGradient}</span>
            </h2>
            <p className="text-lg text-[#541A1A]/75 dark:text-[#DCC3AA] font-light max-w-xl">{t.pricing.subtitle}</p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="boutique-card p-10 md:p-16 text-center flex flex-col items-center">
              <span className="font-serif italic text-3xl md:text-4xl text-[#810B38] dark:text-[#DCC3AA] mb-3 leading-none">
                {t.pricing.contactOnlyTitle}
              </span>
              <div className="h-px w-12 bg-[#810B38] dark:bg-[#DCC3AA] mt-4 mb-8" />
              <p className="text-[#541A1A]/75 dark:text-[#DCC3AA] text-[15px] font-light mb-10 leading-relaxed max-w-xl">
                {t.pricing.contactOnlyDesc}
              </p>
              <a
                href="mailto:gzadvertisment@gmail.com"
                className="inline-flex items-center justify-center px-10 py-4 bg-[#810B38] dark:bg-[#810B38] text-[#F1E2D1] font-semibold tracking-[0.2em] uppercase text-[12px] hover:bg-[#541A1A] dark:hover:bg-[#DCC3AA] dark:hover:text-[#541A1A] transition-colors"
              >
                {t.pricing.contactOnlyBtn}
              </a>
              <p className="mt-6 text-[12px] text-[#541A1A]/60 dark:text-[#DCC3AA]/60 tracking-wide font-light">
                gzadvertisment@gmail.com
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — hairline-divided list */}
      <section id="faq" className="py-32 px-6 lg:px-12 max-w-[900px] mx-auto z-10 relative">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 text-[#541A1A] dark:text-[#F1E2D1]">
            {t.faq.titlePrefix} <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">{t.faq.titleGradient}</span>
          </h2>
        </div>
        <ul className="divide-y divide-[#DCC3AA] dark:divide-[#DCC3AA]/20 border-y border-[#DCC3AA] dark:border-[#DCC3AA]/20">
          {t.faq.items.map((faq, index) => (
            <li key={index}>
              <button
                className="w-full text-left py-6 lg:py-8 flex justify-between items-center focus:outline-none group"
                onClick={() => toggleFaq(index)}
              >
                <h3 className="text-lg lg:text-xl font-normal pr-8 text-[#541A1A] dark:text-[#F1E2D1] group-hover:text-[#810B38] dark:group-hover:text-[#DCC3AA] transition-colors duration-300">{faq.question}</h3>
                <span className={`text-2xl font-light text-[#810B38] dark:text-[#DCC3AA] transform transition-transform duration-500 shrink-0 ${activeFaq === index ? 'rotate-45' : ''}`}>+</span>
              </button>
              <AnimatePresence>
                {activeFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-8 pr-12 text-[15px] text-[#541A1A]/75 dark:text-[#DCC3AA] font-light leading-relaxed max-w-3xl">
                      <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">— </span>{faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA — espresso block with ornament */}
      <section id="get-started" className="pt-24 pb-32 px-6 relative flex items-center justify-center text-center">
        <div className="max-w-4xl w-full mx-auto relative z-10 bg-[#541A1A] p-12 lg:p-20 rounded-2xl overflow-hidden">
          {/* Top hairline cream rule + ornament */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="h-px w-12 bg-[#DCC3AA]/50" />
            <span className="text-[#DCC3AA] text-lg leading-none">❦</span>
            <span className="h-px w-12 bg-[#DCC3AA]/50" />
          </div>

          <span className="inline-flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#DCC3AA] mb-10">
            <span className="h-px w-8 bg-[#DCC3AA]/40" />
            {t.cta.eyebrow}
            <span className="h-px w-8 bg-[#DCC3AA]/40" />
          </span>

          <h2 className="text-4xl md:text-6xl font-normal tracking-tight mb-8 leading-[1.05] text-[#F1E2D1]">
            {t.cta.titlePrefix} <br className="hidden md:block"/><span className="font-serif italic text-[#DCC3AA]">{t.cta.titleGradient}</span>
          </h2>
          <p className="text-lg font-light text-[#DCC3AA]/80 mb-12 leading-relaxed max-w-xl mx-auto">
            <span className="font-serif italic">— </span>{t.cta.description}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-5">
            <a href="mailto:gzadvertisment@gmail.com" className="px-10 py-4 bg-[#810B38] text-[#F1E2D1] font-semibold uppercase tracking-[0.2em] text-[12px] hover:bg-[#DCC3AA] hover:text-[#541A1A] transition-colors duration-300">
              {t.cta.contact}
            </a>
            <a href="tel:+995591410914" className="px-10 py-4 bg-transparent text-[#DCC3AA] font-semibold uppercase tracking-[0.2em] text-[12px] border border-[#DCC3AA]/40 hover:bg-[#DCC3AA] hover:text-[#541A1A] hover:border-[#DCC3AA] transition-colors duration-300">
              {t.cta.call}
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER — boutique tan + paper grain */}
      <footer id="contact" className="paper-grain py-24 px-6 lg:px-12 bg-[#DCC3AA] dark:bg-[#541A1A] border-t border-[#DCC3AA] dark:border-[#DCC3AA]/20 relative">
        <div className="max-w-[1400px] mx-auto relative z-10">

          {/* Centered ornamental rule */}
          <div className="flex justify-center mb-16">
            <span className="eyebrow-rule" style={{ color: '#810B38' }}>Gzad · Tbilisi</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-16 lg:gap-12 mb-20 justify-items-start lg:justify-items-center">

            {/* Brand Column */}
            <div className="lg:col-span-2 w-full flex flex-col items-start lg:justify-self-start">
              <a href="#" className="flex items-center gap-3 mb-6 group inline-flex">
                <span className="font-serif italic text-3xl tracking-tight text-[#541A1A] dark:text-[#F1E2D1]">Gzad</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#810B38] dark:bg-[#DCC3AA]" />
              </a>
              <p className="text-[#541A1A]/75 dark:text-[#DCC3AA] font-light text-[14px] leading-relaxed max-w-sm mb-10 text-left">
                <span className="font-serif italic text-[#810B38] dark:text-[#DCC3AA]">— </span>{t.footer.tagline}
              </p>
              <div className="flex gap-5 text-[#541A1A] dark:text-[#DCC3AA]">
                <a href="#" aria-label="Facebook" className="hover:text-[#810B38] transition-colors duration-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                </a>
                <a href="#" aria-label="Instagram" className="hover:text-[#810B38] transition-colors duration-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </a>
                <a href="#" aria-label="LinkedIn" className="hover:text-[#810B38] transition-colors duration-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
                </a>
              </div>
            </div>

            {/* Navigation Links Columns */}
            <div className="w-full flex flex-col items-start lg:items-center">
              <div className="text-left w-full max-w-[180px]">
                <h4 className="text-[#541A1A] dark:text-[#F1E2D1] font-semibold tracking-[0.3em] text-[10px] uppercase">{t.footer.platform}</h4>
                <div className="h-px w-8 bg-[#810B38] my-5" />
                <ul className="space-y-4 text-[#541A1A]/75 dark:text-[#DCC3AA] text-[14px] font-light">
                  <li><a href="#how-it-works" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.nav.howItWorks}</a></li>
                  <li><a href="#advertisers" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.nav.advertisers}</a></li>
                  <li><a href="#drivers" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.nav.drivers}</a></li>
                  <li><a href="#pricing" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.nav.pricing}</a></li>
                </ul>
              </div>
            </div>

            <div className="w-full flex flex-col items-start lg:items-center">
              <div className="text-left w-full max-w-[180px]">
                <h4 className="text-[#541A1A] dark:text-[#F1E2D1] font-semibold tracking-[0.3em] text-[10px] uppercase">{t.footer.company}</h4>
                <div className="h-px w-8 bg-[#810B38] my-5" />
                <ul className="space-y-4 text-[#541A1A]/75 dark:text-[#DCC3AA] text-[14px] font-light">
                  <li><a href="#" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.footer.about}</a></li>
                  <li><a href="#faq" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.nav.faq}</a></li>
                  <li><a href="#" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.footer.press}</a></li>
                  <li><a href="#" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">{t.footer.careers}</a></li>
                </ul>
              </div>
            </div>

            {/* Contact Column */}
            <div className="w-full flex flex-col items-start lg:justify-self-end">
              <div className="text-left w-full">
                <h4 className="text-[#541A1A] dark:text-[#F1E2D1] font-semibold tracking-[0.3em] text-[10px] uppercase">{t.footer.contact}</h4>
                <div className="h-px w-8 bg-[#810B38] my-5" />
                <ul className="space-y-4 text-[#541A1A]/75 dark:text-[#DCC3AA] text-[14px] font-light">
                  <li>
                    <a href="mailto:gzadvertisment@gmail.com" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block">
                      gzadvertisment@gmail.com
                    </a>
                  </li>
                  <li>
                    <a href="tel:+995591410914" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300 inline-block pt-1">
                      +995 591 410 914
                    </a>
                  </li>
                  <li className="pt-4 text-[#541A1A]/60 dark:text-[#DCC3AA]/70 text-[13px] font-serif italic">
                    {lang === 'ge' ? 'თბილისი, საქართველო' : 'Tbilisi, Georgia'}
                  </li>
                </ul>
              </div>
            </div>

          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-[#810B38]/20 dark:border-[#DCC3AA]/20 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[#541A1A]/70 dark:text-[#DCC3AA] text-[12px] font-light tracking-[0.15em]">{t.footer.rights} &copy; {new Date().getFullYear()}</p>
            <div className="flex gap-8 text-[12px] text-[#541A1A]/70 dark:text-[#DCC3AA] font-light tracking-[0.15em]">
              <a href="#" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">Privacy Policy</a>
              <a href="#" className="hover:text-[#810B38] dark:hover:text-[#F1E2D1] transition-colors duration-300">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
