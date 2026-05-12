# project.context.md
# LeadGen Autopilot — Complete Project Context
# This file is the first thing any AI agent or developer reads before touching this codebase.
# Keep it updated as the project evolves.

---

## What This Product Does (One Paragraph)

LeadGen Autopilot is a solo-operator tool that automates the entire cold outreach loop.
You type a search query ("digital agencies in Dhaka"), the system finds real companies,
extracts their contact info, sends a personalized email based on what their website says,
follows up automatically on a schedule, classifies every reply with AI, pings you on
Telegram the moment a hot lead responds, and books the meeting on your Google Calendar.
You only intervene when a human decision is genuinely needed — everything else runs itself.

---

## The Problem It Solves

A solo founder or small sales operator manually:
- Searches Google/Maps for potential clients (30 min/day)
- Copy-pastes contact info into a spreadsheet (20 min/day)
- Writes individual emails (60 min/day)
- Remembers to follow up (often forgets)
- Misses hot replies buried under cold ones
- Manually books meetings after back-and-forth

This product eliminates all of that. The human types one query and waits for a
Telegram notification that says "🔥 Hot lead — they want to talk."

---

## Who Uses This (ICP)

Primary user: Solo founder, freelancer, or 1–3 person sales team who:
- Sells a B2B service or SaaS product
- Does outbound cold email as a primary growth channel
- Is technical enough to self-host and configure the tool
- Sends 50–100 emails/day (not enterprise blast volume)
- Wants to spend time closing deals, not finding leads

---

## Core User Journey (The Happy Path)

```
1. User opens dashboard → clicks "New Campaign"
2. Types: query = "e-commerce brands", location = "Dhaka, Bangladesh"
3. Writes or pastes their offer description in Settings
4. Clicks "Launch" → Scout Agent starts finding companies
5. Leads appear in the Leads table (discovered → enriched → ready)
6. System sends Day 0 email to each lead automatically
7. BullMQ schedules Day 3, Day 7, Day 12 follow-ups
8. A lead replies "Yes I'm interested, when can we talk?"
9. Inbox Agent classifies it as HOT
10. User gets Telegram ping: "🔥 Hot lead: Acme Store — they want to talk"
11. User clicks link → sees full thread in Inbox UI
12. Agent proposes 3 calendar slots in a draft reply
13. User approves and sends (or auto-sends if toggle is on)
14. Lead picks a slot → meeting booked on Google Calendar
15. User gets Telegram ping: "📅 Meeting booked: Acme Store, Friday 3pm"
```

---

## What This Is NOT

