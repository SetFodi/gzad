# MVP Document: Gzad Georgia

## Digital Out-of-Home Advertising on Taxi-Top LED Displays

---

## 1. Executive Summary

**Gzad Georgia** is a digital out-of-home (DOOH) advertising platform that transforms Tbilisi's taxi fleet into a mobile advertising network using programmable LED displays mounted on taxi rooftops.

We connect local businesses seeking hyperlocal, flexible advertising with taxi drivers looking for passive income opportunities. Our platform enables GPS-targeted, time-based ad delivery across the city, bringing modern programmatic advertising capabilities to Georgia's outdoor advertising market.

**Key Highlights:**

- First-mover advantage in Georgian mobile DOOH market
- Hardware secured (P4 LED displays with full API control)
- Non-dilutive revenue model for taxi drivers
- Self-service platform for advertisers
- Scalable to other cities and vehicle types

---

## 2. Problem Statement

### For Advertisers:

- **Static billboards are expensive** - Monthly costs of GEL 3,000-15,000+ for prime locations
- **No flexibility** - Locked into long-term contracts, single locations
- **No targeting** - Can't reach specific neighborhoods or time slots
- **No metrics** - Impossible to measure actual impressions or ROI
- **Limited inventory** - Prime billboard spots are scarce and controlled by few players

### For Taxi Drivers:

- **Declining income** - Ride-hailing competition has squeezed margins
- **No passive income options** - Vehicle sits idle, earning nothing between rides
- **High operating costs** - Fuel, maintenance, insurance eat into profits

### For the Market:

- Georgia's outdoor advertising is underdeveloped compared to regional peers
- No programmatic DOOH solutions exist in the market
- Growing SMB sector needs affordable, flexible advertising options

---

## 3. Solution

### Product Overview

A two-sided platform connecting advertisers with taxi-mounted LED displays:

**Hardware Component:**

- P4 LED displays (high brightness, weatherproof) mounted on taxi rooftops
- 4G/WiFi connectivity for real-time content updates
- GPS tracking for location-based ad delivery
- Remote management via cloud platform

**Software Platform:**

1. **Advertiser Dashboard**
   - Self-service campaign creation
   - Geographic targeting (neighborhoods, routes, landmarks)
   - Time-based scheduling (rush hour, evenings, weekends)
   - Real-time analytics and impression tracking
   - Budget control and automated bidding

2. **Driver App**
   - Earnings dashboard
   - Display status monitoring
   - Route optimization suggestions
   - Payout management

3. **Admin Backend**
   - Fleet management
   - Content moderation
   - Revenue analytics
   - Hardware diagnostics

### Technical Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Advertiser    │     │  Cloud Server   │     │  Taxi Display   │
│   Dashboard     │────▶│  (Node.js API)  │────▶│  (Xixun P4 LED) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │    Database     │     │   GPS + 4G      │
                        │  (PostgreSQL)   │     │   Controller    │
                        └─────────────────┘     └─────────────────┘
