// The operating facts are documented in docs/legal-content-notes.md.
export const LEGAL_EMAIL = 'info@gzadvertisement.ge'
export const LEGAL_UPDATED = '2026-11-10'
export type LegalKind = 'privacy' | 'terms'
export type LegalLang = 'en' | 'ge'
export interface LegalSectionContent { id: string; heading: string; paragraphs: string[]; bullets?: string[] }
export interface LegalDocumentContent { title: string; eyebrow: string; summary: string; intro: string[]; sections: LegalSectionContent[] }
export interface LegalLabels { home: string; back: string; login: string; skip: string; updated: string; contents: string; showContents: string; hideContents: string; contact: string; email: string; legal: string; privacy: string; terms: string; date: string; language: string }
export const legalLabels: Record<LegalLang, LegalLabels> = {
  "en": {
    "home": "Gzad home",
    "back": "Back to Gzad",
    "login": "Log in",
    "skip": "Skip to content",
    "updated": "Last updated",
    "contents": "On this page",
    "showContents": "Show sections",
    "hideContents": "Hide sections",
    "contact": "Questions about this page?",
    "email": "Email our team",
    "legal": "Legal documents",
    "privacy": "Privacy policy",
    "terms": "Terms of service",
    "date": "10 November 2026",
    "language": "Language"
  },
  "ge": {
    "home": "Gzad-ის მთავარი გვერდი",
    "back": "Gzad-ის მთავარ გვერდზე",
    "login": "შესვლა",
    "skip": "შინაარსზე გადასვლა",
    "updated": "ბოლო განახლება",
    "contents": "ამ გვერდზე",
    "showContents": "სექციების ჩვენება",
    "hideContents": "სექციების დამალვა",
    "contact": "გაქვთ კითხვა ამ გვერდის შესახებ?",
    "email": "მოგვწერეთ",
    "legal": "სამართლებრივი დოკუმენტები",
    "privacy": "კონფიდენციალურობის პოლიტიკა",
    "terms": "მომსახურების პირობები",
    "date": "2026 წლის 10 ნოემბერი",
    "language": "ენა"
  }
}

