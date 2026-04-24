'use client';

import { useState, useEffect } from 'react';
import { translations } from './translations';
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('advertisers');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [displayText, setDisplayText] = useState('YOUR BRAND VISIBLE 24/7');
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
    const messages = ['YOUR BRAND VISIBLE 24/7', '50,000+ DAILY IMPRESSIONS', 'HIGH ROI ADVERTISING', 'REACH THE WHOLE CITY'];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setDisplayText(messages[index]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-[#050505] text-[#1C1A19] dark:text-[#FAFAFA] selection:bg-[#166534]/20 dark:selection:bg-emerald-500/30 selection:text-[#166534] dark:selection:text-emerald-50 overflow-hidden font-sans font-light transition-colors duration-500">
      
      {/* Refined Ambient Light (Hardware Accelerated) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#166534] dark:bg-emerald-900 opacity-[0.03] dark:opacity-[0.05] blur-[100px] dark:blur-[150px] pointer-events-none rounded-full transform-gpu will-change-transform transition-all duration-700" />
      
      {/* PERFECTED FULL-WIDTH NAVBAR (LIGHT MODE) */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-700 ${scrolled ? 'bg-white/80 dark:bg-black/70 backdrop-blur-2xl border-b border-[#E5E0D8]/70 dark:border-white/10 py-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_rgba(28,26,25,0.04)]' : 'bg-transparent py-8'}`}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex items-center justify-between">

          {/* Left Flex: Logo */}
          <div className="flex-1 flex justify-start">
            <a href="#" className="flex items-center gap-3 group">
              <span className="text-2xl font-bold tracking-[-0.04em] text-[#1C1A19] dark:text-[#FAFAFA]">G<span className="font-serif italic font-light text-[#166534] dark:text-emerald-400">z</span>ad</span>
              <span className="relative w-1.5 h-1.5 rounded-full bg-[#166534] dark:bg-emerald-500 group-hover:scale-150 transition-transform duration-500 shadow-[0_0_10px_rgba(22,101,52,0.45)]">
                <span className="absolute inset-0 rounded-full bg-[#166534] dark:bg-emerald-500 opacity-60 group-hover:animate-ping" />
              </span>
            </a>
          </div>

          {/* Center Flex: Links */}
          <ul className="hidden lg:flex flex-1 justify-center items-center gap-10 text-[12.5px] font-medium tracking-[0.02em] text-[#6B6561] dark:text-zinc-400">
            <li><a href="#how-it-works" className="relative inline-block hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:mx-auto after:h-px after:w-0 after:bg-[#166534] dark:after:bg-emerald-400 after:transition-all after:duration-500 hover:after:w-full">{t.nav.howItWorks}</a></li>
            <li><a href="#advertisers" className="relative inline-block hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:mx-auto after:h-px after:w-0 after:bg-[#166534] dark:after:bg-emerald-400 after:transition-all after:duration-500 hover:after:w-full">{t.nav.advertisers}</a></li>
            <li><a href="#drivers" className="relative inline-block hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:mx-auto after:h-px after:w-0 after:bg-[#166534] dark:after:bg-emerald-400 after:transition-all after:duration-500 hover:after:w-full">{t.nav.drivers}</a></li>
            <li><a href="#pricing" className="relative inline-block hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-1.5 after:mx-auto after:h-px after:w-0 after:bg-[#166534] dark:after:bg-emerald-400 after:transition-all after:duration-500 hover:after:w-full">{t.nav.pricing}</a></li>
          </ul>

          {/* Right Flex: Actions */}
          <div className="flex-1 flex justify-end items-center gap-8">
            <div className="flex items-center gap-3 text-[10.5px] font-bold tracking-[0.2em] text-[#8C857E] dark:text-zinc-500">
              <button
                onClick={() => setLang('en')}
                className={`transition-all duration-300 ${lang === 'en' ? 'text-[#166534] dark:text-emerald-400' : 'text-[#8C857E] dark:text-zinc-500 hover:text-[#1C1A19] dark:hover:text-white'}`}
              >
                EN
              </button>
              <span className="w-px h-3 bg-[#E5E0D8] dark:bg-white/15" />
              <button
                onClick={() => setLang('ge')}
                className={`transition-all duration-300 ${lang === 'ge' ? 'text-[#166534] dark:text-emerald-400' : 'text-[#8C857E] dark:text-zinc-500 hover:text-[#1C1A19] dark:hover:text-white'}`}
              >
                GE
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="relative w-10 h-10 rounded-full bg-white dark:bg-[#0A0A0A] border border-[#E5E0D8] dark:border-white/10 flex items-center justify-center text-[#8C857E] dark:text-zinc-400 hover:text-[#166534] dark:hover:text-emerald-400 hover:border-[#166534]/30 dark:hover:border-emerald-500/30 transition-all duration-500 overflow-hidden"
              aria-label="Toggle Theme"
            >
              <span className="absolute inset-0 bg-gradient-to-br from-[#166534]/0 to-[#166534]/[0.06] dark:from-emerald-500/0 dark:to-emerald-500/[0.08] opacity-0 hover:opacity-100 transition-opacity duration-500" />
              {theme === 'light' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="relative"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="relative"><circle cx="12" cy="12" r="4.5"></circle><line x1="12" y1="1.5" x2="12" y2="3.5"></line><line x1="12" y1="20.5" x2="12" y2="22.5"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1.5" y1="12" x2="3.5" y2="12"></line><line x1="20.5" y1="12" x2="22.5" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </button>

            {/* Login Button */}
            <a href="/portal/login" className="hidden lg:inline-flex items-center justify-center px-5 py-2.5 text-[#6B6561] dark:text-zinc-400 text-[12.5px] font-medium tracking-[0.04em] hover:text-[#166534] dark:hover:text-emerald-400 transition-all duration-300">
              {lang === 'en' ? 'Log In' : 'შესვლა'}
            </a>

            {/* Fleet Signup Button */}
            <a href="/portal/fleet-signup" className="hidden lg:inline-flex items-center justify-center px-7 py-2.5 bg-white dark:bg-black/60 border border-[#E5E0D8] dark:border-white/10 text-[#166534] dark:text-emerald-400 text-[12.5px] font-semibold tracking-[0.04em] rounded-full hover:bg-[#166534] dark:hover:bg-emerald-400 hover:text-white dark:hover:text-[#050505] hover:border-[#166534] dark:hover:border-emerald-400 transition-all duration-500 shadow-[0_4px_14px_rgba(28,26,25,0.04)] hover:shadow-[0_12px_28px_rgba(22,101,52,0.24)] dark:hover:shadow-[0_12px_28px_rgba(16,185,129,0.28)]">
              {lang === 'en' ? 'Sign Up' : 'რეგისტრაცია'}
            </a>
          </div>

        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 lg:pt-28 lg:pb-16 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 flex flex-col items-center text-center">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-4xl mx-auto flex flex-col items-center">
          
          <motion.div variants={fadeIn} className="mb-7">
            <span className="inline-flex items-center gap-2.5 pl-2 pr-5 py-1.5 rounded-full border border-[#166534]/20 dark:border-emerald-500/20 bg-[#166534]/[0.04] dark:bg-emerald-500/[0.08] backdrop-blur-md text-[10.5px] font-bold tracking-[0.22em] text-[#166534] dark:text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#166534] dark:bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#166534] dark:bg-emerald-400" />
              </span>
              THE PREMIUM DOOH NETWORK
            </span>
          </motion.div>

          <motion.h1 variants={fadeIn} className="text-[44px] md:text-6xl lg:text-[78px] font-medium leading-[1.02] tracking-[-0.035em] mb-7 text-[#1C1A19] dark:text-[#FAFAFA] text-balance">
            {t.hero.titlePrefix} <br className="hidden md:block"/>
            <span className="font-serif italic font-light text-[#166534] dark:text-emerald-400 pr-2">{t.hero.titleGradient}</span>
          </motion.h1>

          <motion.p variants={fadeIn} className="text-[17px] md:text-[19px] text-[#6B6561] dark:text-zinc-400 max-w-2xl font-light mb-10 leading-[1.65]">
            {t.hero.description}
          </motion.p>

          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 items-center">
            <a href="#advertisers" className="group relative px-10 py-[15px] bg-[#166534] dark:bg-emerald-500 text-white rounded-full font-semibold tracking-[0.04em] text-[13.5px] hover:bg-[#14532D] dark:hover:bg-emerald-400 hover:-translate-y-[2px] transition-all duration-500 inline-flex items-center gap-2 shadow-[0_10px_30px_rgba(22,101,52,0.28),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_18px_44px_rgba(22,101,52,0.42)]">
              <span>{t.hero.startAdvertising}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-0.5 transition-transform duration-500"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <a href="#drivers" className="px-10 py-[15px] text-[#1C1A19] dark:text-[#FAFAFA] font-medium text-[13.5px] tracking-[0.02em] border border-[#E5E0D8] dark:border-white/10 bg-white/80 dark:bg-black/60 rounded-full hover:border-[#166534]/40 dark:hover:border-emerald-500/50 hover:bg-[#166534]/[0.03] dark:hover:bg-emerald-500/[0.06] transition-all duration-500 inline-flex items-center gap-2 group backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_14px_rgba(28,26,25,0.03)] hover:-translate-y-[2px]">
              <span className="group-hover:text-[#166534] dark:group-hover:text-emerald-400 transition-colors duration-500">{t.hero.becomeDriver}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:translate-x-1 group-hover:text-[#166534] dark:group-hover:text-emerald-400 transition-all duration-500">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </motion.div>
        </motion.div>

        {/* ULTRA-REALISTIC LED TAXI MONITOR (Hardware remains dark for realism, LEDs go Vermilion) */}
        <motion.div 
          initial={{ opacity: 0, y: 150 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1.5, delay: 0.4 }}
          className="w-full max-w-[800px] mx-auto mt-8 relative perspective-[1500px] transform-gpu will-change-transform"
        >
          {/* Glowing car roof reflection (Hardware Accelerated) */}
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[120%] h-40 bg-[#166534] dark:bg-emerald-500 opacity-[0.1] blur-[80px] rounded-[100%] pointer-events-none transform-gpu rotate-x-[70deg] will-change-transform" />

          {/* Roof Mounts (The physical brackets) */}
          <div className="absolute -bottom-8 left-[15%] w-16 h-16 bg-gradient-to-b from-zinc-700 to-black rounded-lg transform rotate-x-[60deg] shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/10" />
          <div className="absolute -bottom-8 right-[15%] w-16 h-16 bg-gradient-to-b from-zinc-700 to-black rounded-lg transform rotate-x-[60deg] shadow-[0_20px_40px_rgba(0,0,0,0.5)] border border-white/10" />

          {/* Main 3D Container (Isometric perspective) */}
          <div className="relative w-full aspect-[21/8] transform-gpu rotate-x-[15deg] rotate-y-[-8deg] preserve-3d">
            
            {/* The Aerodynamic Hardware Shell (Beveled Casing remains dark) */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 via-zinc-900 to-[#020202] rounded-t-[3rem] rounded-b-[1.5rem] shadow-[-20px_40px_80px_rgba(0,0,0,0.4)] border-t border-l border-white/[0.2] border-r border-r-white/[0.05] border-b-black overflow-hidden flex flex-col items-center pt-3 pb-4 px-3" style={{ transformStyle: 'preserve-3d', transform: 'translateZ(20px) translate3d(0,0,0)' }}>
              
              {/* Glass / Plastic Arch Reflection */}
              <div className="absolute top-0 left-0 w-[40%] h-full bg-gradient-to-r from-white/[0.08] to-transparent transform -skew-x-[35deg] pointer-events-none z-30" />
              <div className="absolute top-0 w-full h-8 bg-gradient-to-b from-white/[0.1] to-transparent pointer-events-none z-30 rounded-t-[3rem]" />

              {/* Hardware Vents / Details (Top Edge) */}
              <div className="w-48 h-1 bg-black/80 rounded-full mb-3 shadow-[inset_0_1px_2px_rgba(0,0,0,1)]" />

              {/* The Actual Real-World LED Matrix Screen Layer */}
              <div className="relative flex-1 w-full bg-[#050101] border-2 border-[#000] rounded-2xl overflow-hidden shadow-[inset_0_20px_50px_rgba(0,0,0,1),_0_0_20px_rgba(0,0,0,0.6)] flex items-center">
                
                {/* Advanced dot-matrix pattern mask (Grid lines + dots) */}
                <div className="absolute inset-0 z-20 pointer-events-none mix-blend-multiply opacity-80" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.8) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
                <div className="absolute inset-0 z-20 pointer-events-none mix-blend-overlay opacity-30" style={{ backgroundImage: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,1) 100%)' }} />

                {/* LED Screen Glare */}
                <div className="absolute top-0 left-0 w-[150%] h-[30%] bg-gradient-to-b from-white/5 to-transparent transform rotate-[-5deg] origin-left pointer-events-none z-30 blur-sm" />

                {/* Animated Marquee Text (Vermilion) */}
                <div className="absolute whitespace-nowrap z-10 w-full flex overflow-hidden translate-z-0">
                  <motion.div 
                    animate={{ x: ["100%", "-100%"] }}
                    transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                    className="font-mono text-4xl md:text-6xl lg:text-[80px] font-black uppercase tracking-tight w-full flex items-center justify-center pt-2 transform-gpu will-change-transform"
                    style={{ 
                      color: '#22C55E', 
                      textShadow: '0 0 10px #34D399, 0 0 30px #22C55E, 0 0 60px #166534, 0 0 100px #064E3B',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {displayText}
                  </motion.div>
                </div>

                {/* Sub-text or hardware branding */}
                <div className="absolute bottom-2 right-4 z-10 text-[8px] font-mono text-[#166534] dark:text-emerald-400 tracking-widest font-bold opacity-40">
                  GZAD matrix&trade;
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Exquisite Stats Section (Light Version) */}
      <section className="py-24 border-y border-[#E5E0D8] dark:border-white/10 bg-gradient-to-r from-transparent via-white dark:via-zinc-900 to-transparent relative z-10">
        {/* Decorative top ornament */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#E5E0D8] dark:to-white/20" />
          <span className="w-1 h-1 rounded-full bg-[#166534]/50 dark:bg-emerald-500/60" />
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#E5E0D8] dark:to-white/20" />
        </div>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 relative">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center divide-y md:divide-y-0 md:divide-x divide-[#E5E0D8] dark:divide-white/10">
            <motion.div variants={fadeIn} className="pt-8 md:pt-0 flex flex-col items-center">
              <span className="font-serif text-6xl md:text-7xl font-light tracking-[-0.04em] text-[#1C1A19] dark:text-[#FAFAFA] mb-5 tabular-nums">50K<span className="text-[#166534]/70 dark:text-emerald-400/80 italic">+</span></span>
              <span className="text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#166534] dark:text-emerald-400">{t.hero.stats.impressions}</span>
            </motion.div>
            <motion.div variants={fadeIn} className="pt-8 md:pt-0 flex flex-col items-center">
              <span className="font-serif text-6xl md:text-7xl font-light tracking-[-0.04em] text-[#1C1A19] dark:text-[#FAFAFA] mb-5 tabular-nums">10<span className="italic text-[#166534]/70 dark:text-emerald-400/80">x</span></span>
              <span className="text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#166534] dark:text-emerald-400">{t.hero.stats.cheaper}</span>
            </motion.div>
            <motion.div variants={fadeIn} className="pt-8 md:pt-0 flex flex-col items-center">
              <span className="font-serif text-6xl md:text-7xl font-light tracking-[-0.04em] text-[#1C1A19] dark:text-[#FAFAFA] mb-5 tabular-nums">24<span className="text-[#166534]/40 dark:text-emerald-400/50">/</span>7</span>
              <span className="text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#166534] dark:text-emerald-400">{t.hero.stats.coverage}</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section (Light Glass Panels) */}
      <section className="py-32 lg:py-48 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 relative">
        <motion.div className="mb-24 text-center max-w-3xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}>
          <div className="inline-flex items-center gap-3 mb-6 text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#8C857E] dark:text-zinc-500">
            <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
            <span>01 — The Reality</span>
            <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
          </div>
          <h2 className="text-4xl md:text-[52px] font-medium tracking-[-0.03em] mb-6 leading-[1.08] text-[#1C1A19] dark:text-[#FAFAFA]">
            {t.problem.titlePrefix} <span className="font-serif italic font-light text-[#8C857E] dark:text-zinc-500">{t.problem.titleGradient}</span>
          </h2>
          <p className="text-[17px] text-[#6B6561] dark:text-zinc-400 font-light max-w-xl mx-auto leading-[1.6]">{t.problem.subtitle}</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {t.problem.cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.1, duration: 1 }}
              className="relative p-[1px] rounded-3xl bg-white dark:bg-black/60 border border-[#E5E0D8] dark:border-white/10 overflow-hidden group hover:border-[#166534]/30 dark:hover:border-emerald-500/30 hover:-translate-y-1.5 transition-all duration-700 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_rgba(28,26,25,0.03)] hover:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_24px_48px_rgba(22,101,52,0.08)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#166534]/0 via-transparent to-[#166534]/[0.04] dark:from-emerald-500/0 dark:to-emerald-500/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative h-full bg-white dark:bg-black/60 rounded-[23px] p-10 lg:p-14">
                <div className="w-14 h-14 rounded-2xl bg-[#FDFBF7] dark:bg-[#050505] border border-[#E5E0D8] dark:border-white/10 flex items-center justify-center text-[#166534] dark:text-emerald-400 mb-8 relative z-10 group-hover:-translate-y-1 group-hover:border-[#166534]/30 dark:group-hover:border-emerald-500/30 transition-all duration-500 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_4px_12px_rgba(28,26,25,0.04)]">
                  <div className="absolute inset-0 bg-[#166534]/10 dark:bg-emerald-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  {[
                    <svg key="0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
                    <svg key="1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
                    <svg key="2" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
                    <svg key="3" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  ][i]}
                </div>
                <h3 className="text-[21px] font-medium tracking-[-0.015em] mb-4 relative z-10 text-[#1C1A19] dark:text-[#FAFAFA]">{card.title}</h3>
                <p className="text-[#6B6561] dark:text-zinc-400 font-light leading-[1.65] relative z-10 text-[15px]">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Solution Section */}
      <section id="how-it-works" className="py-24 lg:py-32 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 relative">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="order-2 lg:order-1 relative perspective-[1000px]">
            {/* Light Glass Phone Mockup */}
            <motion.div variants={fadeIn} className="w-full max-w-[320px] mx-auto lg:mx-0 aspect-[9/19] rounded-[48px] bg-[#E5E0D8] p-[2px] shadow-[0_30px_80px_rgba(0,0,0,0.1),_0_0_80px_rgba(22,101,52,0.05)] relative transform rotate-y-[8deg] rotate-x-[5deg]">
              <div className="w-full h-full rounded-[46px] bg-white dark:bg-black/60 overflow-hidden relative flex flex-col border-[6px] border-[#FDFBF7]">
                <div className="absolute top-0 w-full h-7 flex justify-center z-50">
                  <div className="w-24 h-6 bg-[#1C1A19] rounded-b-3xl" />
                </div>
                
                <div className="flex-1 pt-14 p-6 flex flex-col relative z-10">
                  
                  <h3 className="text-lg font-medium text-[#1C1A19] dark:text-[#FAFAFA] mb-1">{t.solution.dashboard.title}</h3>
                  <p className="text-[11px] text-[#166534] dark:text-emerald-400 tracking-widest uppercase mb-8 font-bold">{t.solution.dashboard.subtitle}</p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-[#FDFBF7] dark:bg-white/5 rounded-2xl p-4 border border-[#E5E0D8] dark:border-white/10 shadow-sm">
                      <div className="text-xl font-bold text-[#1C1A19] dark:text-[#FAFAFA] mb-1">12.4K</div>
                      <div className="text-[9px] text-[#8C857E] dark:text-zinc-500 uppercase tracking-widest">{t.solution.dashboard.impressions}</div>
                    </div>
                    <div className="bg-[#FDFBF7] dark:bg-white/5 rounded-2xl p-4 border border-[#E5E0D8] dark:border-white/10 shadow-sm">
                      <div className="text-xl font-bold text-[#1C1A19] dark:text-[#FAFAFA] mb-1">8</div>
                      <div className="text-[9px] text-[#8C857E] dark:text-zinc-500 uppercase tracking-widest">{t.solution.dashboard.activeTaxis}</div>
                    </div>
                    <div className="bg-[#FDFBF7] dark:bg-white/5 rounded-2xl p-4 border border-[#E5E0D8] dark:border-white/10 shadow-sm">
                      <div className="text-xl font-bold text-[#1C1A19] dark:text-[#FAFAFA] mb-1">₾142</div>
                      <div className="text-[9px] text-[#8C857E] dark:text-zinc-500 uppercase tracking-widest">{t.solution.dashboard.spent}</div>
                    </div>
                    <div className="bg-[#166534]/10 dark:bg-emerald-500/10 rounded-2xl p-4 border border-[#166534]/20 dark:border-emerald-500/20">
                      <div className="text-xl font-bold text-[#166534] dark:text-emerald-400 mb-1">4.2x</div>
                      <div className="text-[9px] text-[#166534] dark:text-emerald-400 uppercase tracking-widest">{t.solution.dashboard.vsBillboard}</div>
                    </div>
                  </div>

                  <div className="flex-1 bg-[#FDFBF7] dark:bg-white/5 rounded-2xl border border-[#E5E0D8] dark:border-white/10 relative overflow-hidden flex flex-col items-center justify-center shadow-inner">
                    <span className="absolute top-4 left-4 text-[#8C857E] dark:text-zinc-500 text-[9px] tracking-widest font-bold uppercase">LIVE MAP</span>
                    <div className="w-2.5 h-2.5 bg-[#166534] dark:bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(22,101,52,0.5)] relative">
                      <div className="absolute inset-0 bg-[#166534] dark:bg-emerald-500 rounded-full animate-ping opacity-60" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="order-1 lg:order-2">
            <motion.div variants={fadeIn} className="inline-flex items-center gap-3 mb-6 text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#166534] dark:text-emerald-400">
              <span className="h-px w-6 bg-[#166534]/40 dark:bg-emerald-400/40" />
              <span>02 — The Platform</span>
            </motion.div>
            <motion.h2 variants={fadeIn} className="text-4xl md:text-[52px] font-medium tracking-[-0.03em] mb-6 leading-[1.08] text-[#1C1A19] dark:text-[#FAFAFA]">
              {t.solution.titlePrefix} <span className="font-serif italic font-light text-[#166534] dark:text-emerald-400 block pb-1">{t.solution.titleGradient}</span> <span className="text-[#8C857E] dark:text-zinc-500">{t.solution.titleSuffix}</span>
            </motion.h2>
            <motion.p variants={fadeIn} className="text-[17px] text-[#6B6561] dark:text-zinc-400 font-light mb-16 leading-[1.65] max-w-lg">
              {t.solution.description}
            </motion.p>

            <div className="flex flex-col gap-10">
              {t.solution.features.map((feature, i) => (
                <motion.div key={i} variants={fadeIn} className="flex gap-6 items-start group">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-black/60 border border-[#E5E0D8] dark:border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_4px_10px_rgba(28,26,25,0.03)] flex items-center justify-center text-[#8C857E] dark:text-zinc-500 shrink-0 group-hover:text-[#166534] dark:group-hover:text-emerald-400 group-hover:border-[#166534]/30 dark:group-hover:border-emerald-500/30 group-hover:bg-[#166534]/[0.03] dark:group-hover:bg-emerald-500/[0.06] transition-all duration-500 group-hover:-translate-y-1">
                    {[
                      <svg key="0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
                      <svg key="1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
                      <svg key="2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
                      <svg key="3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                    ][i]}
                  </div>
                  <div>
                    <h4 className="text-[19px] font-medium tracking-[-0.015em] mb-2 text-[#1C1A19] dark:text-[#FAFAFA] group-hover:text-[#166534] dark:group-hover:text-emerald-400 transition-colors duration-500">{feature.title}</h4>
                    <p className="text-[#6B6561] dark:text-zinc-400 text-[15px] font-light leading-[1.65]">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Two Sided Section Toggle */}
      <section id="advertisers" className="py-32 px-6 lg:px-12 max-w-[1200px] mx-auto z-10 relative">
        <div className="text-center mb-20 max-w-2xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-3 mb-6 text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#8C857E] dark:text-zinc-500">
            <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
            <span>03 — Two Sides, One Network</span>
            <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
          </div>
          <h2 className="text-4xl md:text-[52px] font-medium tracking-[-0.03em] mb-6 leading-[1.08] text-[#1C1A19] dark:text-[#FAFAFA]">
            {t.twoSided.titlePrefix} <span className="font-serif italic font-light text-[#166534] dark:text-emerald-400">{t.twoSided.titleGradient}</span>
          </h2>
          <p className="text-[#6B6561] dark:text-zinc-400 font-light text-[17px] leading-[1.6]">{t.twoSided.subtitle}</p>
        </div>

        <div className="flex justify-center mb-16 relative z-10">
          <div className="inline-flex bg-white dark:bg-black/60 p-1 rounded-full border border-[#E5E0D8] dark:border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_4px_14px_rgba(28,26,25,0.04)]">
            <button
              onClick={() => setActiveTab('advertisers')}
              className={`px-9 py-3 rounded-full text-[12px] font-semibold tracking-[0.14em] uppercase transition-all duration-500
                ${activeTab === 'advertisers' ? 'bg-[#1C1A19] dark:bg-[#FAFAFA] text-white dark:text-[#0A0A0A] shadow-[0_6px_18px_rgba(28,26,25,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-[#8C857E] dark:text-zinc-500 hover:text-[#1C1A19] dark:hover:text-white'}`}
            >
              {t.twoSided.advertisersTab}
            </button>
            <button
              onClick={() => setActiveTab('drivers')}
              className={`px-9 py-3 rounded-full text-[12px] font-semibold tracking-[0.14em] uppercase transition-all duration-500
                ${activeTab === 'drivers' ? 'bg-[#1C1A19] dark:bg-[#FAFAFA] text-white dark:text-[#0A0A0A] shadow-[0_6px_18px_rgba(28,26,25,0.2),inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-[#8C857E] dark:text-zinc-500 hover:text-[#1C1A19] dark:hover:text-white'}`}
            >
              {t.twoSided.driversTab}
            </button>
          </div>
        </div>

        <div className="relative min-h-[400px] z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
              transition={{ duration: 0.6 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {(activeTab === 'advertisers' ? t.twoSided.advertisersBenefits : t.twoSided.driversBenefits).map((benefit, i) => (
                <div key={i} className="bg-white dark:bg-black/60 p-10 rounded-3xl border border-[#E5E0D8] dark:border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_6px_20px_rgba(28,26,25,0.02)] hover:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_20px_40px_rgba(22,101,52,0.08)] hover:border-[#166534]/25 dark:hover:border-emerald-500/25 hover:-translate-y-1.5 transition-all duration-500 group relative overflow-hidden">
                  {/* Tiny serial number */}
                  <div className="absolute top-6 right-6 text-[10px] font-mono tracking-widest text-[#C8C2B8] dark:text-white/15">{String(i + 1).padStart(2, '0')}</div>
                  <div className="text-[28px] mb-7 opacity-80 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-500 origin-left grayscale-[30%] group-hover:grayscale-0">
                    {activeTab === 'advertisers' ? ['🎯', '💰', '📊', '⚡', '🚀', '🤝'][i] : ['💵', '🆓', '📱', '🔄', '🛡️', '⭐'][i]}
                  </div>
                  <h3 className="text-[18px] font-medium tracking-[-0.015em] mb-3 text-[#1C1A19] dark:text-[#FAFAFA] group-hover:text-[#166534] dark:group-hover:text-emerald-400 transition-colors duration-500">{benefit.title}</h3>
                  <p className="text-[#6B6561] dark:text-zinc-400 text-[15px] font-light leading-[1.65]">{benefit.desc}</p>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Cream & Charcoal Pricing Cards */}
      <section id="pricing" className="py-32 px-6 lg:px-12 relative border-y border-[#E5E0D8] dark:border-white/10 bg-[#F8F6F1] dark:bg-[#0A0A0A] overflow-hidden">
        {/* Subtle radial wash */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#166534] dark:bg-emerald-500 opacity-[0.035] dark:opacity-[0.05] blur-[120px] pointer-events-none rounded-full" />
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="text-center mb-20 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-3 mb-6 text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#8C857E] dark:text-zinc-500">
              <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
              <span>04 — Investment</span>
              <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
            </div>
            <h2 className="text-4xl md:text-[52px] font-medium tracking-[-0.03em] mb-6 leading-[1.08] text-[#1C1A19] dark:text-[#FAFAFA]">
              {t.pricing.titlePrefix} <span className="font-serif italic font-light text-[#166534] dark:text-emerald-400">{t.pricing.titleGradient}</span>
            </h2>
            <p className="text-[17px] text-[#6B6561] dark:text-zinc-400 font-light leading-[1.6]">{t.pricing.subtitle}</p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="relative bg-white dark:bg-black/60 border border-[#E5E0D8] dark:border-white/10 rounded-[2rem] p-10 md:p-16 text-center shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_20px_60px_rgba(28,26,25,0.04)] overflow-hidden">
              {/* Decorative corner marks */}
              <span className="absolute top-5 left-5 w-5 h-5 border-l border-t border-[#166534]/20 dark:border-emerald-500/25 rounded-tl-lg" />
              <span className="absolute top-5 right-5 w-5 h-5 border-r border-t border-[#166534]/20 dark:border-emerald-500/25 rounded-tr-lg" />
              <span className="absolute bottom-5 left-5 w-5 h-5 border-l border-b border-[#166534]/20 dark:border-emerald-500/25 rounded-bl-lg" />
              <span className="absolute bottom-5 right-5 w-5 h-5 border-r border-b border-[#166534]/20 dark:border-emerald-500/25 rounded-br-lg" />

              {/* Top ornament */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#E5E0D8] dark:to-white/20" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#166534]/60 dark:text-emerald-400/60"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg>
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#E5E0D8] dark:to-white/20" />
              </div>

              <h3 className="font-serif text-3xl md:text-[44px] font-light italic tracking-[-0.02em] text-[#1C1A19] dark:text-[#FAFAFA] mb-6 leading-[1.1]">
                {t.pricing.contactOnlyTitle}
              </h3>
              <p className="text-[#6B6561] dark:text-zinc-400 text-[16px] font-light mb-12 leading-[1.7] max-w-2xl mx-auto">
                {t.pricing.contactOnlyDesc}
              </p>
              <a
                href="mailto:gzadvertisment@gmail.com"
                className="inline-flex items-center gap-3 justify-center px-11 py-[15px] rounded-full bg-[#1C1A19] dark:bg-emerald-500 text-white font-semibold tracking-[0.04em] text-[13px] hover:bg-[#166534] dark:hover:bg-emerald-400 transition-all duration-500 shadow-[0_10px_30px_rgba(28,26,25,0.2),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_18px_44px_rgba(22,101,52,0.35)] hover:-translate-y-0.5"
              >
                <span>{t.pricing.contactOnlyBtn}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
              <p className="mt-7 text-[12px] tracking-[0.2em] uppercase text-[#8C857E] dark:text-zinc-500 font-medium">
                gzadvertisment@gmail.com
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Elegant FAQ */}
      <section id="faq" className="py-32 px-6 lg:px-12 max-w-[900px] mx-auto z-10 relative">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-3 mb-6 text-[10.5px] font-bold tracking-[0.28em] uppercase text-[#8C857E] dark:text-zinc-500">
            <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
            <span>05 — Questions</span>
            <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
          </div>
          <h2 className="text-4xl md:text-[52px] font-medium tracking-[-0.03em] mb-6 leading-[1.08] text-[#1C1A19] dark:text-[#FAFAFA]">
            {t.faq.titlePrefix} <span className="font-serif italic font-light text-[#8C857E] dark:text-zinc-500">{t.faq.titleGradient}</span>
          </h2>
        </div>
        <div className="space-y-3">
          {t.faq.items.map((faq, index) => (
            <div key={index} className={`bg-white dark:bg-black/60 border rounded-2xl overflow-hidden transition-all duration-500 ${activeFaq === index ? 'border-[#166534]/25 dark:border-emerald-500/30 shadow-[0_10px_40px_rgba(22,101,52,0.06)]' : 'border-[#E5E0D8] dark:border-white/10 hover:border-[#166534]/20 dark:hover:border-emerald-500/20'}`}>
              <button
                className="w-full text-left px-8 py-6 flex justify-between items-center focus:outline-none group gap-6"
                onClick={() => toggleFaq(index)}
              >
                <h3 className={`text-[17px] font-medium tracking-[-0.01em] transition-colors duration-300 ${activeFaq === index ? 'text-[#166534] dark:text-emerald-400' : 'text-[#1C1A19] dark:text-[#FAFAFA] group-hover:text-[#166534] dark:group-hover:text-emerald-400'}`}>{faq.question}</h3>
                <span className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-500 ${activeFaq === index ? 'border-[#166534] dark:border-emerald-400 bg-[#166534] dark:bg-emerald-500 text-white rotate-180' : 'border-[#E5E0D8] dark:border-white/15 text-[#8C857E] dark:text-zinc-500'}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-500 ${activeFaq === index ? 'rotate-180' : ''}`}>
                    {activeFaq === index ? <path d="M5 12h14" /> : <><path d="M5 12h14" /><path d="M12 5v14" /></>}
                  </svg>
                </span>
              </button>
              <AnimatePresence>
                {activeFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="px-8 pb-8 text-[#6B6561] dark:text-zinc-400 font-light leading-[1.7] text-[15px]">
                      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#E5E0D8] dark:via-white/10 to-transparent mb-6" />
                      <p>{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>

      {/* Striking CTA (Espresso Base) */}
      <section id="get-started" className="pt-32 pb-48 px-6 relative overflow-hidden flex items-center justify-center text-center">
        <div className="max-w-4xl mx-auto relative z-10 bg-gradient-to-br from-[#1C1A19] via-[#1C1A19] to-[#0F0E0D] p-12 lg:p-24 rounded-[3rem] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_40px_100px_rgba(28,26,25,0.2)] overflow-hidden border border-white/[0.06]">
          {/* Top hairline ornament */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#166534]/60 to-transparent" />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-60">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#166534]/50" />
            <span className="w-1 h-1 rounded-full bg-[#166534]" />
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#166534]/50" />
          </div>

          {/* Soft green wash */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#166534] dark:bg-emerald-500 opacity-[0.06] blur-[110px] pointer-events-none rounded-full transform-gpu will-change-transform" />

          {/* Subtle cream noise layer */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '3px 3px' }} />

          <h2 className="text-5xl md:text-[76px] font-medium tracking-[-0.035em] mb-8 leading-[1.02] text-white relative z-10">
            {t.cta.titlePrefix} <br className="hidden md:block"/><span className="font-serif italic font-light text-[#166534] dark:text-emerald-400">{t.cta.titleGradient}</span>
          </h2>
          <p className="text-[19px] font-light text-[#E5E0D8]/75 mb-14 leading-[1.65] max-w-xl mx-auto relative z-10">
            {t.cta.description}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
            <a href="mailto:gzadvertisment@gmail.com" className="group px-10 py-[18px] bg-[#166534] dark:bg-emerald-500 text-white font-semibold rounded-full hover:bg-[#14532D] dark:hover:bg-emerald-400 transition-all duration-500 shadow-[0_10px_30px_rgba(22,101,52,0.35),inset_0_1px_0_rgba(255,255,255,0.12)] hover:shadow-[0_18px_44px_rgba(22,101,52,0.55)] hover:-translate-y-0.5 inline-flex items-center justify-center gap-2.5 text-[13px] tracking-[0.04em]">
              <span>{t.cta.contact}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 transition-transform duration-500"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <a href="tel:+995591410914" className="px-10 py-[18px] bg-transparent text-white font-medium rounded-full border border-white/15 hover:border-[#166534] dark:hover:border-emerald-500/60 hover:bg-white/[0.03] transition-all duration-500 inline-flex items-center justify-center gap-2.5 text-[13px] tracking-[0.04em]">
              {t.cta.call}
            </a>
          </div>
        </div>
      </section>

      {/* CREAMY FOOTER */}
      <footer id="contact" className="relative py-24 px-6 lg:px-12 bg-[#F8F6F1] dark:bg-[#0A0A0A] border-t border-[#E5E0D8] dark:border-white/10">
        {/* Top hairline ornament */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 bg-[#F8F6F1] dark:bg-[#0A0A0A] px-4">
          <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
          <span className="w-1 h-1 rounded-full bg-[#166534]/50 dark:bg-emerald-500/60" />
          <span className="h-px w-8 bg-[#E5E0D8] dark:bg-white/15" />
        </div>

        <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-16 lg:gap-12 mb-20 justify-items-start lg:justify-items-center">

          {/* Brand Column */}
          <div className="lg:col-span-2 w-full flex flex-col items-start lg:justify-self-start">
            <a href="#" className="flex items-center gap-3 mb-6 group inline-flex">
              <span className="text-3xl font-bold tracking-[-0.04em] text-[#1C1A19] dark:text-[#FAFAFA]">G<span className="font-serif italic font-light text-[#166534] dark:text-emerald-400">z</span>ad</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#166534] dark:bg-emerald-500 shadow-[0_0_10px_rgba(22,101,52,0.45)]" />
            </a>
            <p className="text-[#6B6561] dark:text-zinc-400 font-light text-[14px] leading-[1.7] max-w-sm mb-10 text-left">
              {t.footer.tagline}
            </p>
            <div className="flex gap-4 text-[#8C857E] dark:text-zinc-500">
              <a href="#" className="w-10 h-10 rounded-full border border-[#E5E0D8] dark:border-white/10 flex items-center justify-center hover:text-[#166534] dark:hover:text-emerald-400 hover:border-[#166534]/30 dark:hover:border-emerald-500/30 hover:-translate-y-0.5 transition-all duration-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#E5E0D8] dark:border-white/10 flex items-center justify-center hover:text-[#166534] dark:hover:text-emerald-400 hover:border-[#166534]/30 dark:hover:border-emerald-500/30 hover:-translate-y-0.5 transition-all duration-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#E5E0D8] dark:border-white/10 flex items-center justify-center hover:text-[#166534] dark:hover:text-emerald-400 hover:border-[#166534]/30 dark:hover:border-emerald-500/30 hover:-translate-y-0.5 transition-all duration-500">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
              </a>
            </div>
          </div>

          {/* Navigation Links Columns */}
          <div className="w-full flex flex-col items-start lg:items-center">
            <div className="text-left w-full max-w-[150px]">
              <h4 className="text-[#1C1A19] dark:text-[#FAFAFA] font-bold tracking-[0.24em] mb-8 text-[10.5px] uppercase">{t.footer.platform}</h4>
              <ul className="space-y-4 text-[#6B6561] dark:text-zinc-400 text-[14px] font-light">
                <li><a href="#how-it-works" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.nav.howItWorks}</a></li>
                <li><a href="#advertisers" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.nav.advertisers}</a></li>
                <li><a href="#drivers" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.nav.drivers}</a></li>
                <li><a href="#pricing" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.nav.pricing}</a></li>
              </ul>
            </div>
          </div>

          <div className="w-full flex flex-col items-start lg:items-center">
            <div className="text-left w-full max-w-[150px]">
              <h4 className="text-[#1C1A19] dark:text-[#FAFAFA] font-bold tracking-[0.24em] mb-8 text-[10.5px] uppercase">{t.footer.company}</h4>
              <ul className="space-y-4 text-[#6B6561] dark:text-zinc-400 text-[14px] font-light">
                <li><a href="#" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.footer.about}</a></li>
                <li><a href="#faq" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.nav.faq}</a></li>
                <li><a href="#" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.footer.press}</a></li>
                <li><a href="#" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">{t.footer.careers}</a></li>
              </ul>
            </div>
          </div>

          {/* Contact Column */}
          <div className="w-full flex flex-col items-start lg:justify-self-end">
            <div className="text-left w-full">
              <h4 className="text-[#1C1A19] dark:text-[#FAFAFA] font-bold tracking-[0.24em] mb-8 text-[10.5px] uppercase">{t.footer.contact}</h4>
              <ul className="space-y-4 text-[#6B6561] dark:text-zinc-400 text-[14px] font-light">
                <li>
                  <a href="mailto:gzadvertisment@gmail.com" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block">
                    gzadvertisment@gmail.com
                  </a>
                </li>
                <li>
                  <a href="tel:+995591410914" className="hover:text-[#166534] dark:hover:text-emerald-400 transition-colors duration-300 inline-block pt-1 tabular-nums">
                    +995 591 410 914
                  </a>
                </li>
                <li className="pt-4 text-[#8C857E] dark:text-zinc-500 text-[13px]">
                  {lang === 'ge' ? 'თბილისი, საქართველო' : 'Tbilisi, Georgia'}
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="max-w-[1400px] mx-auto pt-8 border-t border-[#E5E0D8] dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[#8C857E] dark:text-zinc-500 text-[12.5px] font-light tracking-[0.04em] tabular-nums">{t.footer.rights} &copy; {new Date().getFullYear()}</p>
          <div className="flex gap-8 text-[12px] text-[#6B6561] dark:text-zinc-400 font-medium tracking-[0.02em]">
            <a href="#" className="hover:text-[#1C1A19] dark:hover:text-white transition-colors duration-300">Privacy Policy</a>
            <a href="#" className="hover:text-[#1C1A19] dark:hover:text-white transition-colors duration-300">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
