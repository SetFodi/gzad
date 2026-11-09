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
  "nav": {
    "how": "How it works",
    "where": "Coverage",
    "pricing": "Pricing",
    "fleets": "For fleets",
    "faq": "FAQ",
    "login": "Log in",
    "cta": "Start a campaign",
    "menu": "Open menu",
    "close": "Close menu"
  },
  "hero": {
    "eyebrow": "Taxi-top LED advertising · Tbilisi",
    "titleA": "Your ad,",
    "titleB": "on the move.",
    "lede": "Double-sided LED screens on taxis across Tbilisi. **Your ad travels with the taxis.** Pay for airtime and track your campaign on the map.",
    "primary": "Start a campaign",
    "secondary": "See how it works",
    "status": "Now onboarding launch partners"
  },
  "ads": [
    {
      "tag": "Freshly baked",
      "brand": "Puri House",
      "line": "Hot from the oven · Vake",
      "theme": "sun"
    },
    {
      "tag": "Join the club",
      "brand": "VAKE FIT",
      "line": "Join this week",
      "theme": "cobalt"
    },
    {
      "tag": "Gzad",
      "brand": "Your ad here.",
      "line": "gzadvertisement.ge",
      "theme": "self"
    },
    {
      "tag": "Sat – Sun",
      "brand": "Weekend Sale",
      "line": "Saburtalo",
      "theme": "magenta"
    },
    {
      "tag": "Start your morning",
      "brand": "nova coffee",
      "line": "Rustaveli · Chavchavadze",
      "theme": "forest"
    }
  ] as Ad[],
  "facts": [
    {
      "value": "In motion",
      "unit": "",
      "label": "Your brand travels through Tbilisi"
    },
    {
      "value": "Day & night",
      "unit": "",
      "label": "Bright screens made for the street"
    },
    {
      "value": "Recorded",
      "unit": "",
      "label": "Follow your campaign in your account"
    },
    {
      "value": "Flexible",
      "unit": "",
      "label": "Set a budget that suits your campaign"
    }
  ],
  "loop": {
    "eyebrow": "Advertising on the move",
    "title": "Your ad comes around again. And again.",
    "lede": "Your creative appears on a roof-mounted LED screen as taxis travel through Tbilisi. **Ads repeat throughout the journey**, bringing your brand back into view.",
    "you": "Your ad",
    "slot": "Slot",
    "seconds": "s",
    "caption": "A double-sided LED screen on the taxi’s roof. The car keeps moving, and the ads keep rotating.",
    "sceneLabel": "A white demo sedan with a roof-mounted LED screen driving past Tbilisi’s hills, TV tower and Old Town balconies.",
    "pause": "Pause animation",
    "play": "Play animation"
  },
  "where": {
    "eyebrow": "On the move",
    "title": "Your ad follows the taxis.",
    "lede": "Your ad runs during taxis’ regular trips around Tbilisi. **Where it appears depends on where they drive.** Track the actual locations and airtime costs in your dashboard.",
    "budgetLabel": "You control the budget",
    "budget": "Set a daily spending limit.",
    "route": "Example route",
    "caption": "An illustration of a taxi’s route. Actual coverage varies with its trips.",
    "districts": {
      "Mtatsminda": "Mtatsminda",
      "Vake": "Vake",
      "Saburtalo": "Saburtalo",
      "Chughureti": "Chughureti",
      "Didube": "Didube",
      "Nadzaladevi": "Nadzaladevi",
      "Gldani": "Gldani",
      "Isani": "Isani",
      "Samgori": "Samgori",
      "Krtsanisi": "Krtsanisi"
    }
  },
  "proof": {
    "eyebrow": "Proof of play",
    "title": "Every play, on the record.",
    "lede": "Screens report each play with its time and GPS position. **Follow your campaign on the map** and check its recorded delivery in your account.",
    "live": "Live",
    "logTitle": "Play log",
    "recent": "Recent",
    "recorded": "Recorded",
    "example": "Example"
  },
  "features": {
    "eyebrow": "Built for the street",
    "title": "Everything a campaign needs. Nothing it doesn’t.",
    "items": [
      {
        "title": "Double-sided",
        "body": "Two screens, back to back. Both sides of the street see your ad."
      },
      {
        "title": "Ultra-bright screen",
        "body": "Made to stay readable in bright daylight and after dark."
      },
      {
        "title": "Change it any time",
        "body": "Upload a new creative and the screens switch over once it’s approved. Nothing to reprint."
      },
      {
        "title": "Checked before it airs",
        "body": "Our team reviews every creative before it reaches the street."
      },
      {
        "title": "Prepaid, metered",
        "body": "Top up your balance and set an optional daily limit. Your account shows recorded airtime and spending, and alerts you when funds run low."
      },
      {
        "title": "Live map",
        "body": "See where your ad is right now, and everywhere it has been."
      }
    ]
  },
  "steps": {
    "eyebrow": "How it works",
    "title": "Get your campaign on the road.",
    "items": [
      {
        "title": "Send your creative",
        "body": "A wide image or a short video. Create an account for the creative requirements, or ask us for help with the design."
      },
      {
        "title": "Set your budget",
        "body": "Top up your balance and set an optional daily spending limit. Our team reviews your ad and assigns it to screens."
      },
      {
        "title": "Go live and follow along",
        "body": "Your ad joins the loop. Track plays, places and spend from your dashboard."
      }
    ]
  },
  "pricing": {
    "eyebrow": "Your campaign budget",
    "title": "A budget that moves with you.",
    "lede": "Fund your balance and pay for recorded airtime. Cost depends on your creative and where and when the taxis travel. **Explore the details and try both calculators in your account**, or talk to us about your campaign.",
    "login": "Log in",
    "register": "Create an account",
    "contact": "Talk to our team"
  },
  "fleets": {
    "eyebrow": "For taxi fleets",
    "title": "Your cars already cover the city. Now they can earn from it.",
    "items": [
      {
        "title": "We install and maintain",
        "body": "Our team fits and services the screens, at our cost."
      },
      {
        "title": "A share of the revenue",
        "body": "Your fleet earns a share of the ad revenue its cars bring in, on terms set in your partnership agreement."
      },
      {
        "title": "One dashboard",
        "body": "See each car, whether its screen is on and where its ads ran."
      }
    ],
    "cta": "Become a fleet partner"
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Questions, answered.",
    "more": "Explore campaign details and calculators in your account.",
    "items": [
      {
        "q": "How is a campaign priced?",
        "a": "Pricing follows your creative, recorded airtime, and where and when the taxis travel. Log in or create an account to explore the rates and calculators, or contact us to discuss your campaign."
      },
      {
        "q": "Do I need a long contract?",
        "a": "You fund a prepaid balance and can set an optional daily spending limit. Your ads pause when the balance is used up. Contact us for the terms that apply to your campaign."
      },
      {
        "q": "Can I change my ad mid-campaign?",
        "a": "Yes. Upload a new creative, and once our team approves it the screens switch over."
      },
      {
        "q": "How do I know my ad actually played?",
        "a": "Every screen reports each play with the time and GPS position. You see it on the map and in your campaign log."
      },
      {
        "q": "What should my creative look like?",
        "a": "Use a wide image or short video with large text, strong contrast and a clear message. The full creative requirements are available in your account. We can also help with design."
      },
      {
        "q": "How do ads appear on the screen?",
        "a": "Screens rotate between approved campaigns, so your ad appears repeatedly along the journey. Log in or create an account to learn how airtime works and estimate your budget."
      },
      {
        "q": "I run a taxi fleet. How do we join?",
        "a": "Sign up as a fleet partner and we’ll get in touch to agree terms and schedule the installation."
      }
    ]
  },
  "closing": {
    "title": "Put your brand on the road.",
    "lede": "Tell us what you’re promoting and your budget. We’ll help you plan the campaign.",
    "email": "Email us",
    "call": "Call",
    "hours": "Mon – Sat, 10:00 – 19:00"
  },
  "footer": {
    "tagline": "Taxi-top LED advertising in Tbilisi.",
    "product": "Product",
    "partners": "Partners",
    "legal": "Legal",
    "fleetSignup": "Fleet sign-up",
    "privacy": "Privacy",
    "terms": "Terms",
    "rights": "© 2026 Gzadvertisement LLC. All rights reserved."
  }
}

