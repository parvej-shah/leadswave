// Few-shot training examples for the inbox AI.
// Each example shows a real reply pattern and the correct decision.
// Add more examples here as you encounter edge cases in production.

export type ClassifyExample = {
  reply: string;
  classification: "hot" | "warm" | "cold" | "ooo" | "bounce";
  reasoning: string;
};

export type BookingExample = {
  reply: string;
  priorSlots: string;
  decision: "confirm" | "propose" | "unclear";
  slotIndex: number; // 0-based
  reasoning: string;
};

// ─── CLASSIFICATION EXAMPLES ─────────────────────────────────────────────────

export const CLASSIFY_EXAMPLES: ClassifyExample[] = [
  // HOT — clear yes
  {
    reply: "Yes, absolutely interested! When can we set up a call?",
    classification: "hot",
    reasoning: "Explicit yes + asking to schedule — strong buying signal.",
  },
  {
    reply: "This looks great. Can you send me a demo?",
    classification: "hot",
    reasoning: "Requesting a demo is a direct purchase intent signal.",
  },
  {
    reply: "Let's do it. I'm free Thursday or Friday afternoon.",
    classification: "hot",
    reasoning: "Proactively offering availability — ready to meet.",
  },
  {
    reply: "Option 1 works perfectly for me, let's confirm that slot!",
    classification: "hot",
    reasoning: "Picking a specific slot from a prior proposal — meeting confirmation.",
  },
  {
    reply: "Sounds good, book me in for option 2.",
    classification: "hot",
    reasoning: "Explicit slot selection — should trigger calendar booking.",
  },
  {
    reply: "Yes I would love to meet! When are you free? Let's schedule a call.",
    classification: "hot",
    reasoning: "Enthusiastic yes with meeting request.",
  },
  {
    reply: "That works for me. Let's go with slot 3.",
    classification: "hot",
    reasoning: "Confirming slot 3 from prior proposal.",
  },
  {
    reply: "I've been looking for something like this. Can we hop on a quick call?",
    classification: "hot",
    reasoning: "Strong interest + requesting a call.",
  },
  {
    reply: "What's the pricing? We'd like to move forward.",
    classification: "hot",
    reasoning: "Asking about price is a hot buying signal.",
  },
  {
    reply: "Friday 3pm works. Please send a calendar invite.",
    classification: "hot",
    reasoning: "Proposing a specific time — immediate booking needed.",
  },

  // WARM — interested but not ready
  {
    reply: "Interesting. Can you tell me more about how it works?",
    classification: "warm",
    reasoning: "Curious but needs more info before committing.",
  },
  {
    reply: "We might be interested but our budget cycle starts in Q3. Follow up then?",
    classification: "warm",
    reasoning: "Soft interest with a timing objection — nurture, don't close.",
  },
  {
    reply: "Send me a case study and we'll take a look.",
    classification: "warm",
    reasoning: "Wants supporting material — engaged but not ready for a call.",
  },
  {
    reply: "I'll forward this to my manager. Can you send a one-pager?",
    classification: "warm",
    reasoning: "Internal evaluation in progress — warm, not hot.",
  },
  {
    reply: "Maybe. What makes you different from competitors?",
    classification: "warm",
    reasoning: "Comparison question — open but has objections.",
  },
  {
    reply: "We're currently evaluating options. I'll get back to you in 2 weeks.",
    classification: "warm",
    reasoning: "Active evaluation — follow up in 2 weeks.",
  },

  // COLD — not interested
  {
    reply: "No thanks, we're not looking for this right now.",
    classification: "cold",
    reasoning: "Polite but firm rejection.",
  },
  {
    reply: "Please remove me from your list.",
    classification: "cold",
    reasoning: "Unsubscribe request — must suppress immediately.",
  },
  {
    reply: "We already have a solution in place. Not interested.",
    classification: "cold",
    reasoning: "Competitor in place + explicit rejection.",
  },
  {
    reply: "Stop sending me emails.",
    classification: "cold",
    reasoning: "Direct opt-out.",
  },
  {
    reply: "This isn't relevant to our business.",
    classification: "cold",
    reasoning: "Not a fit — stop outreach.",
  },

  // OOO — out of office
  {
    reply: "Hi, I'm out of the office until June 5th. For urgent matters contact jane@company.com.",
    classification: "ooo",
    reasoning: "Automatic OOO reply — snooze and re-enter after return date.",
  },
  {
    reply: "Thanks for your email. I'm currently on vacation and will respond when I return on May 30.",
    classification: "ooo",
    reasoning: "Vacation auto-reply.",
  },
  {
    reply: "I am away from the office with limited access to email.",
    classification: "ooo",
    reasoning: "Limited access OOO.",
  },

  // BOUNCE — delivery failure
  {
    reply: "Delivery Status Notification: This is an automatically generated Delivery Status Notification. Delivery to the following recipient failed permanently.",
    classification: "bounce",
    reasoning: "Mailer daemon permanent failure — email is invalid.",
  },
  {
    reply: "550 5.1.1 The email account that you tried to reach does not exist.",
    classification: "bounce",
    reasoning: "Hard bounce — no such user.",
  },
  {
    reply: "Message not delivered. Address not found.",
    classification: "bounce",
    reasoning: "Delivery failure — flag email as bad.",
  },
];