```

**Key Technical Capabilities (via Xixun SDK):**

- Real-time content push via HTTP/WebSocket API
- Brightness auto-adjustment based on ambient light
- GPS location tracking and geofencing
- Remote diagnostics (temperature, voltage, connectivity)
- Offline content caching for connectivity gaps
- 80+ API commands for full control

---

## 4. Value Proposition

### For Advertisers:

| Feature          | Benefit                                               |
| ---------------- | ----------------------------------------------------- |
| Mobile coverage  | Reach customers across entire city, not just one spot |
| GPS targeting    | Show ads only in relevant neighborhoods               |
| Time scheduling  | Target rush hour, lunch time, or evening crowds       |
| Flexible budgets | Start from GEL 100/week, scale as needed              |
| Real metrics     | Pay for verified impressions, track ROI               |
| Quick launch     | Go live in 24 hours, not weeks                        |

### For Taxi Drivers:

| Feature             | Benefit                                   |
| ------------------- | ----------------------------------------- |
| Passive income      | Earn GEL 300-800/month without extra work |
| Zero investment     | Hardware provided and installed free      |
| No interference     | Doesn't affect driving or passengers      |
| Flexible commitment | Month-to-month participation              |

### For Us:

| Feature           | Benefit                                     |
| ----------------- | ------------------------------------------- |
| Asset-light model | Drivers provide vehicles, we provide tech   |
| Recurring revenue | Monthly subscriptions + impression fees     |
| Network effects   | More taxis = more advertisers = more taxis  |
| Data advantage    | GPS data enables premium targeting products |

---

## 5. Target Market

### Primary Market: Tbilisi, Georgia

**Market Size Estimates:**

- Tbilisi population: ~1.2 million
- Active taxis: ~15,000-20,000
- Outdoor advertising market (Georgia): ~$15-20 million annually
- Digital share potential: 20-30% = $3-6 million addressable

**Target Segments:**

#### Advertisers (B2B):

1. **Local Restaurants & Cafes** (Primary)
   - Need: Drive foot traffic, promote specials
   - Budget: GEL 200-1,000/month
   - Volume: 500+ potential clients in Tbilisi

2. **Retail Shops & Malls**
   - Need: Promote sales, new arrivals
   - Budget: GEL 500-3,000/month
   - Volume: 200+ potential clients

3. **Events & Entertainment**
   - Need: Promote concerts, shows, clubs
   - Budget: GEL 300-2,000/campaign
   - Volume: 50+ events/month

4. **Real Estate & Auto**
   - Need: Promote listings, new developments
   - Budget: GEL 1,000-5,000/month
   - Volume: 100+ potential clients

5. **Banks & Telcos** (Future)
   - Need: Brand awareness, product launches
   - Budget: GEL 5,000-20,000/month
   - Volume: 10-15 companies

#### Taxi Drivers (Supply):

- Independent taxi drivers (Bolt, traditional)
- Small fleet operators (5-20 vehicles)
- Corporate fleets (hotels, airports)

---

## 6. Business Model

### Revenue Streams:

1. **Impression-Based Advertising (Primary)**
   - Charge per 1,000 impressions (CPM model)
   - Pricing: GEL 5-15 CPM depending on targeting
   - Premium for rush hour, specific zones

2. **Monthly Subscriptions**
   - Fixed monthly fee for guaranteed display time
   - Packages: Basic (GEL 300), Standard (GEL 600), Premium (GEL 1,200)

3. **Campaign Setup Fees**
   - One-time fee for custom creative design
   - GEL 50-200 per campaign

### Cost Structure:

| Category                    | Monthly Cost (10 taxis) | Notes                |
| --------------------------- | ----------------------- | -------------------- |
| Hardware lease/depreciation | GEL 1,500               | ~GEL 150/unit        |
| 4G data plans               | GEL 200                 | ~GEL 20/unit         |
| Driver payouts              | 40% of revenue          | Revenue share        |
| Cloud hosting               | GEL 100                 | AWS/DigitalOcean     |
| Operations                  | GEL 500                 | Support, maintenance |
| Marketing                   | GEL 500                 | Customer acquisition |

### Unit Economics (per taxi/month):

```
Revenue per taxi:           GEL 1,000 (average)
- Driver payout (40%):      GEL 400
- Hardware cost:            GEL 150
- Data + hosting:           GEL 25
- Operations:               GEL 50
= Gross profit:             GEL 375 (37.5% margin)
```

### Break-Even Analysis:

- Fixed costs: ~GEL 3,000/month (team, office, tools)
- Contribution margin: GEL 375/taxi
- Break-even: 8 active taxis with full utilization

---

## 7. Go-to-Market Strategy

### Phase 1: Pilot (Months 1-2)

**Goal:** Prove concept with 5-10 taxis

- Install displays on 5-10 partner taxis
- Onboard 5-10 beta advertisers (free/discounted)
- Test all technical systems
- Gather driver and advertiser feedback
- Document case studies

**Pilot Advertiser Targets:**

- 2-3 restaurants near Rustaveli
- 1-2 event promoters
- 1-2 retail shops
- Friends/family businesses for testing

### Phase 2: Launch (Months 3-4)

**Goal:** 30 taxis, 20 paying advertisers

- Scale to 30 taxis in high-traffic areas
- Launch self-service advertiser platform
- Begin paid advertising campaigns
- Hire part-time sales person
- PR push: local media coverage

### Phase 3: Scale (Months 5-6)

**Goal:** 100 taxis, GEL 30,000 MRR

- Expand fleet to 100 taxis
- Launch driver referral program
- Introduce premium targeting features
- Begin agency partnerships
- Prepare for seed funding

---

## 8. Competitive Analysis

### Direct Competitors:

| Competitor             | Offering            | Weakness                              |
| ---------------------- | ------------------- | ------------------------------------- |
| Traditional Billboards | Static outdoor ads  | Expensive, inflexible, no targeting   |
| Bus/Metro Ads          | Transit advertising | Long lead times, no real-time updates |

### Indirect Competitors:

| Competitor           | Offering            | Weakness                         |
| -------------------- | ------------------- | -------------------------------- |
| Facebook/Google Ads  | Digital advertising | No physical presence, ad fatigue |
| Influencer Marketing | Social promotion    | Expensive, unpredictable results |

### Our Advantages:

1. **First mover** - No mobile DOOH in Georgia yet
2. **Technology** - Full API control, real-time updates
3. **Flexibility** - Daily changes possible vs. monthly billboard contracts
4. **Targeting** - GPS-based, time-based delivery
5. **Metrics** - Verifiable impressions vs. estimated billboard views

---

## 9. Team Requirements

### Current:

- Founder(s) - Business development, strategy

### Needed for MVP:

- **Technical Lead** (Part-time/Contract)
  - Build advertiser dashboard
  - Integrate Xixun API
  - Set up cloud infrastructure

- **Sales/BD** (Part-time)
  - Onboard pilot advertisers
  - Sign up taxi drivers
  - Build partnerships

### Future (Post-Seed):

- Full-time developers (2)
- Sales team (2-3)
- Operations manager
- Customer support

---

## 10. Financial Projections

### 6-Month Forecast:

| Month | Taxis | Advertisers | Revenue (GEL) | Costs (GEL) | Net (GEL) |
| ----- | ----- | ----------- | ------------- | ----------- | --------- |
| 1     | 5     | 3           | 1,500         | 4,000       | -2,500    |
| 2     | 10    | 8           | 5,000         | 5,500       | -500      |
| 3     | 20    | 15          | 12,000        | 8,000       | 4,000     |
| 4     | 35    | 25          | 22,000        | 12,000      | 10,000    |
| 5     | 60    | 40          | 40,000        | 18,000      | 22,000    |
| 6     | 100   | 60          | 70,000        | 28,000      | 42,000    |

### 12-Month Targets:

- 200+ active taxis
- 150+ advertisers
- GEL 150,000+ monthly revenue
- GEL 50,000+ monthly profit
- Ready for Series A

---

## 11. Funding Requirements

### Startupbootcamp MVP Grant: GEL 50,000

**Allocation:**

| Category            | Amount (GEL) | Purpose                          |
| ------------------- | ------------ | -------------------------------- |
| Hardware (20 units) | 60,000       | P4 LED displays + installation   |
| Operations          | 8,000        | 4G plans, cloud hosting, tools   |
| Marketing           | 5,000        | Launch campaign, sales materials |
| Legal/Admin         | 3,000        | Company registration, contracts  |
| Reserve             | 2,000        | Contingency                      |

### Future Funding:

- **Seed Round (Month 8-10):** $150-250K
  - Scale to 500 taxis
  - Expand to Batumi, Kutaisi
  - Build full tech team

---

## 12. Risks & Mitigations

| Risk                  | Impact | Mitigation                                 |
| --------------------- | ------ | ------------------------------------------ |
| Low advertiser demand | High   | Start with free pilots, prove ROI          |
| Driver churn          | Medium | Competitive revenue share, easy onboarding |
| Hardware failures     | Medium | Warranty + spare units, remote diagnostics |
| Regulatory issues     | Low    | Research permits early, engage authorities |
| Competition entry     | Medium | Build network effects, lock in drivers     |
| 4G coverage gaps      | Low    | Offline content caching, WiFi backup       |

---

## 13. Key Milestones

### MVP Phase (4 months):

- [ ] Week 1-2: Hardware arrival and testing
- [ ] Week 3-4: First installation on test vehicle
- [ ] Week 5-6: Cloud platform setup (Xixun RealtimeServer)
- [ ] Week 7-8: Basic advertiser dashboard MVP
- [ ] Week 9-10: Pilot with 5 taxis, 5 advertisers
- [ ] Week 11-12: Iterate based on feedback
- [ ] Week 13-14: Scale to 15-20 taxis
- [ ] Week 15-16: Demo Day preparation, 30+ taxis

### Success Metrics:

| Metric               | Target (Month 4) |
| -------------------- | ---------------- |
| Active taxis         | 30+              |
| Paying advertisers   | 20+              |
| Monthly revenue      | GEL 20,000+      |
| Driver satisfaction  | 4.5+/5           |
| Advertiser retention | 70%+             |
| Display uptime       | 95%+             |

---

## 14. Why Now?

1. **Market timing** - Georgia's SMB sector is growing, needs affordable advertising
2. **Technology ready** - LED displays are now affordable, APIs are mature
3. **Regulatory window** - No specific regulations yet, early mover advantage
4. **Economic pressure** - Taxi drivers actively seeking additional income
5. **Digital shift** - Advertisers moving budgets to measurable channels

---

## 15. Vision

**Short-term (1 year):** Become the leading mobile advertising platform in Tbilisi with 200+ taxis and 150+ advertisers.

**Medium-term (3 years):** Expand to all major Georgian cities, diversify to delivery vehicles, buses, and rideshare cars. Reach 1,000+ vehicles.

**Long-term (5 years):** Regional expansion to Armenia, Azerbaijan, and Central Asia. Become the "Clear Channel" of Caucasus mobile advertising.

---

## Contact

**[Your Name]**
Founder, TaxiAds Georgia

Email: gzadvertisment@gmail.com
Phone: +995591410914
Location: Tbilisi, Georgia

---

_Document prepared for Startupbootcamp Georgia MVP Program Application_
_January 2026_