- Not a mass blast tool (hard cap: 100 emails/day)
- Not a CRM (no pipeline stages, no deal tracking, no revenue forecasting)
- Not a LinkedIn tool (email only in v1)
- Not a team product (single user in v1)
- Not an AI that closes deals (it gets you TO the conversation, not through it)
- Not a replacement for a great offer (garbage offer + automation = faster rejection)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP                              │
│                                                                 │
│  /dashboard  ←→  /api/agents/*  ←→  /api/webhooks/email        │
│  (UI layer)       (job triggers)      (Resend inbound)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ enqueues jobs
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BULLMQ + REDIS                             │
│                                                                 │
│  queues: "scout" | "outreach" | "followup"                      │
│  workers: scout.worker.ts | outreach.worker.ts                  │
│  (separate Node.js process — not Next.js)                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ workers invoke
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH AGENTS                             │
│                                                                 │
│  agents/scout/graph.ts      → finds + enriches leads           │
│  agents/outreach/graph.ts   → personalizes + sends emails      │
│  agents/inbox/graph.ts      → classifies replies + acts        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ reads/writes
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SUPABASE + PRISMA                              │
│                                                                 │
│  Tables: campaigns, leads, messages, jobs,                      │
│          settings, suppressions                                 │
│  Auth: Supabase Auth (email login)                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Inventory

### 1. Scout Agent
**File**: `agents/scout/graph.ts`
**Triggered by**: User clicking "Launch Campaign" → API route → BullMQ "scout" queue
**Input**: `{ campaignId, query, location }`
**What it does**:
  - Searches Google + Google Maps via Firecrawl for companies matching the query
  - Scrapes each company's website to extract name, email, description
  - Deduplicates against existing leads in DB
  - Saves new leads with state = "discovered"
  - Notifies Telegram: "Found {n} leads for {query}"

**Nodes**:
```
search_node → scrape_node → extract_node → dedupe_node → save_node
```

**External services used**: Firecrawl, Prisma, Telegram

---

### 2. Outreach Agent
**File**: `agents/outreach/graph.ts`
**Triggered by**: Lead state becoming "ready" → BullMQ "outreach" queue
**Input**: `{ leadId }`
**What it does**:
  - Loads lead + campaign context from DB
  - Scrapes lead's website for a 1-paragraph summary
  - Calls LLM to write a personalized 3-sentence cold email
  - Sends via Resend
  - Saves email to messages table
  - Transitions lead state to "contacted_1"
  - Schedules 3 follow-up BullMQ jobs (day 3, 7, 12)

**Nodes**:
```
load_context_node → personalize_node → send_node → schedule_followups_node
```

**External services used**: Firecrawl, Anthropic LLM, Resend, BullMQ, Prisma

---

### 3. Inbox Agent
**File**: `agents/inbox/graph.ts`
**Triggered by**: Resend inbound webhook → `/api/webhooks/email/inbound` → directly invoked (real-time, not queued)
**Input**: `{ inboundEmail: { from, subject, body, inReplyTo } }`
**What it does**:
  - Matches inbound email to a lead by sender email address
  - Loads full thread history from messages table
  - Calls LLM to classify reply intent
  - Routes to appropriate handler based on classification
  - Notifies Telegram for hot leads
  - Drafts replies for warm leads (human approval required in v1)
  - Books calendar events for meeting requests

**Nodes**:
```
load_context_node → classify_node → route_node →
  hot_node | warm_node | cold_node | snooze_node | bounce_node
```

**Classification values**:
- `hot` — clearly interested, wants to proceed or meet
- `warm` — has a question, objection, or needs more info
- `cold` — politely or directly not interested
- `ooo` — out of office auto-reply
- `bounce` — delivery failure / bad email

**External services used**: Anthropic LLM, Resend, Google Calendar, Telegram, Prisma

---

## Lead Lifecycle (State Machine)

```
[discovered]
     ↓ enrichment complete
[enriching]
     ↓ email verified, ready to send
[ready]
     ↓ day 0 email sent
[contacted_1]
     ↓ day 3 follow-up sent
[contacted_2]
     ↓ day 7 follow-up sent
[contacted_3]
     ↓ day 12 breakup sent
[contacted_4]
     ↓ no reply after day 12
[sequence_complete] ← terminal, no more emails

At any contacted_X state, if reply comes in:
     ↓ classified hot
[replied_hot]
     ↓ meeting confirmed
[meeting_booked] ← terminal

     ↓ classified warm
[replied_warm]
     ↓ human sends approved reply
[replied_warm] (stays until resolved)

     ↓ classified cold
[replied_cold] ← terminal, suppressed

     ↓ classified ooo
[snoozed] ← sequence resumes after N days

     ↓ email bounced
[bounced] ← terminal, email flagged bad

     ↓ manually removed or unsubscribe link clicked
[suppressed] ← permanent terminal, never contact again
```

---

## Database Schema

```prisma
model Campaign {
  id          String   @id @default(cuid())
  name        String
  query       String
  location    String
  offerText   String   // the pitch — fed to AI for personalization
  status      String   // active | paused | completed
  leads       Lead[]
  createdAt   DateTime @default(now())
  deletedAt   DateTime?
}

model Lead {
  id            String    @id @default(cuid())
  campaignId    String
  companyName   String
  website       String?
  email         String?
  description   String?   // scraped 1-paragraph summary of company
  state         String    // see state machine above
  lastTouchedAt DateTime?
  messages      Message[]
  jobs          Job[]
  campaign      Campaign  @relation(fields: [campaignId], references: [id])
  createdAt     DateTime  @default(now())
  deletedAt     DateTime?
}

model Message {
  id        String   @id @default(cuid())
  leadId    String
  direction String   // outbound | inbound | system
  subject   String?
  body      String
  sentAt    DateTime @default(now())
  lead      Lead     @relation(fields: [leadId], references: [id])
}

model Job {
  id          String   @id @default(cuid())
  leadId      String
  type        String   // followup_2 | followup_3 | followup_4
  scheduledAt DateTime
  status      String   // pending | done | cancelled | failed
  bullmqId    String?  // BullMQ job ID for cancellation
  lead        Lead     @relation(fields: [leadId], references: [id])
}

model Settings {
  id              String  @id @default(cuid())
  userId          String  @unique
  offerText       String?  // default pitch for all campaigns
  fromEmail       String?  // sending address
  fromName        String?
  telegramChatId  String?
  googleRefreshToken String? // encrypted
  dailySendLimit  Int     @default(100)
  autoSendReplies Boolean @default(false) // human-in-loop toggle
}

model Suppression {
  id        String   @id @default(cuid())
  email     String   @unique
  reason    String   // bounced | unsubscribed | manual | complained
  createdAt DateTime @default(now())
}
```

---

## Folder Structure

```
/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               # sidebar + nav
│   │   ├── page.tsx                 # dashboard KPIs
│   │   ├── campaigns/
│   │   │   ├── page.tsx             # campaign list
│   │   │   └── new/page.tsx         # create campaign form
│   │   ├── leads/
│   │   │   └── page.tsx             # leads table
│   │   ├── inbox/
│   │   │   └── page.tsx             # reply threads
│   │   └── settings/
│   │       └── page.tsx             # API keys, offer text, calendar
│   └── api/
│       ├── agents/
│       │   ├── scout/route.ts       # POST → enqueue scout job
│       │   └── outreach/route.ts    # POST → enqueue outreach job
│       └── webhooks/
│           └── email/
│               └── inbound/route.ts # Resend inbound webhook
│
├── agents/
│   ├── scout/
│   │   ├── graph.ts                 # LangGraph graph definition
│   │   ├── state.ts                 # TypeScript state type
│   │   └── nodes/
│   │       ├── search.node.ts
│   │       ├── scrape.node.ts
│   │       ├── extract.node.ts
│   │       ├── dedupe.node.ts
│   │       └── save.node.ts
│   ├── outreach/
│   │   ├── graph.ts
│   │   ├── state.ts
│   │   └── nodes/
│   │       ├── load-context.node.ts
│   │       ├── personalize.node.ts
│   │       ├── send.node.ts
│   │       └── schedule-followups.node.ts
│   │   └── prompts/
│   │       └── personalize.prompt.ts
│   └── inbox/
│       ├── graph.ts
│       ├── state.ts
│       └── nodes/
│           ├── load-context.node.ts
│           ├── classify.node.ts
│           ├── route.node.ts
│           ├── hot.node.ts
│           ├── warm.node.ts
│           ├── cold.node.ts
│           ├── snooze.node.ts
│           └── bounce.node.ts
│       └── prompts/
│           ├── classify.prompt.ts
│           └── draft-reply.prompt.ts
│
├── lib/
│   ├── email/
│   │   └── client.ts               # Resend wrapper
│   ├── scraper/
│   │   └── client.ts               # Firecrawl wrapper
│   ├── telegram/
│   │   └── client.ts               # Telegram bot wrapper
│   ├── calendar/
│   │   └── client.ts               # Google Calendar wrapper
│   ├── queue/
│   │   └── client.ts               # BullMQ queue definitions
│   ├── ai/
│   │   └── client.ts               # Anthropic LLM client
│   └── db/
│       └── client.ts               # Prisma client singleton
│
├── workers/
│   ├── index.ts                    # entry point (separate process)
│   ├── scout.worker.ts
│   └── outreach.worker.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── .env.local                      # never committed
├── leadgen.agent                   # engineering rules
├── project.context.md              # this file
└── package.json
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...          # Supabase connection string
DIRECT_URL=postgresql://...            # Supabase direct URL (for migrations)

# Auth
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server-side only

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Email
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=...              # for verifying inbound webhooks
FROM_EMAIL=outreach@yourdomain.com
FROM_NAME=Your Name

# Scraping
FIRECRAWL_API_KEY=fc-...

# Queue
REDIS_URL=redis://...                  # Upstash or Redis Cloud

# Notifications
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...                   # your personal chat ID

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

---

## External Services & Their Role

| Service | Role | Free Tier Limit |
|---|---|---|
| Supabase | Postgres DB + Auth | 500MB DB, unlimited auth |
| Anthropic (Claude) | LLM for all AI tasks | Pay per token |
| Resend | Email sending + inbound | 3,000 emails/mo free |
| Firecrawl | Web search + scraping | 500 scrapes/mo free |
| BullMQ + Upstash Redis | Job queue + scheduling | 10,000 commands/day free |
| Telegram Bot API | Push notifications | Free |
| Google Calendar API | Free/busy + event creation | Free |
| Railway | Deployment (Next.js + worker) | $5/mo starter |

---

## Key Business Rules (Hardcoded in v1)

```
MAX_EMAILS_PER_DAY       = 100
SEQUENCE_STEPS           = [0, 3, 7, 12]  // days after first contact
MIN_LEAD_SCORE           = 70             // below this → skip
SNOOZE_DURATION_DAYS     = 60            // "not now" leads
RESCRAPE_COOLDOWN_HOURS  = 24            // don't scrape same domain twice/day
MAX_SCOUT_BATCH_SIZE     = 50            // leads per campaign run
MAX_PARALLEL_SCRAPES     = 5            // concurrent Firecrawl requests
LLM_MAX_TOKENS_EMAIL     = 300          // personalized email output
LLM_MAX_TOKENS_CLASSIFY  = 150          // reply classification output
LLM_MAX_TOKENS_DRAFT     = 400          // reply draft output
LLM_TEMP_CLASSIFY        = 0            // deterministic
LLM_TEMP_EMAIL           = 0.7          // natural variation
LLM_TEMP_DRAFT           = 0.4          // controlled
```

---

## Notification Design (What Pings You and When)

```
🔥 HOT LEAD
Trigger: reply classified as "hot"
Message: "🔥 Hot lead: {companyName}
          Said: {first 80 chars of reply}
          → {link to inbox thread}"
When: immediately, real-time

📅 MEETING BOOKED
Trigger: Google Calendar event created
Message: "📅 Meeting booked: {companyName}
          {dayOfWeek} {date} at {time}
          Meet: {googleMeetLink}"
When: immediately after booking

🎯 CAMPAIGN DONE
Trigger: all leads in campaign processed
Message: "🎯 Campaign '{name}' complete
          {n} leads found | {n} emails sent | {n} hot leads"
When: when scout + outreach both finish

📊 DAILY SUMMARY
Trigger: cron at 18:00 local time
Message: "📊 Today's summary
          Sent: {n} | Replies: {n} | Hot: {n} | Meetings: {n}"
When: daily at 6pm

SILENT (no notification):
- Individual follow-up emails sent
- Cold replies received
- Leads enriched/scored
- Snooze events
```

---

## Sequence Email Templates

### Day 0 — Intro (AI personalized)
```
Subject: [AI generated based on signal]

[AI written opener — 1 sentence referencing something specific about their business]

[Your offer — 1 sentence, clear value prop]

[CTA — 1 sentence, low friction: "Worth a quick chat?"]
```

### Day 3 — Follow-up (templated)
```
Subject: Re: [original subject]

Just following up on my note from a few days ago.

[One line value reinforcement from campaign offer]

Happy to share more if useful — just reply here.
```

### Day 7 — Soft CTA (templated)
```
Subject: Re: [original subject]

I know inboxes get busy.

Quick question: is [core problem your offer solves] something
you're actively working on right now?

Either way, happy to help.
```

### Day 12 — Breakup (templated)
```
Subject: Re: [original subject]

I'll stop reaching out after this — I know timing isn't always right.

If things change down the line, feel free to reply here anytime.

Wishing you well.
```

---

## Build Order Reference

```
STEP  NAME                     DEPENDS ON          DAY
────────────────────────────────────────────────────────
  1   Project setup + DB        nothing             1
  2   Telegram bot              Step 1              1
  3   Auth + shell              Step 1              1
  4   Settings page             Step 3              1
  5   Scout agent               Step 4              1
  6   Leads table UI            Step 5              1
  7   Outreach agent            Step 5, Step 4      1
  8   Resend inbound webhook    Step 7              2
  9   Inbox agent               Step 8              2
 10   Inbox UI                  Step 9              2
 11   Google Calendar + booking Step 9              2
 12   Dashboard KPIs            Steps 5,7,9         2
```

---

## Definition of Done (v1)

The product is complete when this full loop works without manual intervention:

```
User types query → leads found → personalized email sent →
follow-ups scheduled → reply received → classified by AI →
Telegram ping on hot lead → meeting booked on calendar →
Telegram ping with meeting details
```

Every step must work on real data, not mock data.
The loop must complete at least once successfully before shipping.