// ─── BOOKING / SLOT CONFIRMATION EXAMPLES ────────────────────────────────────

export const BOOKING_EXAMPLES: BookingExample[] = [
  // CONFIRM — they picked a slot
  {
    reply: "Option 1 works perfectly for me, let's confirm that slot!",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 0,
    reasoning: "Explicit 'Option 1' — book slot index 0.",
  },
  {
    reply: "Slot 2 works for me.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 1,
    reasoning: "Explicit slot 2 selection.",
  },
  {
    reply: "Let's go with option 3, that's perfect.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 2,
    reasoning: "Option 3 selected.",
  },
  {
    reply: "That works. Book me in.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 0,
    reasoning: "Generic confirmation after slots proposed — default to first slot.",
  },
  {
    reply: "Yes, confirmed. Thursday works.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 0,
    reasoning: "Named Thursday — slot index 0.",
  },
  {
    reply: "Friday afternoon is better for me.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 1,
    reasoning: "Named Friday — slot index 1.",
  },
  {
    reply: "The second option looks good, let's do it.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 1,
    reasoning: "Second option = slot index 1.",
  },
  {
    reply: "Sounds good, any of those work for me.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "confirm",
    slotIndex: 0,
    reasoning: "Any slot accepted — default to first.",
  },

  // PROPOSE — first time showing interest, no slots proposed yet
  {
    reply: "Yes I would love to meet! When are you free?",
    priorSlots: "",
    decision: "propose",
    slotIndex: 0,
    reasoning: "First meeting interest — propose available slots.",
  },
  {
    reply: "Let's set up a call. What times work for you?",
    priorSlots: "",
    decision: "propose",
    slotIndex: 0,
    reasoning: "Asking for times — propose slots.",
  },
  {
    reply: "I'm interested. Can we schedule something?",
    priorSlots: "",
    decision: "propose",
    slotIndex: 0,
    reasoning: "General meeting interest — propose slots.",
  },

  // UNCLEAR — needs human judgment
  {
    reply: "Maybe next month? Not sure about my schedule yet.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "unclear",
    slotIndex: 0,
    reasoning: "Uncertain timing — ask human via Telegram.",
  },
  {
    reply: "Can we do a different time? I'm not available any of those days.",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "unclear",
    slotIndex: 0,
    reasoning: "None of the slots work — human needs to propose new ones.",
  },
  {
    reply: "What about next week instead?",
    priorSlots: "1. Thursday, May 29, 10:00 AM\n2. Friday, May 30, 2:00 PM\n3. Monday, Jun 2, 11:00 AM",
    decision: "unclear",
    slotIndex: 0,
    reasoning: "Requesting different week — human should re-propose.",
  },
];
