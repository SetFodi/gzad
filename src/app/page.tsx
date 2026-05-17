'use client';

import { useState, useEffect } from 'react';
import { translations } from './translations';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<'advertisers' | 'drivers'>('advertisers');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [adIndex, setAdIndex] = useState(0);
  const [lang, setLang] = useState<'en' | 'ge'>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('gzad-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('gzad-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('lang-ge', lang === 'ge');
  }, [lang]);

  const t = translations[lang];

  useEffect(() => {
    const id = setInterval(() => setAdIndex((i) => (i + 1) % t.hero.marqueeAds.length), 5200);
    return () => clearInterval(id);
  }, [t.hero.marqueeAds.length]);

  const fadeIn = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] as const } },
  };
  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.14 } },
  };

  const SunIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
  const MoonIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  const navItems = [
    { href: '#how-it-works', label: t.nav.howItWorks },
    { href: '#advertisers', label: t.nav.advertisers },
    { href: '#drivers', label: t.nav.drivers },
    { href: '#faq', label: t.nav.faq },
  ];

  return (
    <div className="min-h-screen bg-[#F1E2D1] dark:bg-[#160606] text-[#541A1A] dark:text-[#F1E2D1] overflow-x-hidden font-sans font-light transition-colors duration-500">

      {/* ─────────────────────── NAVBAR ─────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#F1E2D1]/85 dark:bg-[#160606]/85 backdrop-blur-xl border-b border-[#DCC3AA]/60 dark:border-[#D6A569]/15 py-3.5'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-[1320px] mx-auto px-6 lg:px-10 grid grid-cols-[auto_1fr_auto] items-center gap-4 lg:gap-6">

          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5 group shrink-0">
            <span className="font-serif italic text-[26px] tracking-tight text-[#541A1A] dark:text-[#F1E2D1] leading-none">Gzad</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#810B38] dark:bg-[#D6A569] transition-transform duration-300 group-hover:scale-150" />
          </a>

          {/* Center Links — in document flow so layout reflows in GE */}
          <ul
            className={`${
              lang === 'ge' ? 'hidden xl:flex gap-6' : 'hidden lg:flex gap-7 xl:gap-9'
            } justify-center items-center text-[11.5px] font-semibold tracking-[0.16em] xl:tracking-[0.18em] uppercase text-[#541A1A]/75 dark:text-[#DCC3AA]`}
          >
            {navItems.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="nav-link whitespace-nowrap hover:text-[#810B38] dark:hover:text-[#D6A569]">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right cluster */}
          <div className={`flex items-center ${lang === 'ge' ? 'gap-3.5 lg:gap-4' : 'gap-5'} shrink-0 justify-self-end`}>

            {/* Language */}
            <div className="hidden sm:flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.22em]" lang="en">
              <button
                onClick={() => setLang('en')}
                className={`pb-0.5 border-b transition-colors duration-200 ${
                  lang === 'en'
                    ? 'border-[#810B38] text-[#810B38] dark:border-[#D6A569] dark:text-[#D6A569]'
                    : 'border-transparent text-[#541A1A]/55 dark:text-[#DCC3AA]/70 hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'
                }`}
              >EN</button>
              <span className="text-[#DCC3AA] dark:text-[#D6A569]/40 select-none">·</span>
              <button
                onClick={() => setLang('ge')}
                className={`pb-0.5 border-b transition-colors duration-200 ${
                  lang === 'ge'
                    ? 'border-[#810B38] text-[#810B38] dark:border-[#D6A569] dark:text-[#D6A569]'
                    : 'border-transparent text-[#541A1A]/55 dark:text-[#DCC3AA]/70 hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'
                }`}
              >GE</button>
            </div>

            {/* Theme */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-9 h-9 border border-[#541A1A]/25 dark:border-[#D6A569]/30 flex items-center justify-center text-[#810B38] dark:text-[#D6A569] hover:bg-[#810B38] hover:text-[#F1E2D1] hover:border-[#810B38] dark:hover:bg-[#D6A569] dark:hover:text-[#160606] dark:hover:border-[#D6A569] transition-colors duration-300"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? MoonIcon : SunIcon}
            </button>

            {/* Login */}
            <a
              href="/portal/login"
              className="hidden md:inline-flex nav-link items-center text-[#541A1A]/75 dark:text-[#DCC3AA] text-[11.5px] font-semibold tracking-[0.18em] uppercase hover:text-[#810B38] dark:hover:text-[#D6A569] transition-colors duration-300"
            >
              {lang === 'en' ? 'Log In' : 'შესვლა'}
            </a>

            {/* Signup */}
            <a
              href="/portal/fleet-signup"
              className="hidden md:inline-flex items-center justify-center px-5 py-2.5 bg-[#810B38] dark:bg-[#D6A569] text-[#F1E2D1] dark:text-[#160606] text-[10.5px] font-bold tracking-[0.24em] uppercase hover:bg-[#541A1A] dark:hover:bg-[#F1E2D1] transition-colors duration-300"
            >
              {lang === 'en' ? 'Sign Up' : 'რეგისტრაცია'}
            </a>
          </div>
        </div>
      </nav>

      {/* ─────────────────────── HERO ─────────────────────── */}
      <section className="relative paper-grain pt-24 lg:pt-28 pb-12 lg:pb-16 px-6 lg:px-12">
        <div className="max-w-[1240px] mx-auto relative z-10">

          {/* Centered headline + CTAs */}
          <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center max-w-5xl mx-auto">
            <motion.h1
              variants={fadeIn}
              className="text-[40px] sm:text-[52px] lg:text-[64px] xl:text-[72px] font-normal leading-[0.98] tracking-[-0.025em] text-[#541A1A] dark:text-[#F1E2D1] text-balance mb-6"
            >
              {t.hero.titlePrefix}{' '}
              <span className="font-serif italic font-light text-[#810B38] dark:text-[#D6A569]">
                {t.hero.titleGradient}
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-[#810B38] dark:bg-[#D6A569] align-baseline ml-1.5 -translate-y-2" />
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="text-[15.5px] md:text-[17px] text-[#541A1A]/72 dark:text-[#DCC3AA]/90 font-light max-w-2xl mx-auto mb-7 leading-[1.6]"
            >
              <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">— </span>
              {t.hero.description}
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-3.5 items-center justify-center">
              <a
                href="mailto:gzadvertisment@gmail.com"
                className="group inline-flex items-center justify-center gap-3 px-8 py-[13px] bg-[#810B38] dark:bg-[#D6A569] text-[#F1E2D1] dark:text-[#160606] font-bold tracking-[0.22em] uppercase text-[11.5px] hover:bg-[#541A1A] dark:hover:bg-[#F1E2D1] transition-colors duration-300"
              >
                {t.hero.startAdvertising}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="#drivers"
                className="inline-flex items-center justify-center px-8 py-[13px] border border-[#541A1A]/40 dark:border-[#D6A569]/40 text-[#541A1A] dark:text-[#F1E2D1] font-bold tracking-[0.22em] uppercase text-[11.5px] hover:bg-[#541A1A] hover:text-[#F1E2D1] hover:border-[#541A1A] dark:hover:bg-[#D6A569] dark:hover:text-[#160606] dark:hover:border-[#D6A569] transition-colors duration-300"
              >
                {t.hero.becomeDriver}
              </a>
            </motion.div>
          </motion.div>

          {/* ─── Realistic Taxi-Top LED Marquee — pure hardware ─── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[720px] mx-auto mt-24 lg:mt-28 relative"
          >
            <div className="marquee-frame">
              {/* Center mounting clamp (U-bracket) */}
              <div className="marquee-clamp" />

              {/* Frame screws — 4 corners */}
              <div className="absolute top-2 left-3 led-screw" />
              <div className="absolute top-2 right-3 led-screw" />
              <div className="absolute bottom-2 left-3 led-screw" />
              <div className="absolute bottom-2 right-3 led-screw" />

              {/* Power indicator LED */}
              <span className="led-power" />

              {/* Screen */}
              <div className="marquee-screen">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={adIndex}
                    initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 z-[6]"
                  >
                    <span className="led-text-sub text-[9px] md:text-[10.5px] tracking-[0.42em] uppercase font-semibold">
                      {t.hero.marqueeAds[adIndex].eyebrow}
                    </span>
                    <span className="led-text-bright mt-1 font-serif italic text-[34px] md:text-[54px] lg:text-[64px] leading-none">
                      {t.hero.marqueeAds[adIndex].brand}
                    </span>
                    {t.hero.marqueeAds[adIndex].tagline && (
                      <span className="led-text mt-2 text-[10.5px] md:text-[13px] tracking-[0.14em] font-light">
                        {t.hero.marqueeAds[adIndex].tagline}
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Module seams (real P4 panels are tiled 16×16 modules) + acrylic glass overlay */}
                <div className="marquee-modules" />
                <div className="marquee-glass" />
              </div>
            </div>

            {/* Cast shadow */}
            <div className="led-cast-shadow" />
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────── ON THE RECORD — founders' note ─────────────────────── */}
      <section className="paper-grain py-24 lg:py-32 border-y border-[#DCC3AA] dark:border-[#D6A569]/12 bg-[#F1E2D1]/50 dark:bg-[#1F0808]/70 relative">
        <div className="max-w-[920px] mx-auto px-6 lg:px-12 text-center">

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={stagger}>
            <motion.span variants={fadeIn} className="eyebrow-rule mb-10 inline-flex">
              {lang === 'en' ? 'On the Record' : 'ჩვენგან'}
            </motion.span>

            <motion.blockquote
              variants={fadeIn}
              className="font-serif italic text-[#541A1A] dark:text-[#F1E2D1] leading-[1.12] tracking-[-0.018em] mb-14"
            >
              <span className="block text-[26px] md:text-[36px] lg:text-[44px] opacity-80">
                {lang === 'en' ? 'Billboards stand still.' : 'ბილბორდები ერთ ადგილას დგანან.'}
              </span>
              <span className="block text-[44px] md:text-[64px] lg:text-[84px] text-[#810B38] dark:text-[#D6A569] leading-[0.95] tracking-[-0.025em] py-1 lg:py-2">
                {lang === 'en' ? "We don’t." : 'ჩვენ — არა.'}
              </span>
              <span className="block text-[26px] md:text-[36px] lg:text-[44px] opacity-80">
                {lang === 'en' ? 'We put your advertising in motion.' : 'ჩვენ რეკლამას ვამოძრავებთ.'}
              </span>
            </motion.blockquote>

            {/* Honest status strip — replaces fake metrics */}
            <motion.div
              variants={fadeIn}
              className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[10.5px] tracking-[0.28em] uppercase font-semibold text-[#541A1A]/55 dark:text-[#DCC3AA]/65"
            >
              <span className="flex items-center gap-2">
                <span className="relative inline-block w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-[#810B38] dark:bg-[#D6A569]" />
                  <span className="absolute inset-0 rounded-full bg-[#810B38] dark:bg-[#D6A569] animate-ping opacity-50" />
                </span>
                {lang === 'en' ? 'Pilot Phase' : 'საპილოტე ფაზა'}
              </span>
              <span className="hidden sm:inline opacity-30">·</span>
              <span>{lang === 'en' ? 'Hardware Ready' : 'ტექნიკა მზადაა'}</span>
              <span className="hidden sm:inline opacity-30">·</span>
              <span>{lang === 'en' ? 'Accepting Early Partners' : 'პარტნიორებს ვიღებთ'}</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────── PROBLEM — editorial hairline list ─────────────────────── */}
      <section className="py-28 lg:py-36 px-6 lg:px-12 max-w-[1080px] mx-auto relative">
        <motion.div
          className="mb-16 lg:mb-20 text-center max-w-3xl mx-auto"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeIn}
        >
          <span className="eyebrow-rule mb-7">{lang === 'en' ? 'The Status Quo' : 'არსებული მდგომარეობა'}</span>
          <h2 className="text-4xl md:text-[52px] font-normal tracking-[-0.022em] mb-6 leading-[1.05] text-[#541A1A] dark:text-[#F1E2D1] text-balance">
            {t.problem.titlePrefix}{' '}
            <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">{t.problem.titleGradient}</span>
          </h2>
          <p className="text-[17px] text-[#541A1A]/72 dark:text-[#DCC3AA]/90 font-light max-w-xl mx-auto leading-relaxed">
            {t.problem.subtitle}
          </p>
        </motion.div>

        <ul className="border-y border-[#DCC3AA] dark:border-[#D6A569]/15 divide-y divide-[#DCC3AA] dark:divide-[#D6A569]/15">
          {t.problem.cards.map((card, i) => {
            const icons = [
              <svg key="0" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
              <svg key="1" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
              <svg key="2" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
              <svg key="3" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
            ];
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-[auto_1fr_auto] gap-6 lg:gap-12 items-start py-9 lg:py-11 group"
              >
                {/* Roman numeral */}
                <span className="font-serif italic text-[40px] lg:text-[52px] text-[#810B38]/55 dark:text-[#D6A569]/60 leading-none w-12 lg:w-16 pt-1">
                  {['I', 'II', 'III', 'IV'][i]}
                </span>

                {/* Title + body */}
                <div className="min-w-0">
                  <h3 className="text-[22px] lg:text-[28px] font-normal tracking-[-0.015em] leading-[1.18] mb-3 text-[#541A1A] dark:text-[#F1E2D1] group-hover:text-[#810B38] dark:group-hover:text-[#D6A569] transition-colors duration-500">
                    {card.title}
                  </h3>
                  <p className="text-[15px] lg:text-[16px] text-[#541A1A]/72 dark:text-[#DCC3AA]/85 font-light leading-[1.7] max-w-2xl">
                    {card.desc}
                  </p>
                </div>

                {/* Icon — small, in the gutter */}
                <span className="text-[#810B38]/45 dark:text-[#D6A569]/55 pt-1.5 hidden md:block opacity-70 group-hover:opacity-100 transition-opacity duration-500">
                  {icons[i]}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </section>

      {/* ─────────────────────── SOLUTION / HOW IT WORKS ─────────────────────── */}
      <section id="how-it-works" className="py-24 lg:py-32 px-6 lg:px-12 max-w-[1200px] mx-auto relative">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-16 lg:gap-24 items-center">

          {/* iPhone 16 Pro mockup — titanium frame + Dynamic Island */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="order-2 lg:order-1 relative flex justify-center lg:justify-start"
          >
            <motion.div variants={fadeIn} className="relative w-full max-w-[290px] aspect-[9/19.5]">

              {/* Side buttons — titanium edges */}
              <div className="absolute -left-[3px] top-[16%] w-[3px] h-[3.5%] rounded-l-[1px] z-0" style={{ background: 'linear-gradient(-90deg, #1c1c1e 0%, #6b6b70 50%, #1c1c1e 100%)' }} />
              <div className="absolute -left-[3px] top-[24%] w-[3px] h-[8%] rounded-l-[1px] z-0" style={{ background: 'linear-gradient(-90deg, #1c1c1e 0%, #6b6b70 50%, #1c1c1e 100%)' }} />
              <div className="absolute -left-[3px] top-[34%] w-[3px] h-[8%] rounded-l-[1px] z-0" style={{ background: 'linear-gradient(-90deg, #1c1c1e 0%, #6b6b70 50%, #1c1c1e 100%)' }} />
              <div className="absolute -right-[3px] top-[22%] w-[3px] h-[11%] rounded-r-[1px] z-0" style={{ background: 'linear-gradient(90deg, #1c1c1e 0%, #6b6b70 50%, #1c1c1e 100%)' }} />

              {/* Titanium side rail */}
              <div
                className="absolute inset-0 rounded-[46px] p-[2.5px] z-10"
                style={{
                  background:
                    'linear-gradient(150deg, #8a8a8e 0%, #3a3a3c 18%, #1c1c1e 38%, #2a2a2c 55%, #1c1c1e 72%, #4a4a4c 92%, #1c1c1e 100%)',
                  boxShadow:
                    '0 60px 110px -32px rgba(0,0,0,0.45), 0 18px 36px -14px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.06)',
                }}
              >
                {/* Inner black bezel */}
                <div className="w-full h-full rounded-[44px] bg-black p-[5px]">

                  {/* Screen */}
                  <div className="w-full h-full rounded-[40px] bg-[#F1E2D1] dark:bg-[#1F0808] paper-grain overflow-hidden relative">

                    {/* Dynamic Island */}
                    <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-50 w-[92px] h-[26px] bg-black rounded-full flex items-center justify-end px-2.5">
                      <span className="w-[6px] h-[6px] rounded-full bg-[#1a1a1c] mr-[1px]" style={{ boxShadow: 'inset 0 0 0 0.5px #3a3a3c' }} />
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: 'radial-gradient(circle at 35% 35%, #4a6e8e 0%, #1a2a3a 80%)' }} />
                    </div>

                    {/* iOS Status Bar */}
                    <div className="absolute top-[14px] left-0 right-0 z-40 flex items-center justify-between px-[22px] text-[10.5px] font-semibold text-[#541A1A] dark:text-[#F1E2D1] tracking-tight tabular-nums">
                      <span>9:41</span>
                      <span className="flex items-center gap-[5px]">
                        {/* Signal bars */}
                        <svg width="15" height="9" viewBox="0 0 15 9" fill="currentColor" aria-hidden>
                          <rect x="0" y="6" width="2.5" height="3" rx="0.5" />
                          <rect x="3.5" y="4" width="2.5" height="5" rx="0.5" />
                          <rect x="7" y="2" width="2.5" height="7" rx="0.5" />
                          <rect x="10.5" y="0" width="2.5" height="9" rx="0.5" />
                        </svg>
                        {/* WiFi */}
                        <svg width="12" height="9" viewBox="0 0 14 10" fill="currentColor" aria-hidden>
                          <path d="M7 1.5C4.5 1.5 2.5 2.4 1 3.7l1 1c1.2-1 3-1.7 5-1.7s3.8.7 5 1.7l1-1c-1.5-1.3-3.5-2.2-6-2.2zM7 5c-1.3 0-2.5.5-3.3 1.3l1 1C5.3 6.7 6.1 6.4 7 6.4s1.7.3 2.3.9l1-1C9.5 5.5 8.3 5 7 5zm0 3.2c-.5 0-.9.2-1.2.6L7 10l1.2-1.2c-.3-.4-.7-.6-1.2-.6z" />
                        </svg>
                        {/* Battery */}
                        <span className="flex items-center">
                          <span className="relative w-[22px] h-[10px] border border-current rounded-[3px] flex items-center px-[1.5px] opacity-95">
                            <span className="block w-[15px] h-[5px] bg-current rounded-[1px]" />
                          </span>
                          <span className="w-[1.5px] h-[4px] bg-current rounded-r-[1px] ml-[0.5px] opacity-95" />
                        </span>
                      </span>
                    </div>

                    {/* App nav bar */}
                    <div className="absolute top-[44px] left-0 right-0 z-30 flex items-center justify-between px-4">
                      <button aria-label="Back" className="text-[#810B38] dark:text-[#D6A569] flex items-center gap-0.5 text-[12px] font-medium">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      </button>
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-[#541A1A] dark:text-[#F1E2D1]">Gzad</span>
                      <button aria-label="Menu" className="text-[#810B38] dark:text-[#D6A569]">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                      </button>
                    </div>

                    {/* App body */}
                    <div className="absolute inset-0 pt-[72px] px-3.5 pb-3.5 flex flex-col">

                      {/* Large title block */}
                      <div className="mb-3 px-1">
                        <span className="text-[8.5px] tracking-[0.3em] text-[#810B38] dark:text-[#D6A569] uppercase font-bold">
                          {t.solution.dashboard.subtitle}
                        </span>
                        <h3 className="font-serif italic text-[22px] text-[#541A1A] dark:text-[#F1E2D1] leading-[1.05] mt-0.5">
                          {t.solution.dashboard.title}
                        </h3>
                      </div>

                      {/* Stat cards 2×2 */}
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {[
                          { v: '12.4K', l: t.solution.dashboard.impressions, trend: '↑ 8%' },
                          { v: '8', l: t.solution.dashboard.activeTaxis, trend: 'live' },
                          { v: '₾142', l: t.solution.dashboard.spent, trend: 'today' },
                        ].map((s, i) => (
                          <div
                            key={i}
                            className="bg-[#F1E2D1] dark:bg-[#2A0A0A]/70 border border-[#DCC3AA] dark:border-[#D6A569]/18 rounded-[10px] p-2.5"
                            style={{ boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(84,26,26,0.04)' }}
                          >
                            <div className="flex items-baseline justify-between mb-0.5">
                              <div className="font-serif italic text-[19px] text-[#810B38] dark:text-[#D6A569] leading-none">{s.v}</div>
                              <span className="text-[7.5px] font-bold tracking-[0.12em] uppercase text-[#810B38]/55 dark:text-[#D6A569]/55">{s.trend}</span>
                            </div>
                            <div className="text-[7.5px] text-[#541A1A]/72 dark:text-[#DCC3AA]/80 uppercase tracking-[0.16em] font-bold leading-tight">
                              {s.l}
                            </div>
                          </div>
                        ))}
                        {/* Highlighted card */}
                        <div className="p-2.5 bg-[#810B38] dark:bg-[#D6A569] rounded-[10px] relative overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(129,11,56,0.25)' }}>
                          <div className="flex items-baseline justify-between mb-0.5">
                            <div className="font-serif italic text-[19px] text-[#F1E2D1] dark:text-[#160606] leading-none">4.2×</div>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#F1E2D1]/85 dark:text-[#160606]/85"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                          </div>
                          <div className="text-[7.5px] text-[#F1E2D1]/85 dark:text-[#160606]/80 uppercase tracking-[0.16em] font-bold leading-tight">
                            {t.solution.dashboard.vsBillboard}
                          </div>
                        </div>
                      </div>

                      {/* Live Map of Tbilisi */}
                      <div
                        className="flex-1 relative rounded-[10px] overflow-hidden border border-[#DCC3AA] dark:border-[#D6A569]/18 min-h-[130px]"
                        style={{
                          background:
                            'linear-gradient(135deg, #F1E2D1 0%, #E8D5BC 50%, #DCC3AA 100%)',
                        }}
                      >
                        {/* Map streets + river */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 130" preserveAspectRatio="none" aria-hidden>
                          {/* River Mtkvari */}
                          <path d="M -10 65 Q 40 35 90 55 T 220 75" stroke="rgba(110, 60, 80, 0.18)" strokeWidth="5" fill="none" strokeLinecap="round" />
                          {/* Avenues */}
                          <path d="M 0 25 L 200 30" stroke="rgba(84, 26, 26, 0.22)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                          <path d="M 0 100 L 200 95" stroke="rgba(84, 26, 26, 0.22)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                          {/* Cross streets */}
                          <path d="M 30 0 L 70 130" stroke="rgba(84, 26, 26, 0.14)" strokeWidth="0.8" fill="none" />
                          <path d="M 100 0 L 110 130" stroke="rgba(84, 26, 26, 0.14)" strokeWidth="0.8" fill="none" />
                          <path d="M 150 0 L 175 130" stroke="rgba(84, 26, 26, 0.14)" strokeWidth="0.8" fill="none" />
                          <path d="M 60 0 L 50 130" stroke="rgba(84, 26, 26, 0.1)" strokeWidth="0.6" fill="none" />
                          {/* Building blocks */}
                          <rect x="38" y="50" width="14" height="9" fill="rgba(84, 26, 26, 0.07)" rx="1" />
                          <rect x="55" y="78" width="10" height="11" fill="rgba(84, 26, 26, 0.07)" rx="1" />
                          <rect x="115" y="68" width="12" height="14" fill="rgba(84, 26, 26, 0.07)" rx="1" />
                          <rect x="150" y="42" width="16" height="10" fill="rgba(84, 26, 26, 0.07)" rx="1" />
                          <rect x="160" y="80" width="14" height="9" fill="rgba(84, 26, 26, 0.07)" rx="1" />
                          <rect x="80" y="20" width="9" height="6" fill="rgba(84, 26, 26, 0.07)" rx="1" />
                        </svg>

                        {/* Live label */}
                        <div className="absolute top-2 left-2.5 z-20 text-[8px] tracking-[0.28em] font-bold uppercase text-[#541A1A]/75 dark:text-[#3A0A0A] flex items-center gap-1.5">
                          <span className="relative inline-block w-1 h-1">
                            <span className="absolute inset-0 rounded-full bg-[#810B38]" />
                            <span className="absolute inset-0 rounded-full bg-[#810B38] animate-ping opacity-60" />
                          </span>
                          Live · Tbilisi
                        </div>
                        <span className="absolute top-2 right-2.5 z-20 text-[7.5px] font-bold tracking-tight text-[#541A1A]/55 dark:text-[#3A0A0A]/70 font-serif italic">N ↑</span>

                        {/* Taxi markers */}
                        {[
                          { top: '38%', left: '24%', label: 'TX-04' },
                          { top: '60%', left: '64%', label: null },
                          { top: '72%', left: '34%', label: null },
                          { top: '40%', left: '80%', label: null },
                        ].map((d, idx) => (
                          <div key={idx} className="absolute z-30" style={{ top: d.top, left: d.left, transform: 'translate(-50%, -50%)' }}>
                            <span
                              className="block w-[7px] h-[7px] rounded-full bg-[#810B38]"
                              style={{
                                boxShadow: '0 0 0 2px rgba(241,226,209,0.95), 0 2px 4px rgba(0,0,0,0.25)',
                                animation: `pulse 2.4s ${idx * 0.4}s ease-in-out infinite`,
                              }}
                            />
                            {d.label && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[7.5px] font-bold tracking-[0.18em] text-[#541A1A] bg-[#F1E2D1] px-1.5 py-[2px] rounded shadow-[0_2px_5px_rgba(0,0,0,0.15)] whitespace-nowrap border border-[#DCC3AA]/80">
                                {d.label}
                              </span>
                            )}
                          </div>
                        ))}

                        {/* Bottom scale bar */}
                        <div className="absolute bottom-1.5 left-2.5 z-20 flex items-center gap-1 text-[7px] font-bold text-[#541A1A]/55 dark:text-[#3A0A0A]/70">
                          <span className="w-6 h-[2px] bg-[#541A1A]/45" />
                          <span>500m</span>
                        </div>
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-[88px] h-[3.5px] rounded-full bg-[#541A1A]/55 dark:bg-[#F1E2D1]/45 z-50" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
            className="order-1 lg:order-2"
          >
            <motion.span variants={fadeIn} className="eyebrow-rule mb-7 inline-flex">
              {lang === 'en' ? 'Built for Operators' : 'ოპერატორებისთვის'}
            </motion.span>
            <motion.h2
              variants={fadeIn}
              className="text-4xl md:text-[52px] font-normal tracking-[-0.022em] mb-7 leading-[1.05] text-[#541A1A] dark:text-[#F1E2D1] text-balance"
            >
              {t.solution.titlePrefix}{' '}
              <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">{t.solution.titleGradient}</span>{' '}
              <span className="text-[#541A1A]/65 dark:text-[#DCC3AA]/85">{t.solution.titleSuffix}</span>
            </motion.h2>
            <motion.p
              variants={fadeIn}
              className="text-[17px] text-[#541A1A]/72 dark:text-[#DCC3AA]/90 font-light mb-12 leading-[1.65] max-w-lg"
            >
              <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">— </span>
              {t.solution.description}
            </motion.p>

            <div className="flex flex-col">
              {t.solution.features.map((feature, i) => {
                const icons = [
                  <svg key="0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>,
                  <svg key="1" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
                  <svg key="2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
                  <svg key="3" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
                ];
                return (
                  <motion.div
                    key={i}
                    variants={fadeIn}
                    className="flex gap-7 items-start group py-6 border-t border-[#DCC3AA] dark:border-[#D6A569]/15 first:border-t-0"
                  >
                    <div className="w-11 h-11 rounded-full border border-[#810B38] dark:border-[#D6A569]/55 flex items-center justify-center text-[#810B38] dark:text-[#D6A569] shrink-0 transition-all duration-300 group-hover:bg-[#810B38] group-hover:text-[#F1E2D1] dark:group-hover:bg-[#D6A569] dark:group-hover:text-[#160606]">
                      {icons[i]}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[19px] font-normal tracking-tight mb-2 text-[#541A1A] dark:text-[#F1E2D1]">
                        {feature.title}
                      </h4>
                      <p className="text-[#541A1A]/70 dark:text-[#DCC3AA]/85 text-[14.5px] font-light leading-[1.65]">
                        {feature.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────── TWO-SIDED ─────────────────────── */}
      <section id="advertisers" className="py-28 lg:py-32 px-6 lg:px-12 max-w-[1200px] mx-auto relative">
        <div className="text-center mb-14 max-w-2xl mx-auto flex flex-col items-center">
          <span className="eyebrow-rule mb-7">{lang === 'en' ? 'Both Sides Win' : 'ორმხრივი მოგება'}</span>
          <h2 className="text-4xl md:text-[52px] font-normal tracking-[-0.022em] mb-5 leading-[1.05] text-[#541A1A] dark:text-[#F1E2D1] text-balance">
            {t.twoSided.titlePrefix}{' '}
            <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">{t.twoSided.titleGradient}</span>
          </h2>
          <p className="text-[#541A1A]/70 dark:text-[#DCC3AA]/85 font-light text-[17px]">{t.twoSided.subtitle}</p>
        </div>

        {/* Segmented tabs */}
        <div className="flex justify-center mb-14">
          <div className="inline-flex p-1 bg-[#DCC3AA]/40 dark:bg-[#1F0808] border border-[#DCC3AA] dark:border-[#D6A569]/15 rounded-full">
            {(['advertisers', 'drivers'] as const).map((tab) => (
              <button
                key={tab}
                id={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-7 py-2.5 text-[11px] font-bold uppercase tracking-[0.24em] rounded-full transition-all duration-300 ${
                  activeTab === tab
                    ? 'bg-[#810B38] dark:bg-[#D6A569] text-[#F1E2D1] dark:text-[#160606] shadow-[0_4px_18px_-6px_rgba(129,11,56,0.5)]'
                    : 'text-[#541A1A]/65 dark:text-[#DCC3AA]/75 hover:text-[#541A1A] dark:hover:text-[#F1E2D1]'
                }`}
              >
                {tab === 'advertisers' ? t.twoSided.advertisersTab : t.twoSided.driversTab}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
            >
              {(activeTab === 'advertisers' ? t.twoSided.advertisersBenefits : t.twoSided.driversBenefits).map((b, i) => {
                const aIcons = [
                  <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
                  <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
                  <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                  <svg key="3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
                  <svg key="4" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
                  <svg key="5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                ];
                const dIcons = [
                  <svg key="0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
                  <svg key="1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                  <svg key="2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
                  <svg key="3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
                  <svg key="4" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                  <svg key="5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ];
                const icon = activeTab === 'advertisers' ? aIcons[i] : dIcons[i];
                return (
                  <div key={i} className="boutique-card p-8 lg:p-9 group">
                    <div className="flex items-start justify-between mb-7">
                      <span className="inline-flex w-11 h-11 items-center justify-center rounded-full border border-[#810B38]/80 dark:border-[#D6A569]/55 text-[#810B38] dark:text-[#D6A569] transition-colors duration-300 group-hover:bg-[#810B38] group-hover:text-[#F1E2D1] dark:group-hover:bg-[#D6A569] dark:group-hover:text-[#160606]">
                        {icon}
                      </span>
                      <span className="font-serif italic text-[15px] text-[#810B38]/50 dark:text-[#D6A569]/50 leading-none">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="text-[18px] font-normal tracking-tight mb-3 text-[#541A1A] dark:text-[#F1E2D1]">{b.title}</h3>
                    <div className="h-px w-8 bg-[#DCC3AA] dark:bg-[#D6A569]/30 mb-3.5" />
                    <p className="text-[#541A1A]/70 dark:text-[#DCC3AA]/82 text-[14.5px] font-light leading-[1.65]">{b.desc}</p>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Hidden anchor for #drivers */}
        <span id="drivers" className="block h-0 w-0 -translate-y-32" aria-hidden />
      </section>

      {/* ─────────────────────── FAQ ─────────────────────── */}
      <section id="faq" className="py-28 lg:py-32 px-6 lg:px-12 max-w-[920px] mx-auto relative">
        <div className="text-center mb-14">
          <span className="eyebrow-rule mb-7 inline-flex">{lang === 'en' ? 'Common Questions' : 'ხშირი კითხვები'}</span>
          <h2 className="text-4xl md:text-[52px] font-normal tracking-[-0.022em] leading-[1.05] text-[#541A1A] dark:text-[#F1E2D1] text-balance">
            {t.faq.titlePrefix}{' '}
            <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">{t.faq.titleGradient}</span>
          </h2>
        </div>
        <ul className="divide-y divide-[#DCC3AA] dark:divide-[#D6A569]/15 border-y border-[#DCC3AA] dark:border-[#D6A569]/15">
          {t.faq.items.map((faq, i) => (
            <li key={i}>
              <button
                className="w-full text-left py-7 lg:py-8 flex justify-between items-center focus:outline-none group"
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
              >
                <h3 className="text-[17px] lg:text-[19px] font-normal pr-8 text-[#541A1A] dark:text-[#F1E2D1] group-hover:text-[#810B38] dark:group-hover:text-[#D6A569] transition-colors duration-300">
                  <span className="inline-block w-8 font-serif italic text-[#810B38]/60 dark:text-[#D6A569]/60 text-[15px]">{String(i + 1).padStart(2, '0')}</span>
                  {faq.question}
                </h3>
                <span
                  className={`text-2xl font-light text-[#810B38] dark:text-[#D6A569] transform transition-transform duration-500 shrink-0 ${
                    activeFaq === i ? 'rotate-45' : ''
                  }`}
                >+</span>
              </button>
              <AnimatePresence>
                {activeFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-8 pl-8 pr-12 text-[15px] text-[#541A1A]/75 dark:text-[#DCC3AA]/85 font-light leading-[1.7] max-w-3xl">
                      <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">— </span>
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ul>
      </section>

      {/* ─────────────────────── CTA — full-bleed dark band ─────────────────────── */}
      <section className="relative bg-[#541A1A] dark:bg-[#0F0303] overflow-hidden">
        {/* Decorative diagonal mesh + corner brackets */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #D6A569 0, #D6A569 1px, transparent 1px, transparent 22px), repeating-linear-gradient(-45deg, #D6A569 0, #D6A569 1px, transparent 1px, transparent 22px)",
          }}
        />
        <div aria-hidden className="absolute top-6 left-6 lg:top-8 lg:left-8 w-12 h-12 border-t border-l border-[#D6A569]/35 pointer-events-none" />
        <div aria-hidden className="absolute top-6 right-6 lg:top-8 lg:right-8 w-12 h-12 border-t border-r border-[#D6A569]/35 pointer-events-none" />
        <div aria-hidden className="absolute bottom-6 left-6 lg:bottom-8 lg:left-8 w-12 h-12 border-b border-l border-[#D6A569]/35 pointer-events-none" />
        <div aria-hidden className="absolute bottom-6 right-6 lg:bottom-8 lg:right-8 w-12 h-12 border-b border-r border-[#D6A569]/35 pointer-events-none" />

        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-20 lg:py-28 relative z-10">
          <div className="grid lg:grid-cols-[1.25fr_1fr] gap-12 lg:gap-20 items-center">

            {/* LEFT: Headline + CTAs */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.36em] text-[#D6A569] mb-7">
                <span className="h-px w-8 bg-[#D6A569]/50" />
                {t.cta.eyebrow}
              </span>
              <h2 className="text-[40px] md:text-[52px] lg:text-[60px] font-normal tracking-[-0.02em] mb-7 leading-[1.05] text-[#F1E2D1] text-balance">
                {t.cta.titlePrefix}{' '}
                <span className="font-serif italic text-[#D6A569]">{t.cta.titleGradient}</span>
              </h2>
              <p className="text-[16px] md:text-[17px] font-light text-[#DCC3AA]/85 mb-10 leading-[1.65] max-w-xl mx-auto lg:mx-0">
                <span className="font-serif italic">— </span>{t.cta.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href="mailto:gzadvertisment@gmail.com"
                  className="group inline-flex items-center justify-center gap-3 px-9 py-[14px] bg-[#D6A569] text-[#160606] font-bold uppercase tracking-[0.22em] text-[11.5px] hover:bg-[#F1E2D1] transition-colors duration-300"
                >
                  {t.cta.contact}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform duration-300 group-hover:translate-x-1"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>
                <a
                  href="tel:+995591410914"
                  className="inline-flex items-center justify-center px-9 py-[14px] bg-transparent text-[#D6A569] font-bold uppercase tracking-[0.22em] text-[11.5px] border border-[#D6A569]/45 hover:bg-[#D6A569] hover:text-[#160606] hover:border-[#D6A569] transition-colors duration-300"
                >
                  {t.cta.call}
                </a>
              </div>
            </div>

            {/* RIGHT: Contact card / details */}
            <div className="relative">
              {/* Top divider on mobile, vertical line on desktop */}
              <div aria-hidden className="hidden lg:block absolute -left-10 top-0 bottom-0 w-px bg-[#D6A569]/15" />

              <ul className="space-y-7 lg:space-y-8">
                {[
                  {
                    label: lang === 'en' ? 'Write' : 'მოგვწერეთ',
                    value: 'gzadvertisment@gmail.com',
                    href: 'mailto:gzadvertisment@gmail.com',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                    ),
                  },
                  {
                    label: lang === 'en' ? 'Call' : 'დაგვირეკეთ',
                    value: '+995 591 410 914',
                    href: 'tel:+995591410914',
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    ),
                  },
                  {
                    label: lang === 'en' ? 'Visit' : 'მისამართი',
                    value: lang === 'en' ? 'Tbilisi, Georgia' : 'თბილისი, საქართველო',
                    href: null,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    ),
                  },
                  {
                    label: lang === 'en' ? 'Hours' : 'სამუშაო საათები',
                    value: lang === 'en' ? 'Mon–Sat · 10:00 – 19:00' : 'ორშ–შაბ · 10:00 – 19:00',
                    href: null,
                    icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    ),
                  },
                ].map((row, i) => (
                  <li key={i} className="flex items-start gap-4 group">
                    <span className="w-9 h-9 rounded-full border border-[#D6A569]/35 flex items-center justify-center text-[#D6A569] shrink-0 group-hover:bg-[#D6A569] group-hover:text-[#160606] transition-colors duration-300">
                      {row.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.32em] text-[#D6A569]/65 mb-1.5">
                        {row.label}
                      </div>
                      {row.href ? (
                        <a href={row.href} className="text-[15px] text-[#F1E2D1] hover:text-[#D6A569] transition-colors duration-300 break-all">
                          {row.value}
                        </a>
                      ) : (
                        <span className="text-[15px] text-[#F1E2D1] font-serif italic">{row.value}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────── FOOTER ─────────────────────── */}
      <footer id="contact" className="paper-grain py-20 lg:py-24 px-6 lg:px-12 bg-[#DCC3AA]/60 dark:bg-[#1F0808] border-t border-[#DCC3AA] dark:border-[#D6A569]/12 relative">
        <div className="max-w-[1320px] mx-auto relative z-10">

          <div className="flex justify-center mb-14">
            <span className="eyebrow-rule">Gzad · Tbilisi</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-10 mb-16">

            {/* Brand */}
            <div className="lg:col-span-2">
              <a href="#" className="inline-flex items-center gap-2.5 mb-5 group">
                <span className="font-serif italic text-[30px] tracking-tight text-[#541A1A] dark:text-[#F1E2D1] leading-none">Gzad</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#810B38] dark:bg-[#D6A569]" />
              </a>
              <p className="text-[#541A1A]/72 dark:text-[#DCC3AA]/82 font-light text-[14.5px] leading-[1.7] max-w-sm mb-8">
                <span className="font-serif italic text-[#810B38] dark:text-[#D6A569]">— </span>{t.footer.tagline}
              </p>
              <div className="flex gap-4 text-[#541A1A] dark:text-[#DCC3AA]">
                {[
                  { l: 'Facebook', d: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /> },
                  { l: 'Instagram', d: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></> },
                  { l: 'LinkedIn', d: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></> },
                ].map((s, i) => (
                  <a key={i} href="#" aria-label={s.l} className="w-9 h-9 border border-[#541A1A]/20 dark:border-[#D6A569]/25 flex items-center justify-center hover:bg-[#810B38] hover:text-[#F1E2D1] hover:border-[#810B38] dark:hover:bg-[#D6A569] dark:hover:text-[#160606] dark:hover:border-[#D6A569] transition-colors duration-300">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">{s.d}</svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <h4 className="text-[#541A1A] dark:text-[#F1E2D1] font-bold tracking-[0.32em] text-[10px] uppercase">{t.footer.platform}</h4>
              <div className="h-px w-8 bg-[#810B38] dark:bg-[#D6A569] my-5" />
              <ul className="space-y-3.5 text-[#541A1A]/72 dark:text-[#DCC3AA]/85 text-[14px] font-light">
                <li><a href="#how-it-works" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.nav.howItWorks}</a></li>
                <li><a href="#advertisers" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.nav.advertisers}</a></li>
                <li><a href="#drivers" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.nav.drivers}</a></li>
                <li><a href="#faq" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.nav.faq}</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[#541A1A] dark:text-[#F1E2D1] font-bold tracking-[0.32em] text-[10px] uppercase">{t.footer.company}</h4>
              <div className="h-px w-8 bg-[#810B38] dark:bg-[#D6A569] my-5" />
              <ul className="space-y-3.5 text-[#541A1A]/72 dark:text-[#DCC3AA]/85 text-[14px] font-light">
                <li><a href="#" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.footer.about}</a></li>
                <li><a href="#faq" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.nav.faq}</a></li>
                <li><a href="#" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.footer.press}</a></li>
                <li><a href="#" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">{t.footer.careers}</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-[#541A1A] dark:text-[#F1E2D1] font-bold tracking-[0.32em] text-[10px] uppercase">{t.footer.contact}</h4>
              <div className="h-px w-8 bg-[#810B38] dark:bg-[#D6A569] my-5" />
              <ul className="space-y-3.5 text-[#541A1A]/72 dark:text-[#DCC3AA]/85 text-[14px] font-light">
                <li><a href="mailto:gzadvertisment@gmail.com" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">gzadvertisment@gmail.com</a></li>
                <li><a href="tel:+995591410914" className="nav-link inline-block hover:text-[#810B38] dark:hover:text-[#D6A569]">+995 591 410 914</a></li>
                <li className="pt-3 text-[#541A1A]/60 dark:text-[#DCC3AA]/65 font-serif italic">
                  {lang === 'ge' ? 'თბილისი, საქართველო' : 'Tbilisi, Georgia'}
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-[#810B38]/15 dark:border-[#D6A569]/15 flex flex-col md:flex-row justify-between items-center gap-5">
            <p className="text-[#541A1A]/65 dark:text-[#DCC3AA]/70 text-[12px] font-light tracking-[0.18em]">
              {t.footer.rights}
            </p>
            <div className="flex gap-8 text-[12px] text-[#541A1A]/65 dark:text-[#DCC3AA]/70 font-light tracking-[0.18em]">
              <a href="#" className="hover:text-[#810B38] dark:hover:text-[#D6A569] transition-colors duration-300">Privacy</a>
              <a href="#" className="hover:text-[#810B38] dark:hover:text-[#D6A569] transition-colors duration-300">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
