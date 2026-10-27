// Landing page copy. Kept apart from app/translations.ts, which the portals
// also read, so the marketing page can change without touching them.
//
// Text wrapped in **double asterisks** is rendered as the emphasised (dark)
// part of a muted paragraph — see rich() in Reveal.tsx.

export type Lang = 'en' | 'ge'

export interface Ad {
  tag: string
  brand: string
  line: string
  big?: string
  theme: 'sun' | 'cobalt' | 'self' | 'magenta' | 'forest'
}

const en = {
  nav: {
    how: 'How it works',
    where: 'Targeting',
    pricing: 'Pricing',
    fleets: 'For fleets',
    faq: 'FAQ',
    login: 'Log in',
    cta: 'Start a campaign',
    menu: 'Open menu',
    close: 'Close menu',
  },
  hero: {
    eyebrow: 'Taxi-top LED advertising · Tbilisi',
    titleA: 'Your ad,',
    titleB: 'on the move.',
    lede: 'Double-sided LED screens on taxis across Tbilisi. **Pick the districts, pay only for hours on air,** and see every play on a map.',
    primary: 'Start a campaign',
    secondary: 'See how it works',
    status: 'Now onboarding launch partners',
  },
  ads: [
    { tag: 'Open till 2am', brand: 'Puri House', line: 'Hot from the oven · Vake', theme: 'sun' },
    { tag: 'First month', brand: 'VAKE FIT', line: 'Join this week', big: '₾0', theme: 'cobalt' },
    { tag: 'Gzad', brand: 'Your ad here.', line: 'gzad.ge', theme: 'self' },
    { tag: 'Sat – Sun', brand: 'Weekend Sale', line: 'Saburtalo', big: '−30%', theme: 'magenta' },
    { tag: '2 for 1 before 10am', brand: 'nova coffee', line: 'Rustaveli · Chavchavadze', theme: 'forest' },
  ] as Ad[],
  facts: [
    { value: '2', unit: 'sides', label: 'Seen from both sides of the street' },
    { value: '4,500+', unit: 'nits', label: 'Readable in midday sun' },
    { value: '5', unit: 'slots', label: 'Brands sharing one loop' },
    { value: '₾2', unit: '/ hour', label: 'Base rate per screen' },
  ],
  loop: {
    eyebrow: 'One screen, five slots',
    title: 'Your ad comes around again. And again.',
    lede: 'Every screen plays a loop of five ads. **Yours takes one slot** and returns every time the loop does. With five 10-second ads, the whole loop takes 50 seconds.',
    you: 'Your ad',
    slot: 'Slot',
    seconds: 's',
    caption: 'Shown in the screen’s 3:1 format, LED grid and all, the way your ad plays on the street.',
  },
  where: {
    eyebrow: 'Targeting',
    title: 'Choose where it plays.',
    lede: 'Focus on the districts where your customers live, work and spend, **or cover the whole city.** Tap a district to try it.',
    selected: 'Selected',
    none: 'Tap a district on the map',
    all: 'Whole city',
    clear: 'Clear',
    districts: {
      Mtatsminda: 'Mtatsminda',
      Vake: 'Vake',
      Saburtalo: 'Saburtalo',
      Chughureti: 'Chughureti',
      Didube: 'Didube',
      Nadzaladevi: 'Nadzaladevi',
      Gldani: 'Gldani',
      Isani: 'Isani',
      Samgori: 'Samgori',
      Krtsanisi: 'Krtsanisi',
    } as Record<string, string>,
  },
  proof: {
    eyebrow: 'Proof of play',
    title: 'Every play, on the record.',
    lede: 'Screens report each play with its time and GPS position. **Watch your campaign live on the map** and check the log behind every hour you pay for.',
    live: 'Live',
    logTitle: 'Play log',
  },
  features: {
    eyebrow: 'Built for the street',
    title: 'Everything a campaign needs. Nothing it doesn’t.',
    items: [
      { title: 'Double-sided', body: 'Two screens, back to back. Both sides of the street see your ad.' },
      { title: 'Ultra-bright screen', body: 'Readable even in direct sun, impossible to miss at night (4,500+ nits).' },
      { title: 'Change it any time', body: 'Upload a new creative and the screens switch over once it’s approved. Nothing to reprint.' },
      { title: 'Checked before it airs', body: 'Our team reviews every creative before it reaches the street.' },
      { title: 'Prepaid, metered', body: 'Top up a balance. Airtime is metered in 10-minute blocks and deducted every 15 minutes. Set a daily cap, and we’ll warn you before the balance runs out.' },
      { title: 'Live map', body: 'See where your ad is right now, and everywhere it has been.' },
    ],
  },
  steps: {
    eyebrow: 'How it works',
    title: 'On the road in three steps.',
    items: [
      { title: 'Send your creative', body: 'An image or a short video in a wide 3:1 format. Don’t have one? We can help design it.' },
      { title: 'Choose districts and budget', body: 'Tell us where you want to be seen and for how many hours a day. We set it up and confirm the price.' },
      { title: 'Go live and follow along', body: 'Your ad joins the loop. Track plays, places and spend from your dashboard.' },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Top up once. Pay as you play.',
    lede: 'Add funds to your balance. Your airtime is metered in 10-minute blocks, each priced by **your ad length, the district the car is in and the time of day,** and charged only for what actually played. Your balance updates every 15 minutes, and you can set a daily cap.',
    sim: {
      balance: 'Balance',
      deducted: 'Deducted',
      lowAlert: 'Low-balance alert',
      nextUpdate: 'Next balance update in',
      min: 'min',
      metered: 'metered since the last update',
      topUp: 'Top up',
      play: 'Play',
      pause: 'Pause',
      adLength: 'Ad length',
      cap: 'Daily cap',
      noCap: 'No cap',
      today: 'Spent today',
      capReached: 'Daily cap reached. Ads pause until midnight.',
      now: 'Right now',
      perHour: 'per hour',
      perBlock: 'per 10-minute block',
      taxiOff: 'Taxi off: nothing is charged',
      usage: 'Metered in 10-minute blocks',
      off: 'Off',
      capped: 'Cap',
      empty: 'Balance used up. Ads paused until you top up.',
      note: 'An illustration of one screen. Which tier each district sits in is an example; your exact rates are confirmed when you book.',
    },
    tiers: { '1': 'Prime', '2': 'Busy', '3': 'Popular', '4': 'Standard' } as Record<string, string>,
    bands: { night: 'Night', day: 'Daytime', evening: 'Evening', rush: 'Rush hour' } as Record<string, string>,
    cta: 'Get a quote',
  },
  fleets: {
    eyebrow: 'For taxi fleets',
    title: 'Your cars already cover the city. Now they can earn from it.',
    items: [
      { title: 'We install and maintain', body: 'Our team fits and services the screens, at our cost.' },
      { title: 'A share of every hour sold', body: 'Your fleet earns a cut of the ad revenue its cars bring in, paid monthly.' },
      { title: 'One dashboard', body: 'See each car, where its ads ran and what it earned.' },
    ],
    cta: 'Become a fleet partner',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered.',
    items: [
      {
        q: 'How is a campaign priced?',
        a: 'By the screen-hour: one ad slot, on one screen, for one hour. The base rate depends on your ad length (₾2.00 for 10 seconds, ₾3.40 for 20, ₾4.60 for 30), then adjusts for where the car is and when: busier districts cost up to 45% more, rush hour costs more and late night less. Airtime is metered in 10-minute blocks, and a block your ad only partly played is charged only for that part.',
      },
      {
        q: 'Do I need a long contract?',
        a: 'No. You top up a balance, and every 15 minutes it’s drawn down for the airtime you used. You can set a daily cap, we’ll warn you when the balance runs low, and if it runs out your ads pause automatically.',
      },
      {
        q: 'Can I change my ad mid-campaign?',
        a: 'Yes. Upload a new creative, and once our team approves it the screens switch over.',
      },
      {
        q: 'How do I know my ad actually played?',
        a: 'Every screen reports each play with the time and GPS position. You see it on the map and in your campaign log.',
      },
      {
        q: 'What should my creative look like?',
        a: 'The screen is wide, with a 3:1 ratio. Big type, strong contrast and one clear message work best. We’re happy to help with the design.',
      },
      {
        q: 'How many other ads share the screen?',
        a: 'Up to four. Each screen runs a loop of five slots, and your campaign takes one of them.',
      },
      {
        q: 'I run a taxi fleet. How do we join?',
        a: 'Sign up as a fleet partner and we’ll get in touch to agree terms and schedule the installation.',
      },
    ],
  },
  closing: {
    title: 'Put your brand on the road.',
    lede: 'Tell us what you’re promoting and where. We’ll come back with a plan and a price.',
    email: 'Email us',
    call: 'Call',
    hours: 'Mon – Sat, 10:00 – 19:00',
  },
  footer: {
    tagline: 'Taxi-top LED advertising in Tbilisi.',
    product: 'Product',
    partners: 'Partners',
    legal: 'Legal',
    fleetSignup: 'Fleet sign-up',
    privacy: 'Privacy',
    terms: 'Terms',
    rights: '© 2026 Gzadvertisement LLC. All rights reserved.',
  },
}

export type Copy = typeof en

const ge: Copy = {
  nav: {
    how: 'როგორ მუშაობს',
    where: 'ტარგეტირება',
    pricing: 'ფასები',
    fleets: 'ავტოპარკებს',
    faq: 'კითხვები',
    login: 'შესვლა',
    cta: 'კამპანიის დაწყება',
    menu: 'მენიუს გახსნა',
    close: 'მენიუს დახურვა',
  },
  hero: {
    eyebrow: 'LED რეკლამა ტაქსებზე · თბილისი',
    titleA: 'თქვენი რეკლამა,',
    titleB: 'მოძრაობაში.',
    lede: 'ორმხრივი LED ეკრანები თბილისის ტაქსებზე. **აირჩიეთ უბნები, გადაიხადეთ მხოლოდ ეთერის საათებში** და ნახეთ ყოველი ჩვენება რუკაზე.',
    primary: 'კამპანიის დაწყება',
    secondary: 'როგორ მუშაობს',
    status: 'ვიღებთ პირველ პარტნიორებს',
  },
  ads: [
    { tag: 'ღიაა 02:00-მდე', brand: 'Puri House', line: 'ცხელი, ახლახან გამომცხვარი · ვაკე', theme: 'sun' },
    { tag: 'პირველი თვე', brand: 'VAKE FIT', line: 'შემოგვიერთდით ამ კვირაში', big: '₾0', theme: 'cobalt' },
    { tag: 'Gzad', brand: 'თქვენი რეკლამა აქ.', line: 'gzad.ge', theme: 'self' },
    { tag: 'შაბ – კვი', brand: 'ფასდაკლება', line: 'საბურთალო', big: '−30%', theme: 'magenta' },
    { tag: '2 ერთის ფასად 10:00-მდე', brand: 'nova coffee', line: 'რუსთაველი · ჭავჭავაძე', theme: 'forest' },
  ],
  facts: [
    { value: '2', unit: 'მხარე', label: 'ჩანს ქუჩის ორივე მხრიდან' },
    { value: '4,500+', unit: 'ნიტი', label: 'იკითხება შუადღის მზეზეც' },
    { value: '5', unit: 'სლოტი', label: 'ხუთი ბრენდი ერთ ციკლში' },
    { value: '₾2', unit: '/ საათი', label: 'საბაზო ტარიფი ერთ ეკრანზე' },
  ],
  loop: {
    eyebrow: 'ერთი ეკრანი, ხუთი სლოტი',
    title: 'თქვენი რეკლამა ბრუნდება. ისევ და ისევ.',
    lede: 'ყოველი ეკრანი ხუთი რეკლამის ციკლს უშვებს. **თქვენი რეკლამა ერთ სლოტს იკავებს** და ყოველ ციკლში ბრუნდება. ხუთი 10-წამიანი რეკლამით მთელი ციკლი 50 წამს გრძელდება.',
    you: 'თქვენი რეკლამა',
    slot: 'სლოტი',
    seconds: 'წმ',
    caption: 'ნაჩვენებია ეკრანის 3:1 ფორმატში, LED ბადით, ისე, როგორც თქვენი რეკლამა ქუჩაში გადის.',
  },
  where: {
    eyebrow: 'ტარგეტირება',
    title: 'აირჩიეთ, სად გავიდეს.',
    lede: 'ფოკუსირდით უბნებზე, სადაც თქვენი მომხმარებლები ცხოვრობენ, მუშაობენ და ხარჯავენ, **ან დაფარეთ მთელი ქალაქი.** სცადეთ: შეეხეთ უბანს რუკაზე.',
    selected: 'არჩეულია',
    none: 'შეეხეთ უბანს რუკაზე',
    all: 'მთელი ქალაქი',
    clear: 'გასუფთავება',
    districts: {
      Mtatsminda: 'მთაწმინდა',
      Vake: 'ვაკე',
      Saburtalo: 'საბურთალო',
      Chughureti: 'ჩუღურეთი',
      Didube: 'დიდუბე',
      Nadzaladevi: 'ნაძალადევი',
      Gldani: 'გლდანი',
      Isani: 'ისანი',
      Samgori: 'სამგორი',
      Krtsanisi: 'კრწანისი',
    },
  },
  proof: {
    eyebrow: 'ჩვენების დადასტურება',
    title: 'ყოველი ჩვენება ჩანაწერშია.',
    lede: 'ეკრანი ყოველ ჩვენებას დროსა და GPS მდებარეობასთან ერთად აფიქსირებს. **ადევნეთ თვალი კამპანიას რუკაზე პირდაპირ რეჟიმში** და ნახეთ ჩანაწერი ყოველი გადახდილი საათის უკან.',
    live: 'პირდაპირ',
    logTitle: 'ჩვენებების ჟურნალი',
  },
  features: {
    eyebrow: 'შექმნილია ქუჩისთვის',
    title: 'ყველაფერი, რაც კამპანიას სჭირდება. ზედმეტის გარეშე.',
    items: [
      { title: 'ორმხრივი', body: 'ორი ეკრანი ზურგით ერთმანეთზე. თქვენს რეკლამას ქუჩის ორივე მხარე ხედავს.' },
      { title: 'ულტრაკაშკაშა ეკრანი', body: 'იკითხება მზის პირდაპირ სხივებზეც, ღამით კი შეუმჩნეველი ვერ დარჩება (4,500+ ნიტი).' },
      { title: 'შეცვალეთ ნებისმიერ დროს', body: 'ატვირთეთ ახალი ვიზუალი და დამტკიცების შემდეგ ეკრანები მასზე გადაერთვება. ხელახლა ბეჭდვა არ სჭირდება.' },
      { title: 'მოწმდება ეთერამდე', body: 'ჩვენი გუნდი ყველა ვიზუალს ამოწმებს, სანამ ის ქუჩაში გავა.' },
      { title: 'წინასწარი, გაზომილი', body: 'შეავსეთ ბალანსი. ეთერი იზომება 10-წუთიანი ბლოკებით და ჩამოიჭრება ყოველ 15 წუთში. დააწესეთ დღიური ლიმიტი და გაგაფრთხილებთ, სანამ ბალანსი ამოიწურება.' },
      { title: 'ცოცხალი რუკა', body: 'ნახეთ, სად არის თქვენი რეკლამა ახლა და სად იყო აქამდე.' },
    ],
  },
  steps: {
    eyebrow: 'როგორ მუშაობს',
    title: 'გზაზე სამ ნაბიჯში.',
    items: [
      { title: 'გამოგვიგზავნეთ ვიზუალი', body: 'სურათი ან მოკლე ვიდეო ფართო, 3:1 ფორმატში. არ გაქვთ? დიზაინში დაგეხმარებით.' },
      { title: 'აირჩიეთ უბნები და ბიუჯეტი', body: 'გვითხარით, სად გსურთ გამოჩენა და დღეში რამდენი საათით. ჩვენ ყველაფერს ავაწყობთ და ფასს დაგიდასტურებთ.' },
      { title: 'გადით ეთერში და ადევნეთ თვალი', body: 'თქვენი რეკლამა ციკლს უერთდება. ჩვენებებს, ლოკაციებსა და ხარჯს დაფიდან აკონტროლებთ.' },
    ],
  },
  pricing: {
    eyebrow: 'ფასები',
    title: 'შეავსეთ ბალანსი. იხდით მხოლოდ ეთერში.',
    lede: 'შეიტანეთ თანხა ბალანსზე. ეთერი იზომება 10-წუთიანი ბლოკებით: თითოეული ბლოკის ფასი დამოკიდებულია **რეკლამის ხანგრძლივობაზე, უბანზე, სადაც მანქანაა, და დღის დროზე,** და იხდით მხოლოდ იმას, რაც რეალურად გავიდა. ბალანსი ახლდება ყოველ 15 წუთში და შეგიძლიათ დააწესოთ დღიური ლიმიტიც.',
    sim: {
      balance: 'ბალანსი',
      deducted: 'ჩამოიჭრა',
      lowAlert: 'გაფრთხილება დაბალ ბალანსზე',
      nextUpdate: 'ბალანსის შემდეგი განახლება',
      min: 'წთ-ში',
      metered: 'დაგროვდა ბოლო განახლების შემდეგ',
      topUp: 'შევსება',
      play: 'გაშვება',
      pause: 'პაუზა',
      adLength: 'რეკლამის ხანგრძლივობა',
      cap: 'დღიური ლიმიტი',
      noCap: 'ლიმიტის გარეშე',
      today: 'დღეს დაიხარჯა',
      capReached: 'დღიური ლიმიტი ამოიწურა. რეკლამა შუაღამემდე ჩერდება.',
      now: 'ახლა',
      perHour: 'საათში',
      perBlock: '10-წუთიან ბლოკზე',
      taxiOff: 'ტაქსი გამორთულია: არაფერი ირიცხება',
      usage: 'იზომება 10-წუთიანი ბლოკებით',
      off: 'გამორთ.',
      capped: 'ლიმიტი',
      empty: 'ბალანსი ამოიწურა. რეკლამა შეჩერებულია შევსებამდე.',
      note: 'ილუსტრაცია ერთი ეკრანისთვის. უბნების კატეგორიები სანიმუშოა; ზუსტ ტარიფებს დაჯავშნისას დაგიდასტურებთ.',
    },
    tiers: { '1': 'პრემიუმი', '2': 'დატვირთული', '3': 'პოპულარული', '4': 'სტანდარტული' },
    bands: { night: 'ღამე', day: 'დღე', evening: 'საღამო', rush: 'პიკის საათი' },
    cta: 'ფასის მოთხოვნა',
  },
  fleets: {
    eyebrow: 'ავტოპარკებისთვის',
    title: 'თქვენი მანქანები უკვე მთელ ქალაქს ფარავს. ახლა შემოსავალიც მოიტანონ.',
    items: [
      { title: 'მონტაჟი და მომსახურება ჩვენზეა', body: 'ეკრანებს ჩვენი გუნდი ამონტაჟებს და ემსახურება, ჩვენივე ხარჯით.' },
      { title: 'წილი ყოველი გაყიდული საათიდან', body: 'ავტოპარკი იღებს წილს სარეკლამო შემოსავლიდან, რომელსაც მისი მანქანები გამოიმუშავებს. ანგარიშსწორება ყოველთვიურია.' },
      { title: 'ერთი დაფა', body: 'ნახეთ თითოეული მანქანა, სად გავიდა მისი რეკლამა და რამდენი გამოიმუშავა.' },
    ],
    cta: 'გახდით პარტნიორი',
  },
  faq: {
    eyebrow: 'კითხვები',
    title: 'კითხვები და პასუხები.',
    items: [
      {
        q: 'როგორ ითვლება კამპანიის ფასი?',
        a: 'ეკრან-საათით: ერთი სლოტი, ერთ ეკრანზე, ერთი საათით. საბაზო ტარიფი რეკლამის ხანგრძლივობაზეა დამოკიდებული (₾2.00 10 წამისთვის, ₾3.40 20 წამისთვის, ₾4.60 30 წამისთვის) და იცვლება იმის მიხედვით, სად და როდის მოძრაობს მანქანა: დატვირთულ უბნებში ფასი 45%-მდე მეტია, პიკის საათებში — მეტი, გვიან ღამით — ნაკლები. ეთერი იზომება 10-წუთიანი ბლოკებით და ნაწილობრივ გასულ ბლოკში მხოლოდ გასული ნაწილი ირიცხება.',
      },
      {
        q: 'საჭიროა გრძელვადიანი კონტრაქტი?',
        a: 'არა. ავსებთ ბალანსს და ის ყოველ 15 წუთში მცირდება გამოყენებული ეთერის მიხედვით. შეგიძლიათ დააწესოთ დღიური ლიმიტი, ბალანსის შემცირებისას გაგაფრთხილებთ, ხოლო ამოწურვისას რეკლამა ავტომატურად ჩერდება.',
      },
      {
        q: 'შემიძლია რეკლამის შეცვლა კამპანიის მსვლელობისას?',
        a: 'დიახ. ატვირთეთ ახალი ვიზუალი და ჩვენი გუნდის დამტკიცების შემდეგ ეკრანები მასზე გადაერთვება.',
      },
      {
        q: 'საიდან გავიგო, რომ რეკლამა ნამდვილად გავიდა?',
        a: 'ყოველი ეკრანი ყოველ ჩვენებას დროსა და GPS მდებარეობასთან ერთად აგზავნის. ყველაფერს ნახავთ რუკაზე და კამპანიის ჟურნალში.',
      },
      {
        q: 'როგორი უნდა იყოს ვიზუალი?',
        a: 'ეკრანი ფართოა, 3:1 თანაფარდობით. საუკეთესოდ მუშაობს მსხვილი ტექსტი, ძლიერი კონტრასტი და ერთი მკაფიო მესიჯი. დიზაინში სიამოვნებით დაგეხმარებით.',
      },
      {
        q: 'კიდევ რამდენი რეკლამა იზიარებს ეკრანს?',
        a: 'მაქსიმუმ ოთხი. ყოველი ეკრანი ხუთსლოტიან ციკლს უშვებს და თქვენი კამპანია ერთ სლოტს იკავებს.',
      },
      {
        q: 'ტაქსების პარკი მაქვს. როგორ შევუერთდეთ?',
        a: 'დარეგისტრირდით ავტოპარკის პარტნიორად და დაგიკავშირდებით პირობების შესათანხმებლად და მონტაჟის დასაგეგმად.',
      },
    ],
  },
  closing: {
    title: 'თქვენი ბრენდი — გზაზე.',
    lede: 'მოგვწერეთ, რას არეკლამებთ და სად. შემოგთავაზებთ გეგმას და ფასს.',
    email: 'მოგვწერეთ',
    call: 'დაგვირეკეთ',
    hours: 'ორშ – შაბ, 10:00 – 19:00',
  },
  footer: {
    tagline: 'LED რეკლამა ტაქსებზე, თბილისში.',
    product: 'პროდუქტი',
    partners: 'პარტნიორები',
    legal: 'იურიდიული',
    fleetSignup: 'ავტოპარკის რეგისტრაცია',
    privacy: 'კონფიდენციალურობა',
    terms: 'წესები და პირობები',
    rights: '© 2026 შპს „გზადვერთაისმენთ“. ყველა უფლება დაცულია.',
  },
}

export const copy: Record<Lang, Copy> = { en, ge }

export const CONTACT = {
  email: 'gzadvertisment@gmail.com',
  phone: '+995 591 410 914',
  phoneHref: 'tel:+995591410914',
}
