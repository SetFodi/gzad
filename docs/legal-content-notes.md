# Legal page content

Updated 10 November 2026. The public documents are in `src/content/legal.ts` and render in Georgian and English through the existing language preference. Their contact address is `info@gzadvertisement.ge`.

The text is a proposed set of operating policies and terms, rather than a legal opinion or a record of legal sign-off. A Georgian lawyer should review it against the actual contracts and operating arrangements before the company relies on it.

## Company identity

The company name, identification number 400469239 and registered address at 7 Evgeni Kharadze Street, Tbilisi, come from the company registration material already held in the enclosing Gzad business folder. The English and Georgian articles of association agree on the address; the registry application identifies the company number. Only the company's identity and registered address are used in the public documents. Shareholder and personal identity details are not included. These documents were not a fresh public-register lookup.

## Operating facts reflected in the text

- Account and vehicle fields follow signup and fleet vehicle routes. GPS callbacks include location, speed and a device identifier.
- Advertiser playback queries can return screen identifiers and campaign locations. The policy therefore does not promise that screen or route data is anonymous or that advertisers never receive device identifiers.
- Creative uploads use a public `ad-media` bucket and `getPublicUrl`; the notice explains that public media links are not private storage.
- Billing remains hourly by default. Metered billing, retention pruning, verification and billing email are separately enabled features. The terms describe the confirmed campaign arrangement and delayed reconciliation, rather than promising that every customer is charged in ten-minute blocks.
- There is no card-payment integration in this checkout; balances are credited through the service's administrative flow. Calculator inputs are distinguished from actual payments.
- Retention periods are configurable and pruning is separately enabled. The policy uses retention purposes and criteria and does not promise automatic deletion after an unverified fixed period.
- Supabase, Vercel, the realtime/controller infrastructure, email providers and external OpenStreetMap tiles are covered. No unverified hosting country, transfer authorisation or signed provider contract is claimed.
- Browser storage reflects language/theme preferences, the session introduction marker, auth cookies and the optional remembered-browser cookie. The 180-day maximum comes from `src/lib/auth/trust.ts`.
- Fleet percentages and minimum earnings are left to the partnership agreement. A 12% example in a separate presentation is not treated as a signed term applying to every fleet.

## Legal sources checked

- [Georgia's Law on Personal Data Protection, consolidated English text](https://www.matsne.gov.ge/en/document/view/5827307), including data-subject rights, controller transparency, transfers and the supervisory authority. The authority is now the State Audit Office of Georgia, rather than the former Personal Data Protection Service.
- [Georgia's Law on the Protection of Consumer Rights](https://matsne.gov.ge/en/document/view/5420598). Mandatory consumer rights are preserved where applicable; the website does not impose a blanket non-refundable-credit rule.

The documents avoid inventing a refund period, liability cap, fixed retention schedule, guaranteed delivery, blanket driver consent or DPO appointment. Actual refund arrangements, retention operations, driver notices, transfer safeguards and any DPO obligation remain matters for the operator and its legal adviser. No live billing setting, data-retention job, contract, payment workflow or consent record is changed by editing these pages.
