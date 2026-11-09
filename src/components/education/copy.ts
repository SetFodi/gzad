// Shared pricing calculator and client guide copy.
const en = {
  "pricing": {
    "eyebrow": "Pricing",
    "title": "Top up once. Pay as you play.",
    "lede": "Add funds to your balance. Your airtime is metered in 10-minute blocks, each priced by **your ad length, the district the car is in and the time of day,** and charged only for what actually played. Your balance updates every 15 minutes, and you can set a daily cap.",
    "sim": {
      "balance": "Balance",
      "deducted": "Deducted",
      "lowAlert": "Low-balance alert",
      "nextUpdate": "Next balance update in",
      "min": "min",
      "metered": "metered since the last update",
      "topUp": "Top up",
      "play": "Play",
      "pause": "Pause",
      "adLength": "Ad length",
      "cap": "Daily cap",
      "noCap": "No cap",
      "today": "Spent today",
      "capReached": "Daily cap reached. Ads pause until midnight.",
      "now": "Right now",
      "perHour": "per hour",
      "perBlock": "per 10-minute block",
      "taxiOff": "Taxi off: nothing is charged",
      "usage": "Metered in 10-minute blocks",
      "off": "Off",
      "capped": "Cap",
      "empty": "Balance used up. Ads paused until you top up.",
      "note": "An illustration using current rates for one screen. This does not change your actual balance or campaign.",
      "customTopUp": "Custom amount",
      "useAmount": "Use amount",
      "amountAria": "Custom top-up in lari",
      "invalidAmount": "Enter an amount from ₾0.01 to ₾100,000, with up to two decimal places.",
      "emptyShort": "Balance depleted"
    },
    "tiers": {
      "1": "Prime",
      "2": "Busy",
      "3": "Popular",
      "4": "Standard"
    },
    "bands": {
      "night": "Night",
      "day": "Daytime",
      "evening": "Evening",
      "rush": "Rush hour"
    },
    "calc": {
      "title": "What does your budget buy?",
      "lede": "Explore an estimated range for your budget. Coverage follows the taxis’ actual routes.",
      "budget": "Budget",
      "budgetAria": "Budget in lari",
      "when": "When",
      "any": "Any time",
      "screens": "Screens",
      "plays": "plays of your ad",
      "hours": "{min}–{max} hours on air",
      "perScreen": "about {min}–{max} h on each of {n} screens",
      "perPlay": "₾{min}–{max} per play",
      "range": "The range uses current district rates and the average hourly rate for the selected time band. Actual delivery depends on the taxis’ trips and recorded plays.",
      "assumption": "Assumes the other four slots in the loop are 10-second ads, so a {seconds}-second ad plays about {plays} times an hour. Your exact rates are confirmed when you book."
    },
    "cta": "Get a quote"
  },
  "loop": {
    "seconds": "s"
  },
  "where": {
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
  "guide": {
    "title": "Campaign guide & calculators",
    "welcome": "Welcome to Gzad",
    "lede": "Learn how a campaign works, then try your own budget before launching.",
    "introTab": "How it works",
    "toolsTab": "Calculators",
    "tryTools": "Try the calculators",
    "continue": "Continue to your dashboard",
    "simulation": "Practice mode. These examples never deduct money from your account.",
    "introTitle": "From your creative to the street.",
    "introItems": [
      {
        "title": "Prepare your ad",
        "body": "Upload a wide image or short video. Our team reviews the creative and assigns the campaign to screens."
      },
      {
        "title": "Fund your balance",
        "body": "Choose your budget and optional daily limit. Charges follow recorded airtime, the taxi’s location and the time of day."
      },
      {
        "title": "Follow the campaign",
        "body": "Taxis follow their normal routes. Your dashboard shows the recorded plays, locations and spend."
      }
    ],
    "welcomeCardTitle": "Get to know your campaign tools",
    "welcomeCardBody": "Explore how airtime works and try a budget before submitting your first ad.",
    "open": "Open the guide",
    "unavailable": "We could not load current pricing. Please try again later."
  }
}

export type CalculatorCopy = Omit<typeof en, 'where'> & { where: { districts: Record<string, string> } }

const ge: CalculatorCopy = {
  "pricing": {
    "eyebrow": "ფასები",
    "title": "შეავსეთ ბალანსი. იხდით მხოლოდ ეთერში.",
    "lede": "შეიტანეთ თანხა ბალანსზე. ეთერი იზომება 10-წუთიანი ბლოკებით: თითოეული ბლოკის ფასი დამოკიდებულია **რეკლამის ხანგრძლივობაზე, უბანზე, სადაც მანქანაა, და დღის დროზე,** და იხდით მხოლოდ იმას, რაც რეალურად გავიდა. ბალანსი ახლდება ყოველ 15 წუთში და შეგიძლიათ დააწესოთ დღიური ლიმიტიც.",
    "sim": {
      "balance": "ბალანსი",
      "deducted": "ჩამოიჭრა",
      "lowAlert": "გაფრთხილება დაბალ ბალანსზე",
      "nextUpdate": "ბალანსის შემდეგი განახლება",
      "min": "წთ-ში",
      "metered": "დაგროვდა ბოლო განახლების შემდეგ",
      "topUp": "შევსება",
      "play": "გაშვება",
      "pause": "პაუზა",
      "adLength": "რეკლამის ხანგრძლივობა",
      "cap": "დღიური ლიმიტი",
      "noCap": "ლიმიტის გარეშე",
      "today": "დღეს დაიხარჯა",
      "capReached": "დღიური ლიმიტი ამოიწურა. რეკლამა შუაღამემდე ჩერდება.",
      "now": "ახლა",
      "perHour": "საათში",
      "perBlock": "10-წუთიან ბლოკზე",
      "taxiOff": "ტაქსი გამორთულია: არაფერი ირიცხება",
      "usage": "იზომება 10-წუთიანი ბლოკებით",
      "off": "გამორთ.",
      "capped": "ლიმიტი",
      "empty": "ბალანსი ამოიწურა. რეკლამა შეჩერებულია შევსებამდე.",
      "note": "ერთი ეკრანის მაგალითი მიმდინარე ტარიფებით. ეს თქვენი რეალური ბალანსის ან კამპანიის ცვლილებას არ იწვევს.",
      "customTopUp": "სხვა თანხა",
      "useAmount": "თანხის გამოყენება",
      "amountAria": "შევსების თანხა ლარში",
      "invalidAmount": "შეიყვანეთ თანხა ₾0.01-დან ₾100,000-მდე, მაქსიმუმ ორი ათწილადი ნიშნით.",
      "emptyShort": "ბალანსი ამოიწურა"
    },
    "tiers": {
      "1": "პრემიუმი",
      "2": "დატვირთული",
      "3": "პოპულარული",
      "4": "სტანდარტული"
    },
    "bands": {
      "night": "ღამე",
      "day": "დღე",
      "evening": "საღამო",
      "rush": "პიკის საათი"
    },
    "calc": {
      "title": "რას იყიდით თქვენი ბიუჯეტით?",
      "lede": "ნახეთ თქვენი ბიუჯეტის საორიენტაციო შედეგი. დაფარვა ტაქსების რეალურ მარშრუტებს მიჰყვება.",
      "budget": "ბიუჯეტი",
      "budgetAria": "ბიუჯეტი ლარში",
      "when": "როდის",
      "any": "ნებისმიერ დროს",
      "screens": "ეკრანები",
      "plays": "თქვენი რეკლამის ჩვენება",
      "hours": "ეთერში {min}–{max} საათი",
      "perScreen": "დაახლ. {min}–{max} სთ თითოეულ {n} ეკრანზე",
      "perPlay": "ერთი ჩვენება ₾{min}–{max}",
      "range": "დიაპაზონი ითვლება უბნების მიმდინარე ტარიფებითა და არჩეული დროის მონაკვეთის საშუალო საათობრივი ტარიფით. რეალური შედეგი ტაქსების მგზავრობებსა და აღრიცხულ ჩვენებებზეა დამოკიდებული.",
      "assumption": "ვთვლით, რომ ციკლის დანარჩენი ოთხი სლოტი 10-წამიანი რეკლამაა, ასე რომ {seconds}-წამიანი რეკლამა საათში დაახლოებით {plays}-ჯერ გადის. ზუსტ ტარიფებს დაჯავშნისას დაგიდასტურებთ."
    },
    "cta": "ფასის მოთხოვნა"
  },
  "loop": {
    "seconds": "წმ"
  },
  "where": {
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
  "guide": {
    "title": "კამპანიის გზამკვლევი და კალკულატორები",
    "welcome": "კეთილი იყოს თქვენი მობრძანება გზადში",
    "lede": "გაეცანით კამპანიის მუშაობას და გაშვებამდე სცადეთ თქვენი ბიუჯეტი.",
    "introTab": "როგორ მუშაობს",
    "toolsTab": "კალკულატორები",
    "tryTools": "კალკულატორების გამოყენება",
    "continue": "პანელზე გადასვლა",
    "simulation": "სავარჯიშო რეჟიმი. ეს მაგალითები თქვენი ანგარიშიდან თანხას არ ჩამოჭრის.",
    "introTitle": "თქვენი ვიზუალიდან ქალაქის ქუჩებამდე.",
    "introItems": [
      {
        "title": "მოამზადეთ რეკლამა",
        "body": "ატვირთეთ ფართო ფორმატის სურათი ან მოკლე ვიდეო. ჩვენი გუნდი მას შეამოწმებს და კამპანიას ეკრანებზე განათავსებს."
      },
      {
        "title": "შეავსეთ ბალანსი",
        "body": "განსაზღვრეთ ბიუჯეტი და სურვილისამებრ დღიური ლიმიტი. ხარჯი დამოკიდებულია აღრიცხულ ეთერზე, ტაქსის მდებარეობასა და დღის დროზე."
      },
      {
        "title": "ადევნეთ თვალი კამპანიას",
        "body": "ტაქსები ჩვეულ მარშრუტებს მიჰყვებიან. პანელზე ნახავთ ჩვენებებს, ლოკაციებსა და ხარჯს."
      }
    ],
    "welcomeCardTitle": "გაეცანით კამპანიის ხელსაწყოებს",
    "welcomeCardBody": "გაიგეთ, როგორ ითვლება ეთერი და პირველი რეკლამის ატვირთვამდე სცადეთ თქვენი ბიუჯეტი.",
    "open": "გზამკვლევის გახსნა",
    "unavailable": "მიმდინარე ტარიფების ჩატვირთვა ვერ მოხერხდა. სცადეთ მოგვიანებით."
  }
}

export const calculatorCopy = { en, ge }