export type Copy = Omit<typeof en, 'where'> & { where: Omit<typeof en.where, 'districts'> & { districts: Record<string, string> } }

const ge: Copy = {
  "nav": {
    "how": "როგორ მუშაობს",
    "where": "დაფარვა",
    "pricing": "ფასები",
    "fleets": "ავტოპარკებს",
    "faq": "კითხვები",
    "login": "შესვლა",
    "cta": "კამპანიის დაწყება",
    "menu": "მენიუს გახსნა",
    "close": "მენიუს დახურვა"
  },
  "hero": {
    "eyebrow": "LED რეკლამა ტაქსებზე · თბილისი",
    "titleA": "თქვენი რეკლამა,",
    "titleB": "მოძრაობაში.",
    "lede": "ორმხრივი LED ეკრანები თბილისის ტაქსებზე. **თქვენი რეკლამა ტაქსებთან ერთად მოძრაობს.** გადაიხადეთ ეთერისთვის და თვალი ადევნეთ კამპანიას რუკაზე.",
    "primary": "კამპანიის დაწყება",
    "secondary": "როგორ მუშაობს",
    "status": "ვიღებთ პირველ პარტნიორებს"
  },
  "ads": [
    {
      "tag": "ახლად გამომცხვარი",
      "brand": "Puri House",
      "line": "ცხელი, ახლახან გამომცხვარი · ვაკე",
      "theme": "sun"
    },
    {
      "tag": "შემოგვიერთდით",
      "brand": "VAKE FIT",
      "line": "შემოგვიერთდით ამ კვირაში",
      "theme": "cobalt"
    },
    {
      "tag": "Gzad",
      "brand": "თქვენი რეკლამა აქ.",
      "line": "gzadvertisement.ge",
      "theme": "self"
    },
    {
      "tag": "შაბ – კვი",
      "brand": "ფასდაკლება",
      "line": "საბურთალო",
      "theme": "magenta"
    },
    {
      "tag": "დაიწყეთ დილა",
      "brand": "nova coffee",
      "line": "რუსთაველი · ჭავჭავაძე",
      "theme": "forest"
    }
  ],
  "facts": [
    {
      "value": "მოძრაობაში",
      "unit": "",
      "label": "თქვენი ბრენდი თბილისის ქუჩებში"
    },
    {
      "value": "დღე და ღამე",
      "unit": "",
      "label": "ქუჩისთვის შექმნილი კაშკაშა ეკრანები"
    },
    {
      "value": "აღრიცხული",
      "unit": "",
      "label": "ადევნეთ თვალი კამპანიას ანგარიშიდან"
    },
    {
      "value": "მოქნილი",
      "unit": "",
      "label": "მოარგეთ ბიუჯეტი თქვენს კამპანიას"
    }
  ],
  "loop": {
    "eyebrow": "რეკლამა მოძრაობაში",
    "title": "თქვენი რეკლამა ბრუნდება. ისევ და ისევ.",
    "lede": "თქვენი ვიზუალი ტაქსის სახურავზე დამონტაჟებულ LED ეკრანზე გადის, თბილისის ქუჩებში მგზავრობისას. **რეკლამები გზადაგზა მეორდება** და თქვენს ბრენდს კვლავ აჩენს.",
    "you": "თქვენი რეკლამა",
    "slot": "სლოტი",
    "seconds": "წმ",
    "caption": "ორმხრივი LED ეკრანი ტაქსის სახურავზე. ტაქსი მოძრაობს, რეკლამები კი ერთმანეთს ენაცვლება.",
    "sceneLabel": "თეთრი სადემონსტრაციო სედანი სახურავზე LED ეკრანით, თბილისის მთების, ტელეანძისა და ძველი ქალაქის აივნების ფონზე.",
    "pause": "ანიმაციის შეჩერება",
    "play": "ანიმაციის გაშვება"
  },
  "where": {
    "eyebrow": "მოძრაობა ქალაქში",
    "title": "რეკლამაც გზაშია.",
    "lede": "თქვენი რეკლამა ტაქსებზე მათი ყოველდღიური მგზავრობების დროს გადის. **ჩვენების ადგილი ტაქსის მარშრუტზეა დამოკიდებული.** რეალურ ლოკაციებსა და ეთერის ხარჯს თქვენს დაფაზე ნახავთ.",
    "budgetLabel": "ბიუჯეტს თქვენ აკონტროლებთ",
    "budget": "დააწესეთ ხარჯვის დღიური ლიმიტი.",
    "route": "მარშრუტის მაგალითი",
    "caption": "ტაქსის მარშრუტის ილუსტრაცია. რეალური დაფარვა მის მგზავრობებზეა დამოკიდებული.",
    "districts": {
      "Mtatsminda": "მთაწმინდა",
      "Vake": "ვაკე",
      "Saburtalo": "საბურთალო",
      "Chughureti": "ჩუღურეთი",
      "Didube": "დიდუბე",
      "Nadzaladevi": "ნაძალადევი",
      "Gldani": "გლდანი",
      "Isani": "ისანი",
      "Samgori": "სამგორი",
      "Krtsanisi": "კრწანისი"
    }
  },
  "proof": {
    "eyebrow": "ჩვენების დადასტურება",
    "title": "ყოველი ჩვენება ჩანაწერშია.",
    "lede": "ეკრანები ყოველ ჩვენებას დროსა და GPS მდებარეობასთან ერთად აფიქსირებს. **ადევნეთ თვალი კამპანიას რუკაზე** და ნახეთ აღრიცხული ჩვენებები თქვენს ანგარიშში.",
    "live": "პირდაპირ",
    "logTitle": "ჩვენებების ჟურნალი",
    "recent": "ბოლო",
    "recorded": "აღრიცხული",
    "example": "მაგალითი"
  },
  "features": {
    "eyebrow": "შექმნილია ქუჩისთვის",
    "title": "ყველაფერი, რაც კამპანიას სჭირდება. ზედმეტის გარეშე.",
    "items": [
      {
        "title": "ორმხრივი",
        "body": "ორი ეკრანი ზურგით ერთმანეთზე. თქვენს რეკლამას ქუჩის ორივე მხარე ხედავს."
      },
      {
        "title": "ულტრაკაშკაშა ეკრანი",
        "body": "შექმნილია მკაფიო ხილვადობისთვის როგორც მზიან დღეს, ისე ღამით."
      },
      {
        "title": "შეცვალეთ ნებისმიერ დროს",
        "body": "ატვირთეთ ახალი ვიზუალი და დამტკიცების შემდეგ ეკრანები მასზე გადაერთვება. ხელახლა ბეჭდვა არ სჭირდება."
      },
      {
        "title": "მოწმდება ეთერამდე",
        "body": "ჩვენი გუნდი ყველა ვიზუალს ამოწმებს, სანამ ის ქუჩაში გავა."
      },
      {
        "title": "წინასწარი, გაზომილი",
        "body": "შეავსეთ ბალანსი და სურვილისამებრ დააწესეთ დღიური ლიმიტი. ანგარიშში ნახავთ აღრიცხულ ეთერსა და ხარჯს და მიიღებთ გაფრთხილებას ბალანსის შემცირებისას."
      },
      {
        "title": "ცოცხალი რუკა",
        "body": "ნახეთ, სად არის თქვენი რეკლამა ახლა და სად იყო აქამდე."
      }
    ]
  },
  "steps": {
    "eyebrow": "როგორ მუშაობს",
    "title": "გაიყვანეთ თქვენი კამპანია გზაზე.",
    "items": [
      {
        "title": "გამოგვიგზავნეთ ვიზუალი",
        "body": "ფართო სურათი ან მოკლე ვიდეო. ვიზუალის მოთხოვნებისთვის შექმენით ანგარიში ან მოგვმართეთ დიზაინში დახმარებისთვის."
      },
      {
        "title": "განსაზღვრეთ ბიუჯეტი",
        "body": "შეავსეთ ბალანსი და სურვილისამებრ დააწესეთ ხარჯვის დღიური ლიმიტი. ჩვენი გუნდი შეამოწმებს რეკლამას და ეკრანებზე განათავსებს."
      },
      {
        "title": "გადით ეთერში და ადევნეთ თვალი",
        "body": "თქვენი რეკლამა ციკლს უერთდება. ჩვენებებს, ლოკაციებსა და ხარჯს დაფიდან აკონტროლებთ."
      }
    ]
  },
  "pricing": {
    "eyebrow": "კამპანიის ბიუჯეტი",
    "title": "ბიუჯეტი, რომელიც თქვენ გერგებათ.",
    "lede": "შეავსეთ ბალანსი და გადაიხადეთ აღრიცხული ეთერის მიხედვით. ფასი დამოკიდებულია ვიზუალზე და იმაზე, სად და როდის მოძრაობენ ტაქსები. **დეტალებისა და კალკულატორებისთვის შედით თქვენს ანგარიშში** ან მოგვწერეთ კამპანიის დასაგეგმად.",
    "login": "შესვლა",
    "register": "რეგისტრაცია",
    "contact": "დაგვიკავშირდით"
  },
  "fleets": {
    "eyebrow": "ავტოპარკებისთვის",
    "title": "თქვენი მანქანები უკვე მთელ ქალაქს ფარავს. ახლა შემოსავალიც მოიტანონ.",
    "items": [
      {
        "title": "მონტაჟი და მომსახურება ჩვენზეა",
        "body": "ეკრანებს ჩვენი გუნდი ამონტაჟებს და ემსახურება, ჩვენივე ხარჯით."
      },
      {
        "title": "წილი შემოსავლიდან",
        "body": "ავტოპარკი იღებს წილს სარეკლამო შემოსავლიდან, რომელსაც მისი მანქანები მოიტანს, პარტნიორობის ხელშეკრულებით განსაზღვრული პირობებით."
      },
      {
        "title": "ერთი დაფა",
        "body": "ნახეთ თითოეული მანქანა, ჩართულია თუ არა მისი ეკრანი და სად გავიდა რეკლამა."
      }
    ],
    "cta": "გახდით პარტნიორი"
  },
  "faq": {
    "eyebrow": "კითხვები",
    "title": "კითხვები და პასუხები.",
    "more": "კამპანიის დეტალები და კალკულატორები თქვენს ანგარიშშია.",
    "items": [
      {
        "q": "როგორ ითვლება კამპანიის ფასი?",
        "a": "ფასი დამოკიდებულია ვიზუალზე, აღრიცხულ ეთერზე და იმაზე, სად და როდის მოძრაობენ ტაქსები. ტარიფებისა და კალკულატორებისთვის შედით ანგარიშში ან დარეგისტრირდით. კამპანიის განსახილველად შეგიძლიათ დაგვიკავშირდეთ."
      },
      {
        "q": "საჭიროა გრძელვადიანი კონტრაქტი?",
        "a": "ავსებთ წინასწარ ბალანსს და სურვილისამებრ აწესებთ ხარჯვის დღიურ ლიმიტს. ბალანსის ამოწურვისას რეკლამა ჩერდება. თქვენი კამპანიის პირობებისთვის დაგვიკავშირდით."
      },
      {
        "q": "შემიძლია რეკლამის შეცვლა კამპანიის მსვლელობისას?",
        "a": "დიახ. ატვირთეთ ახალი ვიზუალი და ჩვენი გუნდის დამტკიცების შემდეგ ეკრანები მასზე გადაერთვება."
      },
      {
        "q": "საიდან გავიგო, რომ რეკლამა ნამდვილად გავიდა?",
        "a": "ყოველი ეკრანი ყოველ ჩვენებას დროსა და GPS მდებარეობასთან ერთად აგზავნის. ყველაფერს ნახავთ რუკაზე და კამპანიის ჟურნალში."
      },
      {
        "q": "როგორი უნდა იყოს ვიზუალი?",
        "a": "გამოიყენეთ ფართო სურათი ან მოკლე ვიდეო მსხვილი ტექსტით, ძლიერი კონტრასტითა და მკაფიო მესიჯით. ვიზუალის სრული მოთხოვნები ანგარიშშია ხელმისაწვდომი. დიზაინშიც დაგეხმარებით."
      },
      {
        "q": "როგორ ჩნდება რეკლამა ეკრანზე?",
        "a": "ეკრანებზე დამტკიცებული კამპანიები მონაცვლეობით გადის და თქვენი რეკლამა მგზავრობისას მეორდება. ეთერის მუშაობისა და ბიუჯეტის შესაფასებლად შედით ანგარიშში ან დარეგისტრირდით."
      },
      {
        "q": "ტაქსების პარკი მაქვს. როგორ შევუერთდეთ?",
        "a": "დარეგისტრირდით ავტოპარკის პარტნიორად და დაგიკავშირდებით პირობების შესათანხმებლად და მონტაჟის დასაგეგმად."
      }
    ]
  },
  "closing": {
    "title": "თქვენი ბრენდი — გზაზე.",
    "lede": "მოგვწერეთ, რას არეკლამებთ და რა ბიუჯეტით. კამპანიის დაგეგმვაში დაგეხმარებით.",
    "email": "მოგვწერეთ",
    "call": "დაგვირეკეთ",
    "hours": "ორშ – შაბ, 10:00 – 19:00"
  },
  "footer": {
    "tagline": "LED რეკლამა ტაქსებზე, თბილისში.",
    "product": "პროდუქტი",
    "partners": "პარტნიორები",
    "legal": "იურიდიული",
    "fleetSignup": "ავტოპარკის რეგისტრაცია",
    "privacy": "კონფიდენციალურობა",
    "terms": "წესები და პირობები",
    "rights": "© 2026 შპს „გზადვერთაისმენთ“. ყველა უფლება დაცულია."
  }
}

export const copy: Record<Lang, Copy> = { en, ge }

export const CONTACT = {
  "email": "info@gzadvertisement.ge",
  "phone": "+995 591 410 914",
  "phoneHref": "tel:+995591410914"
}