export const legalDocuments: Record<LegalLang, Record<LegalKind, LegalDocumentContent>> = {
  "en": {
    "privacy": {
      "title": "Privacy policy",
      "eyebrow": "Your data at Gzad",
      "summary": "What we collect, how vehicle location and campaign records are used, and how to contact us about your data.",
      "intro": [
        "This policy covers the Gzad website, advertiser and fleet accounts, campaign delivery, and the connected advertising screens on partner vehicles. It applies to account holders, company contacts and drivers whose information is processed through the service."
      ],
      "sections": [
        {
          "id": "operator",
          "heading": "Who is responsible",
          "paragraphs": [
            "Gzad is operated by **Gzadvertisement LLC**, a company registered in Georgia, identification number **400469239**. Our registered address is **7 Evgeni Kharadze Street, Tbilisi, Georgia**.",
            "Gzadvertisement LLC is responsible for the processing described here. For privacy questions, requests or concerns, contact [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge)."
          ]
        },
        {
          "id": "information",
          "heading": "Information we collect",
          "paragraphs": [
            "We collect information that you provide, information generated when you use the service, and reports sent by connected screens.",
            "You can browse public pages without an account. Required registration and campaign information is needed to provide the relevant service; optional fields are marked in the form."
          ],
          "bullets": [
            "**Accounts and contacts.** Your name, email address, phone number, company name, account role, and correspondence with our team. Authentication services also process the credentials and verification information needed for sign-in.",
            "**Campaigns and creative.** Campaign names, dates, settings, uploaded images and videos, review decisions, and the information contained in your creative.",
            "**Vehicles and screens.** Fleet account details, vehicle make, model, year, colour, registration plate, and the identifier of the screen assigned to a vehicle.",
            "**Location and playback.** GPS coordinates, reported speed, timestamps, screen identifiers, and records of which ad played, when, where and for how long.",
            "**Payments and billing.** Payment confirmations and correspondence, balance movements, billing periods, rates, daily spending limits, and transaction and campaign records. The current website does not collect payment-card details.",
            "**Technical and security information.** Connection and device information, IP addresses and browser details in service or hosting logs, authentication events, and records of account activity. Where remembered-browser verification is enabled, it uses a browser token and derived IP/browser checks."
          ]
        },
        {
          "id": "purposes",
          "heading": "Why we use information",
          "paragraphs": [
            "We use this information to create and administer accounts; review and deliver advertising; manage vehicles and screens; calculate and explain charges; prepare campaign reports; answer requests; and send account, verification and billing communications.",
            "We also use relevant records to diagnose faults, prevent unauthorised access or manipulated playback reports, resolve disputes, and meet legal and accounting obligations.",
            "The legal basis depends on the purpose: taking steps towards or performing a contract, complying with legal duties, or pursuing a legitimate interest such as security and accurate billing where your rights do not override it. Where processing requires consent, we seek it separately. Accepting service terms does not replace a consent that the law requires.",
            "Charge calculations and balance-based campaign pauses can be automated using recorded delivery and the applicable rates and limits. Our team reviews advertising creative. You can ask our team to review a disputed charge, pause or access issue by emailing [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge)."
          ]
        },
        {
          "id": "vehicle-location",
          "heading": "Vehicle location and driver information",
          "paragraphs": [
            "Screens send location and playback reports while connected and operating. These reports can reveal a vehicle’s route and movements. A screen may be linked to a fleet account and registration plate, so its location history can relate to identifiable drivers even if a driver has no Gzad account.",
            "We use vehicle location to operate the network, show where campaigns played, apply location-dependent pricing, and investigate delivery or device issues. Playback records describe screen activity; they are not a count of identifiable people who saw an ad.",
            "Fleet partners must tell drivers about the installed screen, the information it reports, and the uses described in this policy. They must have an appropriate basis for sharing driver-related information and meet their own obligations as employers or fleet operators. A partner’s agreement alone does not establish consent on behalf of every driver.",
            "Drivers can contact [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge) directly about records relating to them. A vehicle plate or screen identifier and the relevant dates can help us locate those records."
          ]
        },
        {
          "id": "access",
          "heading": "Who can access information",
          "paragraphs": [
            "Advertisers can access information about their own campaigns, including playback locations, times, costs and screen-related records. Fleet partners can access their own registered vehicles, assigned screens and related operating reports. These access rules do not make route or screen records anonymous.",
            "Driver names and private contact details are not part of the standard advertiser campaign report. Gzad staff and authorised service providers access information as needed to administer, support and secure the service. We may disclose relevant records to professional advisers, competent authorities or other recipients where necessary and lawfully justified."
          ]
        },
        {
          "id": "providers",
          "heading": "Service providers and international processing",
          "paragraphs": [
            "We use **Supabase** for account authentication, database and advertising-media storage, and **Vercel** for application hosting. Connected screen controllers and our realtime infrastructure transmit device, playback and location reports. Email providers used for account or billing messages process the recipient address and message content.",
            "Interactive maps request map tiles and related assets from third-party services, including OpenStreetMap. Those services receive connection information, such as your IP address, when your browser loads their resources.",
            "Some providers process information outside Georgia. International processing must have a lawful basis and appropriate protections under applicable law. Contact [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge) for information about the providers, destinations and safeguards relevant to your data. We do not sell personal data."
          ]
        },
        {
          "id": "public-media",
          "heading": "Advertising media is publicly accessible",
          "paragraphs": [
            "Advertising is intended for public display. Uploaded creative is stored at publicly readable media addresses so screens can retrieve it; anyone with a valid media link may be able to view it. An account login does not make uploaded ad files confidential.",
            "Upload only content you are entitled to publish. Avoid private documents, unnecessary personal details and sensitive information. A removal request cannot retrieve copies that others have already downloaded or recorded."
          ]
        },
        {
          "id": "cookies",
          "heading": "Cookies and browser storage",
          "paragraphs": [
            "We use authentication cookies for sign-in and session continuity. Where email-code verification is enabled, a short-lived verification cookie supports that process and a remembered-browser cookie can remain for up to **180 days**. Signing out does not necessarily remove the remembered-browser cookie.",
            "Browser storage remembers your language and colour theme. A temporary session-storage value can keep track of the new-client introduction. Preferences remain until replaced or cleared; temporary session values end with the browser session.",
            "We do not currently use third-party advertising trackers on these pages. You can clear or restrict cookies and local storage through your browser. Restricting essential cookies may prevent sign-in or require verification again. If optional tracking is introduced, we will provide the relevant information and choices."
          ]
        },
        {
          "id": "retention",
          "heading": "How long information is kept",
          "paragraphs": [
            "Retention depends on the purpose of the record and applicable obligations, rather than one period for every data category."
          ],
          "bullets": [
            "**Account and contact records** are kept while needed to manage the relationship, then reviewed for removal or limitation, subject to outstanding obligations and claims.",
            "**Detailed location, playback and security records** are kept as needed to verify delivery, reconcile charges, investigate issues and protect the service. Summary records may be retained separately after detailed records are removed.",
            "**Financial, contractual and dispute records** may need to remain after account closure for legal, accounting or evidential purposes.",
            "**Advertising media** is kept while needed for campaign operation and support. Contact us to request removal after use ends. Residual copies may remain for a limited period in provider backups or caches."
          ]
        },
        {
          "id": "requests",
          "heading": "Your rights and requests",
          "paragraphs": [
            "You may ask to access or correct your data, obtain a copy, or request deletion, restriction or portability where applicable. You may also object to processing or withdraw a consent where the law permits. Contact [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge); rights are subject to legal conditions.",
            "Tell us which account, campaign, vehicle or period your request concerns. We may ask for proportionate identity or authority checks before releasing or changing records. We respond within the applicable legal deadlines and explain any refusal, restriction or permitted extension.",
            "Closing an account does not automatically erase records that must be retained. Withdrawing consent does not undo processing already carried out lawfully; we will explain if it affects an optional feature."
          ]
        },
        {
          "id": "security",
          "heading": "Security and account responsibility",
          "paragraphs": [
            "We use authentication, role-based access and other technical and organisational measures to protect information. No internet service can guarantee complete security. Keep your credentials private and report suspected account compromise or data exposure promptly to [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge).",
            "Please do not send passwords or authentication codes by email. We may retain limited incident records to investigate an issue and protect affected accounts."
          ]
        },
        {
          "id": "children",
          "heading": "Children",
          "paragraphs": [
            "Gzad’s advertiser and fleet services are intended for adults acting in a business or professional capacity. If you believe a child has provided personal information through the service, contact us so we can assess and address it."
          ]
        },
        {
          "id": "complaints",
          "heading": "Questions and complaints",
          "paragraphs": [
            "You can raise a privacy concern with [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). You may also complain to the **State Audit Office of Georgia**, the competent data-protection supervisory authority, or seek a remedy before a competent court. Contacting us first does not remove those rights.",
            "The applicable framework is [Georgia’s Law on Personal Data Protection](https://www.matsne.gov.ge/en/document/view/5827307)."
          ]
        },
        {
          "id": "changes",
          "heading": "Changes to this policy",
          "paragraphs": [
            "We update this policy when the service or our practices change and show the revised date above. We will communicate material changes through an appropriate account or contact channel. A policy update does not itself authorise a new use that requires a separate legal basis or consent."
          ]
        }
      ]
    },
    "terms": {
      "title": "Terms of service",
      "eyebrow": "Using Gzad",
      "summary": "The terms for advertiser accounts, campaign delivery, prepaid balances and fleet participation.",
      "intro": [
        "These terms apply to use of Gzad’s website and advertiser and fleet services. Please read them with our [Privacy Policy](/privacy) and any campaign order or fleet agreement you enter into with us."
      ],
      "sections": [
        {
          "id": "operator",
          "heading": "Operator and contact",
          "paragraphs": [
            "Gzad is operated by **Gzadvertisement LLC**, registered in Georgia, identification number **400469239**, with its registered address at **7 Evgeni Kharadze Street, Tbilisi, Georgia**.",
            "For campaign, billing, account or contractual questions, write to [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). Our contact telephone is **+995 591 410 914**."
          ]
        },
        {
          "id": "agreement",
          "heading": "When these terms apply",
          "paragraphs": [
            "By creating an account or ordering or using the service, you agree to these terms. You must be at least 18 and have authority to enter the relevant arrangement. If you act for a company or fleet, you confirm that you can bind it.",
            "The service is intended for business advertising and fleet operations. A separate written campaign confirmation or partnership agreement governs its specific commercial terms and prevails over these general terms where they conflict. Mandatory legal rights always take priority."
          ]
        },
        {
          "id": "accounts",
          "heading": "Accounts and security",
          "paragraphs": [
            "Provide accurate account, company and contact information and keep it current. Use your own authorised account, protect your password and verification codes, and tell us promptly at [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge) if you suspect unauthorised use.",
            "You are responsible for instructions and uploads made by you or people you authorise, subject to applicable law. Do not impersonate another person, bypass access controls, share access without authority, scrape private records, upload malicious code or interfere with screens, reporting or billing."
          ]
        },
        {
          "id": "creative",
          "heading": "Creative, rights and review",
          "paragraphs": [
            "You are responsible for the accuracy, legality and permissions for your advertisements, including copyrights, trademarks, music, images and appearances of people. You must hold the rights needed for Gzad and its operational providers to store, adapt technically and display the creative for your campaign.",
            "We review creative before it is approved for display and may request changes, refuse it or remove it for legal, technical or safety reasons. Do not submit unlawful, fraudulent, misleading or rights-infringing material, or content unsuitable for display to people in traffic. Approval is not legal clearance and does not transfer your responsibilities to Gzad.",
            "You retain ownership of your creative. The permission you grant is limited to operating and delivering the service, including formatting, distributing files to screens and keeping records needed for support and billing. Use in unrelated promotional material requires separate permission."
          ]
        },
        {
          "id": "delivery",
          "heading": "Screen allocation, routes and delivery",
          "paragraphs": [
            "Our team assigns approved campaigns to available screens. Screens share their playback rotation between campaigns; multiple files within a campaign may alternate. Unless we expressly agree otherwise in writing, you do not select a particular taxi, district, route, individual screen or exact playback moment.",
            "Vehicles follow their normal journeys. Actual coverage and playback depend on vehicle activity, approved media, dates, screen availability, connectivity and technical conditions. Location maps and play logs describe recorded delivery, not a guarantee of future coverage.",
            "We do not promise a minimum audience, number of sales, return on advertising, geographic reach or uninterrupted airtime unless a specific written commitment says so. Website examples and calculators are estimates, not binding offers or guaranteed results."
          ]
        },
        {
          "id": "pricing",
          "heading": "Rates and billing",
          "paragraphs": [
            "The campaign’s confirmed rates and billing unit determine its charges. Pricing can depend on the ad’s duration, the screen’s location and the time of day. Payment and tax treatment, and any separate production or setup charges, are confirmed with the campaign arrangements.",
            "The service supports whole-hour billing and, where agreed and enabled, metered billing blocks. A whole-hour unit may be charged once when qualifying playback occurs in that period; a metered unit uses the recorded share of its billing block. The billing arrangement confirmed for your campaign applies.",
            "Playback and device records support billing and may arrive or be reconciled after display. Balance updates are not necessarily immediate. We can correct missing, duplicated or erroneous records and explain the resulting adjustment. Rate changes apply to future delivery after they are communicated, subject to any fixed terms already agreed."
          ]
        },
        {
          "id": "balance",
          "heading": "Prepaid balances and limits",
          "paragraphs": [
            "Advertising uses a prepaid balance. Funds become available after Gzad receives and records the agreed payment or credit. A calculator, top-up example or selected amount on a demonstration does not make a payment or increase your actual account balance.",
            "Campaigns may pause when funds are exhausted or a relevant daily limit is reached. Charges already incurred, including records awaiting reconciliation, remain payable. Adding funds does not bypass creative review, campaign dates, screen allocation or technical availability.",
            "You can request that a campaign be paused or ended through the available account controls or by contacting our team. Allow for processing and screen synchronisation; stopping a campaign does not cancel charges for delivery that already occurred."
          ]
        },
        {
          "id": "refunds",
          "heading": "Billing questions and unused funds",
          "paragraphs": [
            "If you question a charge, contact [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge) with the relevant account, campaign, dates and the issue you want us to investigate. We review the delivery and payment records and correct established billing errors.",
            "Contact us before closing an account or requesting return of unused funds. Refund eligibility, cancellation charges and the handling of unused credit depend on your confirmed commercial terms and applicable law. No automatic cash withdrawal or refund facility is promised by a demonstration or balance display.",
            "Nothing in these terms removes a mandatory consumer, cancellation or refund right. If consumer-protection rules apply to your transaction, those rules take priority over inconsistent commercial terms."
          ]
        },
        {
          "id": "fleets",
          "heading": "Fleet partnerships",
          "paragraphs": [
            "Fleet participation requires agreed vehicle and equipment arrangements. The partnership agreement sets screen ownership, installation, maintenance and removal responsibilities, the revenue-share calculation, eligible revenue, payment timing and any operating requirements. Illustrative fleet earnings are not guaranteed payments.",
            "Fleet partners must have authority to provide the vehicle and necessary permissions for installation and operation. Keep vehicle information accurate, operate lawfully and cooperate with agreed access for servicing. Do not tamper with equipment, obstruct approved advertising or manipulate location or playback reporting.",
            "Fleet partners must inform drivers about location and playback reporting, have an appropriate basis for sharing relevant personal information, and meet their own obligations to drivers. Gzad’s use of personal data is described in the [Privacy Policy](/privacy)."
          ]
        },
        {
          "id": "public-files",
          "heading": "Public creative and confidential information",
          "paragraphs": [
            "Ads are meant for public display and media files may be available through public download links. Do not upload confidential documents or personal data you are not entitled to make public.",
            "Private campaign, account, fleet and technical records obtained through the service may be used only for authorised service purposes. Do not disclose another party’s private information or attempt to identify drivers from route reports for an unrelated purpose."
          ]
        },
        {
          "id": "interruptions",
          "heading": "Availability and reporting issues",
          "paragraphs": [
            "Maintenance, mobile-network coverage, power, hardware faults, vehicle availability and events outside reasonable control can interrupt the service. We may pause affected delivery to protect people, equipment, accounts or the network.",
            "Tell us about missing delivery or incorrect reports so we can investigate. Any billing correction or other remedy will reflect the confirmed service arrangements, the available records and your rights under applicable law. A connection or dashboard status alone is not proof that every ad was displayed."
          ]
        },
        {
          "id": "suspension",
          "heading": "Suspension and ending service",
          "paragraphs": [
            "You may ask to close an account or end a campaign by contacting [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge), subject to existing commitments and accrued charges. We may restrict or suspend access for unlawful use, security threats, manipulated records, unpaid amounts or material breach of these terms.",
            "Where practical and appropriate, we will explain the issue and give an opportunity to address it. Immediate action may be necessary for safety, security or legal reasons. Closing an account does not remove accrued obligations or require deletion of legally necessary records. Fleet equipment handover follows the partnership agreement."
          ]
        },
        {
          "id": "responsibility",
          "heading": "Responsibility and legal protections",
          "paragraphs": [
            "Each party is responsible for its own obligations under the applicable agreement and law. Advertising outcomes and calculator projections do not establish a guaranteed commercial result.",
            "Any limitation of responsibility in a separate commercial agreement applies only to the extent permitted by law. These terms do not exclude liability or remedies that cannot lawfully be excluded, and do not prevent either party from seeking a remedy for a breach."
          ]
        },
        {
          "id": "law",
          "heading": "Governing law and disputes",
          "paragraphs": [
            "These terms are governed by the laws of Georgia. Contact [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge) first if you would like us to investigate an account, campaign or contractual concern. This does not prevent you from using any legal complaint or dispute-resolution route.",
            "Unresolved disputes may be brought before a competent court in accordance with applicable law. Any mandatory jurisdiction or consumer protections continue to apply."
          ]
        },
        {
          "id": "changes",
          "heading": "Updates to these terms",
          "paragraphs": [
            "We may revise these terms as the service changes and will update the date above. We will communicate material changes to affected account holders before they apply, using an appropriate account or contact channel. Where fresh acceptance is required, we will request it.",
            "Changes do not rewrite already delivered services or override specific fixed terms without an applicable contractual or legal basis. If you do not agree to a material change, contact us about ending future use and settling the existing relationship."
          ]
        }
      ]
    }
  },
  "ge": {
    "privacy": {
      "title": "კონფიდენციალურობის პოლიტიკა",
      "eyebrow": "თქვენი მონაცემები Gzad-ში",
      "summary": "რა მონაცემებს ვაგროვებთ, როგორ ვიყენებთ ავტომობილის მდებარეობასა და კამპანიის ჩანაწერებს და როგორ დაგვიკავშირდეთ თქვენს მონაცემებთან დაკავშირებით.",
      "intro": [
        "ეს პოლიტიკა ვრცელდება Gzad-ის ვებგვერდზე, რეკლამის განმთავსებლებისა და ავტოპარკების ანგარიშებზე, კამპანიების გაშვებასა და პარტნიორ ავტომობილებზე დამონტაჟებულ სარეკლამო ეკრანებზე. ის ეხება ანგარიშის მფლობელებს, კომპანიების საკონტაქტო პირებსა და მძღოლებს, რომელთა მონაცემებიც მომსახურების ფარგლებში მუშავდება."
      ],
      "sections": [
        {
          "id": "operator",
          "heading": "ვინ არის პასუხისმგებელი",
          "paragraphs": [
            "Gzad-ის ოპერატორია საქართველოში რეგისტრირებული **შპს „გზადვერთაისმენთ“**, საიდენტიფიკაციო კოდი **400469239**. იურიდიული მისამართია **საქართველო, თბილისი, ევგენი ხარაძის ქუჩა №7**.",
            "ამ პოლიტიკაში აღწერილ დამუშავებაზე პასუხისმგებელია შპს „გზადვერთაისმენთ“. მონაცემების შესახებ კითხვების, მოთხოვნებისა და საჩივრებისთვის მოგვწერეთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge)."
          ]
        },
        {
          "id": "information",
          "heading": "რა ინფორმაციას ვაგროვებთ",
          "paragraphs": [
            "ვაგროვებთ თქვენს მიერ მოწოდებულ ინფორმაციას, მომსახურების გამოყენებისას წარმოქმნილ მონაცემებსა და ეკრანებიდან გამოგზავნილ ჩანაწერებს.",
            "საჯარო გვერდების დათვალიერება ანგარიშის გარეშე შეგიძლიათ. სავალდებულო სარეგისტრაციო და კამპანიის მონაცემები საჭიროა შესაბამისი მომსახურების გასაწევად; არჩევითი ველები ფორმაში მონიშნულია."
          ],
          "bullets": [
            "**ანგარიში და საკონტაქტო ინფორმაცია.** სახელი, ელფოსტა, ტელეფონი, კომპანიის დასახელება, ანგარიშის როლი და ჩვენს გუნდთან მიმოწერა. ავტორიზაციის სერვისი ასევე ამუშავებს შესვლისთვის საჭირო პაროლსა და გადამოწმების ინფორმაციას.",
            "**კამპანიები და ვიზუალები.** კამპანიის დასახელება, თარიღები, პარამეტრები, ატვირთული სურათები და ვიდეოები, განხილვის შედეგები და ვიზუალში მოცემული ინფორმაცია.",
            "**ავტომობილები და ეკრანები.** ავტოპარკის ანგარიშის მონაცემები, ავტომობილის მარკა, მოდელი, წელი, ფერი, სახელმწიფო ნომერი და მასზე მინიჭებული ეკრანის იდენტიფიკატორი.",
            "**მდებარეობა და ჩვენებები.** GPS კოორდინატები, გადმოცემული სიჩქარე, დრო, ეკრანის იდენტიფიკატორი და ჩანაწერები იმის შესახებ, რომელი რეკლამა, როდის, სად და რა ხანგრძლივობით გავიდა.",
            "**გადახდები და დარიცხვები.** გადახდის დადასტურება და შესაბამისი მიმოწერა, ბალანსის მოძრაობა, დარიცხვის პერიოდები, ტარიფები, დღიური ლიმიტები და ტრანზაქციებისა და კამპანიების ჩანაწერები. არსებული ვებგვერდი საბანკო ბარათის მონაცემებს არ აგროვებს.",
            "**ტექნიკური და უსაფრთხოების ინფორმაცია.** კავშირის და მოწყობილობის ინფორმაცია, სერვისის ან ჰოსტინგის ჟურნალებში მოხვედრილი IP მისამართები და ბრაუზერის მონაცემები, ავტორიზაციისა და ანგარიშის მოქმედებების ჩანაწერები. დამახსოვრებული ბრაუზერის გადამოწმების ფუნქცია, როცა ჩართულია, იყენებს ბრაუზერის ტოკენსა და IP-ისა და ბრაუზერის მონაცემების საფუძველზე მიღებულ შემოწმების მნიშვნელობებს."
          ]
        },
        {
          "id": "purposes",
          "heading": "რისთვის ვიყენებთ მონაცემებს",
          "paragraphs": [
            "მონაცემებს ვიყენებთ ანგარიშების შესაქმნელად და სამართავად, რეკლამის შესამოწმებლად და გასაშვებად, ავტომობილებისა და ეკრანების სამართავად, თანხის დასარიცხად და ასახსნელად, კამპანიის ანგარიშების მოსამზადებლად, მოთხოვნებზე საპასუხოდ და ავტორიზაციისა თუ ბილინგის შეტყობინებების გასაგზავნად.",
            "შესაბამისი ჩანაწერები ასევე გვჭირდება ხარვეზების მოსაძიებლად, უნებართვო წვდომისა და ჩვენებების გაყალბების თავიდან ასაცილებლად, დავების განსახილველად და სამართლებრივი თუ საბუღალტრო ვალდებულებების შესასრულებლად.",
            "სამართლებრივი საფუძველი დამოკიდებულია მიზანზე: ხელშეკრულების დადებამდე საჭირო მოქმედება ან მისი შესრულება, კანონით დაკისრებული ვალდებულება ან ისეთი კანონიერი ინტერესი, როგორიცაა უსაფრთხოება და სწორი დარიცხვა, თუ მას თქვენი უფლებები არ აღემატება. სადაც საჭიროა თანხმობა, მას ცალკე ვითხოვთ. მომსახურების პირობების მიღება კანონით მოთხოვნილ თანხმობას არ ანაცვლებს.",
            "თანხის დარიცხვა და ბალანსის საფუძველზე კამპანიის შეჩერება შეიძლება ავტომატურად შესრულდეს აღრიცხული ჩვენებების, შესაბამისი ტარიფებისა და ლიმიტების მიხედვით. ვიზუალს ჩვენი გუნდი ამოწმებს. სადავო დარიცხვის, შეჩერების ან წვდომის საკითხის თანამშრომლის მიერ განხილვა შეგიძლიათ მოითხოვოთ მისამართზე [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge)."
          ]
        },
        {
          "id": "vehicle-location",
          "heading": "ავტომობილის მდებარეობა და მძღოლები",
          "paragraphs": [
            "ეკრანები მუშაობისა და კავშირის არსებობისას აგზავნის მდებარეობისა და ჩვენებების ჩანაწერებს. ამ ჩანაწერებით შეიძლება გამოჩნდეს ავტომობილის მარშრუტი და გადაადგილება. ეკრანი შეიძლება უკავშირდებოდეს ავტოპარკის ანგარიშსა და სახელმწიფო ნომერს, ამიტომ მდებარეობის ისტორია შეიძლება ეხებოდეს იდენტიფიცირებად მძღოლსაც, რომელსაც Gzad-ის ანგარიში არ აქვს.",
            "მდებარეობას ვიყენებთ ქსელის სამუშაოდ, კამპანიის ჩვენების ადგილების ასახვისთვის, მდებარეობაზე დამოკიდებული ფასის გამოსათვლელად და ჩვენებისა თუ მოწყობილობის ხარვეზების გამოსაკვლევად. ჩვენების ჩანაწერი აღწერს ეკრანის მუშაობას და არ წარმოადგენს რეკლამის მნახველი იდენტიფიცირებადი ადამიანების რაოდენობას.",
            "ავტოპარკის პარტნიორმა მძღოლებს უნდა აცნობოს ეკრანის მონტაჟის, მის მიერ გამოგზავნილი ინფორმაციისა და ამ პოლიტიკაში აღწერილი გამოყენების შესახებ. მას უნდა ჰქონდეს მძღოლთან დაკავშირებული მონაცემების გაზიარების შესაბამისი საფუძველი და შეასრულოს დამსაქმებლისა თუ ავტოპარკის ოპერატორის ვალდებულებები. პარტნიორის ხელშეკრულება თითოეული მძღოლის სახელით თანხმობას არ ადგენს.",
            "მძღოლებს შეუძლიათ საკუთარ მონაცემებზე პირდაპირ მოგვწერონ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). ჩანაწერების მოძიებაში დაგვეხმარება ავტომობილის ნომერი ან ეკრანის იდენტიფიკატორი და შესაბამისი თარიღები."
          ]
        },
        {
          "id": "access",
          "heading": "ვის აქვს ინფორმაციაზე წვდომა",
          "paragraphs": [
            "რეკლამის განმთავსებელს აქვს წვდომა საკუთარი კამპანიის მონაცემებზე, მათ შორის ჩვენების ადგილებზე, დროზე, ხარჯსა და ეკრანთან დაკავშირებულ ჩანაწერებზე. ავტოპარკის პარტნიორს აქვს წვდომა საკუთარ რეგისტრირებულ ავტომობილებზე, მინიჭებულ ეკრანებსა და შესაბამის სამუშაო ანგარიშებზე. ასეთი წვდომის გამიჯვნა მარშრუტისა და ეკრანის ჩანაწერებს ანონიმურად არ აქცევს.",
            "მძღოლის სახელი და პირადი საკონტაქტო მონაცემები რეკლამის განმთავსებლის სტანდარტულ ანგარიშში არ შედის. Gzad-ის თანამშრომლებსა და უფლებამოსილ მომსახურების მომწოდებლებს ინფორმაციაზე წვდომა აქვთ მომსახურების მართვის, მხარდაჭერისა და უსაფრთხოებისთვის საჭირო ფარგლებში. აუცილებლობისა და სამართლებრივი საფუძვლის არსებობისას შესაბამისი ჩანაწერები შეიძლება გავუზიაროთ პროფესიულ მრჩევლებს, უფლებამოსილ ორგანოებს ან სხვა მიმღებებს."
          ]
        },
        {
          "id": "providers",
          "heading": "მომწოდებლები და საერთაშორისო დამუშავება",
          "paragraphs": [
            "**Supabase**-ს ვიყენებთ ანგარიშების ავტორიზაციისთვის, მონაცემთა ბაზისა და სარეკლამო ფაილების შესანახად, ხოლო **Vercel**-ს ვებაპლიკაციის ჰოსტინგისთვის. ეკრანის კონტროლერები და ჩვენი საკომუნიკაციო ინფრასტრუქტურა გადასცემს მოწყობილობის, ჩვენებისა და მდებარეობის ჩანაწერებს. ანგარიშისა და ბილინგის შეტყობინებებისთვის გამოყენებული ელფოსტის მომწოდებლები ამუშავებს მიმღების მისამართსა და შეტყობინების შინაარსს.",
            "ინტერაქტიული რუკები რუკის ფრაგმენტებსა და სხვა რესურსებს ითხოვს მესამე მხარის სერვისებიდან, მათ შორის OpenStreetMap-იდან. რესურსის ჩატვირთვისას ეს სერვისები იღებს კავშირის ინფორმაციას, მაგალითად თქვენს IP მისამართს.",
            "ზოგი მომწოდებელი ინფორმაციას საქართველოს ფარგლებს გარეთ ამუშავებს. საერთაშორისო დამუშავებას უნდა ჰქონდეს სამართლებრივი საფუძველი და კანონით გათვალისწინებული დაცვის მექანიზმები. თქვენს მონაცემებთან დაკავშირებული მომწოდებლების, ქვეყნების და დაცვის ზომების შესახებ ინფორმაციისთვის მოგვწერეთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). პერსონალურ მონაცემებს არ ვყიდით."
          ]
        },
        {
          "id": "public-media",
          "heading": "სარეკლამო ფაილები საჯაროდ ხელმისაწვდომია",
          "paragraphs": [
            "რეკლამა საჯარო ჩვენებისთვისაა განკუთვნილი. ეკრანების მიერ ჩამოსატვირთად ატვირთული ვიზუალები ინახება საჯაროდ წაკითხვად მისამართებზე; მოქმედი ბმულის მქონე სხვა პირმაც შეიძლება ნახოს ფაილი. ანგარიშში შესვლა სარეკლამო ფაილს კონფიდენციალურად არ აქცევს.",
            "ატვირთეთ მხოლოდ ის მასალა, რომლის გამოქვეყნების უფლებაც გაქვთ. მოერიდეთ პირად დოკუმენტებს, არასაჭირო პირად დეტალებსა და მგრძნობიარე ინფორმაციას. წაშლის მოთხოვნით ვეღარ დავაბრუნებთ სხვების მიერ უკვე ჩამოტვირთულ ან ჩაწერილ ასლებს."
          ]
        },
        {
          "id": "cookies",
          "heading": "ქუქი-ფაილები და ბრაუზერის მეხსიერება",
          "paragraphs": [
            "ავტორიზაციის ქუქი-ფაილებს ვიყენებთ შესვლისა და სესიის შესანარჩუნებლად. ელფოსტის კოდით გადამოწმების ფუნქციის ჩართვისას გამოიყენება ხანმოკლე გადამოწმების ქუქი-ფაილი, ხოლო დამახსოვრებული ბრაუზერის ქუქი-ფაილი შეიძლება დარჩეს **180 დღემდე**. ანგარიშიდან გასვლა დამახსოვრებული ბრაუზერის ქუქი-ფაილს ყოველთვის არ შლის.",
            "ბრაუზერის მეხსიერებაში ინახება ენისა და ფერთა თემის არჩევანი. სესიის დროებითი ჩანაწერი შეიძლება ინახავდეს ახალი კლიენტის გზამკვლევის ეტაპს. პარამეტრები რჩება შეცვლამდე ან წაშლამდე, ხოლო დროებითი სესიის მონაცემები ბრაუზერის სესიის დასრულებამდე.",
            "ამ გვერდებზე ამჟამად არ ვიყენებთ მესამე მხარის სარეკლამო ტრეკერებს. ქუქი-ფაილებისა და ადგილობრივი მეხსიერების წაშლა ან შეზღუდვა ბრაუზერიდან შეგიძლიათ. აუცილებელი ქუქი-ფაილების შეზღუდვამ შეიძლება შეაფერხოს შესვლა ან ხელახალი გადამოწმება მოითხოვოს. არჩევითი თვალთვალის დამატებისას შესაბამის ინფორმაციასა და არჩევანს მოგაწვდით."
          ]
        },
        {
          "id": "retention",
          "heading": "რამდენ ხანს ვინახავთ ინფორმაციას",
          "paragraphs": [
            "შენახვის ხანგრძლივობას განსაზღვრავს ჩანაწერის მიზანი და შესაბამისი ვალდებულებები. ყველა კატეგორიისთვის ერთი საერთო ვადა არ მოქმედებს."
          ],
          "bullets": [
            "**ანგარიშისა და საკონტაქტო მონაცემები** ინახება ურთიერთობის სამართავად საჭირო პერიოდში; შემდეგ განიხილება მათი წაშლა ან გამოყენების შეზღუდვა, დარჩენილი ვალდებულებებისა და მოთხოვნების გათვალისწინებით.",
            "**მდებარეობის, ჩვენებისა და უსაფრთხოების დეტალური ჩანაწერები** ინახება ჩვენების გადამოწმების, დარიცხვების შეჯერების, ხარვეზების შესწავლისა და სერვისის დაცვისთვის საჭირო ხნით. დეტალური ჩანაწერების წაშლის შემდეგ შეჯამებული მონაცემები შეიძლება ცალკე დარჩეს.",
            "**ფინანსური, სახელშეკრულებო და დავის ჩანაწერები** ანგარიშის დახურვის შემდეგაც შეიძლება იყოს საჭირო სამართლებრივი, საბუღალტრო ან მტკიცებულებითი მიზნებისთვის.",
            "**სარეკლამო ფაილები** ინახება კამპანიის მუშაობისა და მხარდაჭერისთვის საჭირო პერიოდში. გამოყენების დასრულების შემდეგ წაშლისთვის დაგვიკავშირდით. ნარჩენი ასლები შეზღუდული პერიოდით შეიძლება დარჩეს მომწოდებლის სარეზერვო ასლებში ან ქეშში."
          ]
        },
        {
          "id": "requests",
          "heading": "თქვენი უფლებები და მოთხოვნები",
          "paragraphs": [
            "შეგიძლიათ მოითხოვოთ მონაცემებზე წვდომა, გასწორება, ასლის მიღება და, შესაბამის შემთხვევაში, წაშლა, დაბლოკვა ან გადატანა. კანონით გათვალისწინებულ შემთხვევაში შეგიძლიათ შეეწინააღმდეგოთ დამუშავებას ან გამოიხმოთ თანხმობა. მოგვწერეთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). უფლებებზე ვრცელდება კანონით განსაზღვრული პირობები.",
            "მიგვითითეთ, რომელ ანგარიშს, კამპანიას, ავტომობილს ან პერიოდს ეხება მოთხოვნა. ინფორმაციის გაცემამდე ან შეცვლამდე შეიძლება მოვითხოვოთ პირადობის ან უფლებამოსილების თანაზომიერი გადამოწმება. გიპასუხებთ კანონით დადგენილ ვადებში და აგიხსნით უარის, შეზღუდვის ან დასაშვები ვადის გაგრძელების საფუძველს.",
            "ანგარიშის დახურვა ავტომატურად არ შლის ჩანაწერებს, რომელთა შენახვაც აუცილებელია. თანხმობის გამოხმობა არ აუქმებს მანამდე კანონიერად განხორციელებულ დამუშავებას; თუ ეს არჩევით ფუნქციაზე იმოქმედებს, აგიხსნით."
          ]
        },
        {
          "id": "security",
          "heading": "უსაფრთხოება და ანგარიშის დაცვა",
          "paragraphs": [
            "ინფორმაციის დასაცავად ვიყენებთ ავტორიზაციას, როლების მიხედვით წვდომის გამიჯვნასა და სხვა ტექნიკურ და ორგანიზაციულ ზომებს. სრულ უსაფრთხოებას ვერცერთი ინტერნეტსერვისი ვერ იძლევა. დაიცავით თქვენი პაროლი და ანგარიშის გატეხვის ან მონაცემების გამჟღავნების ეჭვისას სწრაფად მოგვწერეთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge).",
            "პაროლები ან ავტორიზაციის კოდები ელფოსტით არ გამოგვიგზავნოთ. ინციდენტის გამოსაკვლევად და ანგარიშების დასაცავად შეიძლება შევინახოთ შეზღუდული მოცულობის შესაბამისი ჩანაწერები."
          ]
        },
        {
          "id": "children",
          "heading": "არასრულწლოვნები",
          "paragraphs": [
            "Gzad-ის სარეკლამო და ავტოპარკის მომსახურება განკუთვნილია სრულწლოვანი პირებისთვის, რომლებიც საქმიანობენ ბიზნესის ან პროფესიული მიზნებით. თუ ფიქრობთ, რომ არასრულწლოვანმა სერვისის მეშვეობით პირადი ინფორმაცია მოგვაწოდა, დაგვიკავშირდით, რათა შევაფასოთ და მოვაგვაროთ საკითხი."
          ]
        },
        {
          "id": "complaints",
          "heading": "კითხვები და საჩივრები",
          "paragraphs": [
            "კონფიდენციალურობის საკითხზე შეგიძლიათ მოგვწეროთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). ასევე შეგიძლიათ მიმართოთ **საქართველოს სახელმწიფო აუდიტის სამსახურს**, მონაცემთა დაცვის ზედამხედველ უფლებამოსილ ორგანოს, ან შესაბამის სასამართლოს. ჩვენთან წინასწარი დაკავშირება ამ უფლებებს არ ზღუდავს.",
            "შესაბამისი სამართლებრივი ჩარჩოა [საქართველოს კანონი „პერსონალურ მონაცემთა დაცვის შესახებ“](https://www.matsne.gov.ge/ka/document/view/5827307)."
          ]
        },
        {
          "id": "changes",
          "heading": "პოლიტიკის ცვლილება",
          "paragraphs": [
            "მომსახურების ან ჩვენი პრაქტიკის შეცვლისას ვაახლებთ ამ პოლიტიკას და ზემოთ მითითებულ თარიღს. მნიშვნელოვან ცვლილებებს ანგარიშის ან საკონტაქტო არხით შეგატყობინებთ. პოლიტიკის განახლება თავისთავად არ გვაძლევს ახალი გამოყენების უფლებას, თუ ამისთვის სხვა სამართლებრივი საფუძველი ან თანხმობაა საჭირო."
          ]
        }
      ]
    },
    "terms": {
      "title": "მომსახურების პირობები",
      "eyebrow": "Gzad-ის გამოყენება",
      "summary": "რეკლამის განმთავსებლის ანგარიშის, კამპანიის გაშვების, წინასწარი ბალანსისა და ავტოპარკის თანამშრომლობის პირობები.",
      "intro": [
        "ეს პირობები ვრცელდება Gzad-ის ვებგვერდისა და რეკლამის განმთავსებლებისა და ავტოპარკების მომსახურების გამოყენებაზე. გაეცანით მათ [კონფიდენციალურობის პოლიტიკასთან](/privacy) და ჩვენთან დადებულ კამპანიის შეკვეთასთან ან პარტნიორობის ხელშეკრულებასთან ერთად."
      ],
      "sections": [
        {
          "id": "operator",
          "heading": "ოპერატორი და საკონტაქტო ინფორმაცია",
          "paragraphs": [
            "Gzad-ის ოპერატორია საქართველოში რეგისტრირებული **შპს „გზადვერთაისმენთ“**, საიდენტიფიკაციო კოდი **400469239**, იურიდიული მისამართით **საქართველო, თბილისი, ევგენი ხარაძის ქუჩა №7**.",
            "კამპანიის, ბილინგის, ანგარიშისა და ხელშეკრულების საკითხებზე მოგვწერეთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). საკონტაქტო ტელეფონია **+995 591 410 914**."
          ]
        },
        {
          "id": "agreement",
          "heading": "როდის მოქმედებს ეს პირობები",
          "paragraphs": [
            "ანგარიშის შექმნით, მომსახურების შეკვეთით ან გამოყენებით იღებთ ამ პირობებს. უნდა იყოთ არანაკლებ 18 წლის და გქონდეთ შესაბამის შეთანხმებაში შესვლის უფლებამოსილება. კომპანიის ან ავტოპარკის სახელით მოქმედებისას ადასტურებთ, რომ მის სახელით ვალდებულების აღება შეგიძლიათ.",
            "მომსახურება განკუთვნილია ბიზნესრეკლამისა და ავტოპარკის საქმიანობისთვის. კამპანიის ცალკე წერილობითი დადასტურება ან პარტნიორობის ხელშეკრულება განსაზღვრავს კონკრეტულ კომერციულ პირობებს და წინააღმდეგობისას უპირატესია ამ ზოგად პირობებთან შედარებით. კანონის სავალდებულო მოთხოვნები ყოველთვის უპირატესია."
          ]
        },
        {
          "id": "accounts",
          "heading": "ანგარიში და უსაფრთხოება",
          "paragraphs": [
            "მოგვაწოდეთ ზუსტი ინფორმაცია ანგარიშის, კომპანიისა და საკონტაქტო პირის შესახებ და განაახლეთ საჭიროებისას. გამოიყენეთ უფლებამოსილი ანგარიში, დაიცავით პაროლი და გადამოწმების კოდები და უნებართვო გამოყენების ეჭვისას სწრაფად მოგვწერეთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge).",
            "კანონით დადგენილ ფარგლებში პასუხისმგებელი ხართ თქვენს ან თქვენ მიერ უფლებამოსილი პირების მითითებებსა და ატვირთულ მასალებზე. დაუშვებელია სხვისი სახელით მოქმედება, წვდომის კონტროლის გვერდის ავლა, უნებართვო წვდომის გაზიარება, კერძო ჩანაწერების შეგროვება, მავნე კოდის ატვირთვა ან ეკრანების, ანგარიშგებისა და დარიცხვების მუშაობაში ჩარევა."
          ]
        },
        {
          "id": "creative",
          "heading": "ვიზუალი, უფლებები და შემოწმება",
          "paragraphs": [
            "პასუხისმგებელი ხართ რეკლამის სისწორეზე, კანონიერებასა და საჭირო ნებართვებზე, მათ შორის საავტორო უფლებებზე, სასაქონლო ნიშნებზე, მუსიკაზე, სურათებსა და ადამიანების გამოსახულებაზე. უნდა ფლობდეთ უფლებებს, რომლებიც Gzad-სა და მის მომსახურე მომწოდებლებს კამპანიისთვის ფაილის შენახვის, ტექნიკური ადაპტირებისა და ჩვენების საშუალებას აძლევს.",
            "ვიზუალს ჩვენებამდე ვამოწმებთ და სამართლებრივი, ტექნიკური ან უსაფრთხოების მიზეზით შეიძლება მოვითხოვოთ ცვლილება, უარი ვთქვათ ან მასალა ამოვიღოთ. არ ატვირთოთ უკანონო, თაღლითური, შეცდომაში შემყვანი, სხვისი უფლებების დამრღვევი ან საგზაო მოძრაობაში მყოფთათვის შეუფერებელი შინაარსი. დამტკიცება იურიდიულ დასკვნას არ ნიშნავს და თქვენს პასუხისმგებლობას Gzad-ზე არ გადასცემს.",
            "ვიზუალზე საკუთრება თქვენ გრჩებათ. ჩვენთვის მინიჭებული ნებართვა შემოიფარგლება მომსახურების შესრულებით, მათ შორის ფორმატირებით, ეკრანებზე ფაილის მიწოდებითა და მხარდაჭერისა თუ ბილინგისთვის საჭირო ჩანაწერების შენახვით. სხვა სარეკლამო მასალაში გამოყენებას ცალკე ნებართვა სჭირდება."
          ]
        },
        {
          "id": "delivery",
          "heading": "ეკრანები, მარშრუტები და ჩვენება",
          "paragraphs": [
            "ჩვენი გუნდი დამტკიცებულ კამპანიას ანაწილებს ხელმისაწვდომ ეკრანებზე. ეკრანები კამპანიებს მონაცვლეობით უშვებს; კამპანიის რამდენიმე ფაილიც შეიძლება მონაცვლეობდეს. თუ წერილობით სხვა რამ არ შეგვითანხმებია, ვერ ირჩევთ კონკრეტულ ტაქსს, უბანს, მარშრუტს, ცალკეულ ეკრანს ან ჩვენების ზუსტ მომენტს.",
            "ავტომობილები ჩვეულებრივ მარშრუტებს მიჰყვება. რეალური დაფარვა და ჩვენება დამოკიდებულია ავტომობილის მუშაობაზე, დამტკიცებულ მასალაზე, თარიღებზე, ეკრანის ხელმისაწვდომობაზე, კავშირსა და ტექნიკურ პირობებზე. რუკები და ჟურნალები აღწერს აღრიცხულ ჩვენებებს და არა სამომავლო დაფარვის გარანტიას.",
            "ცალკე წერილობითი ვალდებულების გარეშე არ ვიძლევით აუდიტორიის მინიმალური მოცულობის, გაყიდვების, რეკლამის უკუგების, გეოგრაფიული დაფარვის ან უწყვეტი ეთერის გარანტიას. ვებგვერდის მაგალითები და კალკულატორები საორიენტაციო შეფასებებია და არა სავალდებულო შეთავაზება ან გარანტირებული შედეგი."
          ]
        },
        {
          "id": "pricing",
          "heading": "ტარიფები და დარიცხვა",
          "paragraphs": [
            "კამპანიის ხარჯს განსაზღვრავს მისთვის დადასტურებული ტარიფი და დარიცხვის ერთეული. ფასი შეიძლება დამოკიდებული იყოს რეკლამის ხანგრძლივობაზე, ეკრანის მდებარეობასა და დღის დროზე. გადახდისა და გადასახადების პირობები, ასევე წარმოებისა თუ მომზადების ცალკე საფასური, კამპანიის შეთანხმებისას დასტურდება.",
            "სერვისი ითვალისწინებს სრულსაათიან დარიცხვას და, შეთანხმებისა და შესაბამისი რეჟიმის ჩართვის შემთხვევაში, გაზომილ ბლოკებს. საათობრივ რეჟიმში შესაბამის პერიოდში დაფიქსირებული ჩვენება შეიძლება ერთხელ დაირიცხოს სრული საათის ერთეულით; ბლოკურ რეჟიმში ითვლება ბლოკის აღრიცხული წილი. მოქმედებს თქვენი კამპანიისთვის დადასტურებული წესი.",
            "დარიცხვა ეყრდნობა ჩვენებისა და მოწყობილობის ჩანაწერებს, რომლებიც ჩვენების შემდეგაც შეიძლება მოვიდეს ან შეჯერდეს. ბალანსი ყოველთვის მყისიერად არ ახლდება. შეგვიძლია გავასწოროთ გამოტოვებული, დუბლირებული ან მცდარი ჩანაწერი და აგიხსნათ კორექტირება. ტარიფის ცვლილება ვრცელდება შეტყობინების შემდეგ გასაწევ მომსახურებაზე, უკვე შეთანხმებული ფიქსირებული პირობების გათვალისწინებით."
          ]
        },
        {
          "id": "balance",
          "heading": "წინასწარი ბალანსი და ლიმიტები",
          "paragraphs": [
            "რეკლამა მუშაობს წინასწარი ბალანსით. თანხა ხელმისაწვდომი ხდება Gzad-ის მიერ შეთანხმებული გადახდის ან კრედიტის მიღებისა და აღრიცხვის შემდეგ. კალკულატორი, შევსების მაგალითი ან დემონსტრაციაში არჩეული თანხა გადახდას არ ნიშნავს და თქვენს რეალურ ბალანსს არ ზრდის.",
            "თანხის ან შესაბამისი დღიური ლიმიტის ამოწურვისას კამპანია შეიძლება შეჩერდეს. უკვე წარმოქმნილი ხარჯი, მათ შორის შესაჯერებელი ჩანაწერებიდან, გადასახდელი რჩება. თანხის დამატება არ აუქმებს ვიზუალის შემოწმების, კამპანიის თარიღების, ეკრანზე განაწილებისა და ტექნიკური ხელმისაწვდომობის მოთხოვნებს.",
            "კამპანიის შეჩერება ან დასრულება შეგიძლიათ მოითხოვოთ ანგარიშში არსებული მართვის საშუალებით ან ჩვენს გუნდთან დაკავშირებით. გაითვალისწინეთ მოთხოვნის დამუშავებისა და ეკრანთან სინქრონიზაციის დრო; შეჩერება უკვე გაწეული მომსახურების ხარჯს არ აუქმებს."
          ]
        },
        {
          "id": "refunds",
          "heading": "დარიცხვის საკითხები და გამოუყენებელი თანხა",
          "paragraphs": [
            "დარიცხვაზე შეკითხვისას მოგვწერეთ [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge)-ზე და მიუთითეთ ანგარიში, კამპანია, თარიღები და შესასწავლი საკითხი. განვიხილავთ ჩვენებისა და გადახდის ჩანაწერებს და დადასტურებულ შეცდომას გავასწორებთ.",
            "ანგარიშის დახურვამდე ან გამოუყენებელი თანხის დაბრუნების მოთხოვნამდე დაგვიკავშირდით. დაბრუნების შესაძლებლობა, გაუქმების საფასური და დარჩენილი კრედიტის ბედი დამოკიდებულია დადასტურებულ კომერციულ პირობებსა და კანონზე. დემონსტრაცია ან ბალანსის ჩვენება ავტომატურ გატანას ან დაბრუნების ფუნქციას არ გულისხმობს.",
            "ეს პირობები არ ზღუდავს მომხმარებლის კანონით დადგენილ სავალდებულო უფლებას, მათ შორის გაუქმებისა თუ თანხის დაბრუნების უფლებას. თუ თქვენს გარიგებაზე მომხმარებლის დაცვის წესები ვრცელდება, ისინი უპირატესია შეუსაბამო კომერციულ პირობებთან შედარებით."
          ]
        },
        {
          "id": "fleets",
          "heading": "ავტოპარკის პარტნიორობა",
          "paragraphs": [
            "ავტოპარკთან თანამშრომლობა მოითხოვს ავტომობილისა და მოწყობილობის პირობების შეთანხმებას. პარტნიორობის ხელშეკრულება ადგენს ეკრანის საკუთრებას, მონტაჟის, მოვლისა და მოხსნის პასუხისმგებლობას, შემოსავლის წილის გამოთვლის წესს, დასათვლელ შემოსავალს, გადახდის დროსა და სამუშაო მოთხოვნებს. შემოსავლის მაგალითი გარანტირებულ ანაზღაურებას არ ნიშნავს.",
            "პარტნიორს უნდა ჰქონდეს ავტომობილის შეთავაზების უფლებამოსილება და მონტაჟისა და მუშაობისთვის საჭირო ნებართვები. შეინარჩუნეთ ზუსტი ინფორმაცია, იმუშავეთ კანონიერად და უზრუნველყავით შეთანხმებული წვდომა მომსახურებისთვის. აკრძალულია მოწყობილობაში ჩარევა, დამტკიცებული რეკლამის დაბრკოლება და მდებარეობის ან ჩვენების ჩანაწერების მანიპულაცია.",
            "პარტნიორმა მძღოლებს უნდა აცნობოს მდებარეობისა და ჩვენებების ანგარიშგების შესახებ, ჰქონდეს შესაბამისი პირადი მონაცემების გაზიარების საფუძველი და შეასრულოს მძღოლების მიმართ საკუთარი ვალდებულებები. Gzad-ის მიერ მონაცემების გამოყენება აღწერილია [კონფიდენციალურობის პოლიტიკაში](/privacy)."
          ]
        },
        {
          "id": "public-files",
          "heading": "საჯარო ვიზუალი და კონფიდენციალური ინფორმაცია",
          "paragraphs": [
            "რეკლამა განკუთვნილია საჯარო ჩვენებისთვის და მედია-ფაილი შეიძლება ხელმისაწვდომი იყოს საჯარო ბმულით. არ ატვირთოთ კონფიდენციალური დოკუმენტები ან პირადი ინფორმაცია, რომლის გასაჯაროების უფლებაც არ გაქვთ.",
            "მომსახურებით მიღებული კერძო კამპანიის, ანგარიშის, ავტოპარკისა და ტექნიკური ჩანაწერები გამოიყენეთ მხოლოდ უფლებამოსილი მომსახურების მიზნებისთვის. არ გაამჟღავნოთ სხვისი კერძო ინფორმაცია და არ გამოიყენოთ მარშრუტის ანგარიშები მძღოლის სხვა მიზნით იდენტიფიცირებისთვის."
          ]
        },
        {
          "id": "interruptions",
          "heading": "ხელმისაწვდომობა და ანგარიშგების ხარვეზები",
          "paragraphs": [
            "ტექნიკურმა მომსახურებამ, მობილურმა კავშირმა, ელექტროენერგიამ, მოწყობილობის დაზიანებამ, ავტომობილის ხელმისაწვდომობამ და გონივრულ კონტროლს მიღმა მოვლენებმა შეიძლება გამოიწვიოს შეფერხება. ადამიანების, მოწყობილობების, ანგარიშებისა და ქსელის დასაცავად შეიძლება შევაჩეროთ შესაბამისი ჩვენება.",
            "გამოტოვებული ჩვენების ან მცდარი ანგარიშის შესახებ შეგვატყობინეთ გამოსაკვლევად. დარიცხვის კორექტირება ან სხვა გამოსწორება დაეყრდნობა დადასტურებულ მომსახურებას, არსებულ ჩანაწერებსა და კანონით განსაზღვრულ უფლებებს. მხოლოდ კავშირის ან დაფაზე სტატუსის არსებობა ყველა რეკლამის ჩვენებას არ ადასტურებს."
          ]
        },
        {
          "id": "suspension",
          "heading": "შეჩერება და მომსახურების დასრულება",
          "paragraphs": [
            "ანგარიშის დახურვა ან კამპანიის დასრულება შეგიძლიათ მოითხოვოთ [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge)-ზე, არსებული ვალდებულებებისა და წარმოქმნილი ხარჯის გათვალისწინებით. შეიძლება შევზღუდოთ ან შევაჩეროთ წვდომა უკანონო გამოყენების, უსაფრთხოების საფრთხის, ჩანაწერების მანიპულაციის, გადაუხდელობის ან პირობების არსებითი დარღვევისას.",
            "როცა ეს პრაქტიკულად შესაძლებელი და მიზანშეწონილია, აგიხსნით საკითხს და მოგცემთ გამოსწორების შესაძლებლობას. უსაფრთხოების ან სამართლებრივი მიზეზით შეიძლება საჭირო იყოს დაუყოვნებლივი მოქმედება. ანგარიშის დახურვა არ აუქმებს დარჩენილ ვალდებულებებს და კანონიერად აუცილებელი ჩანაწერების შენახვას. ავტოპარკის მოწყობილობის ჩაბარება განისაზღვრება პარტნიორობის ხელშეკრულებით."
          ]
        },
        {
          "id": "responsibility",
          "heading": "პასუხისმგებლობა და სამართლებრივი დაცვა",
          "paragraphs": [
            "თითოეული მხარე პასუხისმგებელია შესაბამისი ხელშეკრულებითა და კანონით დაკისრებული საკუთარი ვალდებულებების შესრულებაზე. რეკლამის შედეგი და კალკულატორის პროგნოზი გარანტირებულ კომერციულ შედეგს არ ადგენს.",
            "ცალკე კომერციული ხელშეკრულებით გათვალისწინებული პასუხისმგებლობის შეზღუდვა მოქმედებს მხოლოდ კანონით დასაშვებ ფარგლებში. ეს პირობები არ გამორიცხავს პასუხისმგებლობასა თუ დაცვის საშუალებას, რომლის გამორიცხვაც დაუშვებელია, და არ უშლის მხარეს ხელს დარღვევის გამო შესაბამისი მოთხოვნის წარდგენაში."
          ]
        },
        {
          "id": "law",
          "heading": "გამოსაყენებელი სამართალი და დავები",
          "paragraphs": [
            "ეს პირობები რეგულირდება საქართველოს კანონმდებლობით. ანგარიშის, კამპანიის ან ხელშეკრულების საკითხის შესასწავლად შეგიძლიათ მოგვწეროთ: [info@gzadvertisement.ge](mailto:info@gzadvertisement.ge). ეს არ ზღუდავს საჩივრის ან დავის გადაწყვეტის სხვა კანონიერ გზას.",
            "მოუგვარებელი დავა შეიძლება განიხილოს უფლებამოსილმა სასამართლომ კანონით დადგენილი წესით. სასამართლოს კომპეტენციისა და მომხმარებლის დაცვის სავალდებულო წესები ძალაში რჩება."
          ]
        },
        {
          "id": "changes",
          "heading": "პირობების განახლება",
          "paragraphs": [
            "მომსახურების ცვლილებისას შეიძლება განვაახლოთ ეს პირობები და ზემოთ მითითებული თარიღი. არსებით ცვლილებებს მოქმედებამდე შეგატყობინებთ ანგარიშის ან საკონტაქტო არხით. საჭიროების შემთხვევაში ახალ თანხმობას მოვითხოვთ.",
            "ცვლილება არ ცვლის უკვე გაწეული მომსახურების პირობებს და არ აუქმებს ცალკე შეთანხმებულ ფიქსირებულ პირობებს შესაბამისი სახელშეკრულებო ან სამართლებრივი საფუძვლის გარეშე. თუ არსებით ცვლილებას არ ეთანხმებით, მოგვმართეთ სამომავლო გამოყენების შეწყვეტისა და არსებული ურთიერთობის მოწესრიგებისთვის."
          ]
        }
      ]
    }
  }
}
