import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { generateText } from "@/lib/gemini";
import { getAvailableSlots, createEvent, Slot } from "@/lib/calendar/client";
import { BOOKING_EXAMPLES } from "@/lib/ai/training/inbox-examples";
import { InboxState } from "../graph";
import { Resend } from "resend";

const MEETING_KEYWORDS = /\b(yes|interested|let'?s (talk|chat|meet|connect)|call|meeting|schedule|when are you free|available|book|hop on|demo|sounds good|option\s*[123]|slot\s*[123]|that works|confirm)\b/i;

function formatSlot(slot: Slot): string {
  return slot.start.toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
  });
}

function buildBookingFewShot(): string {
  return BOOKING_EXAMPLES.map((ex, i) =>
    [
      `Example ${i + 1}:`,
      `Reply: "${ex.reply}"`,
      ex.priorSlots ? `Prior slots proposed:\n${ex.priorSlots}` : "Prior slots: (none yet)",
      `Output: {"decision":"${ex.decision}","slotIndex":${ex.slotIndex},"reasoning":"${ex.reasoning}"}`,
    ].join("\n")
  ).join("\n\n");
}

type BookingDecision = {
  decision: "confirm" | "propose" | "unclear";
  slotIndex: number;
  reasoning: string;
};

async function getBookingDecision(
  replyBody: string,
  priorSlotProposal: string,
  companyName: string,
  availableSlots: Slot[],
): Promise<BookingDecision> {
  const slotList = availableSlots.slice(0, 3).map((s, i) => `${i + 1}. ${formatSlot(s)}`).join("\n");

  const prompt = [
    `You are a booking assistant for B2B sales. Decide what to do with this reply from ${companyName}.`,
    "",
    "Decisions:",
    '- "confirm": They accepted a specific slot. Book it immediately.',
    '- "propose": They want to meet but no slots offered yet. Propose the available slots.',
    '- "unclear": Cannot determine — ask the human via Telegram for guidance.',
    "",
    "=== FEW-SHOT EXAMPLES ===",
    buildBookingFewShot(),
    "",
    "=== NOW DECIDE ===",
    `Company: ${companyName}`,
    `Their reply: "${replyBody}"`,
    priorSlotProposal
      ? `Slots we already proposed:\n${priorSlotProposal}`
      : `No slots proposed yet. Available slots:\n${slotList}`,
    "",
    'Respond ONLY with JSON: {"decision":"confirm|propose|unclear","slotIndex":0,"reasoning":"<one sentence>"}',
    "(slotIndex is 0-based: 0=first slot, 1=second, 2=third)",
  ].join("\n");

  try {
    const raw = await generateText(prompt);
    const m = raw.match(/\{[\s\S]*?\}/);
    if (m) {
      const parsed = JSON.parse(m[0]) as BookingDecision;
      if (["confirm", "propose", "unclear"].includes(parsed.decision)) {
        console.log(`[hot/booking] decision=${parsed.decision} slot=${parsed.slotIndex} | ${parsed.reasoning}`);
        return parsed;
      }
    }
  } catch (err) {
    console.error("[hot/booking] AI error:", err);
  }

  // AI failed — default to propose if no prior slots, unclear if slots exist
  return {
    decision: priorSlotProposal ? "unclear" : "propose",
    slotIndex: 0,
    reasoning: "AI unavailable — defaulting to safe action",
  };
}

async function sendEmail(
  settings: { resendApiKey: string; fromEmail: string; fromName: string | null },
  to: string,
  subject: string,
  body: string,
) {
  const resend = new Resend(settings.resendApiKey);
  const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
  await resend.emails.send({ from, to, subject, text: body }).catch(() => null);
}

async function bookMeeting(
  state: InboxState,
  slot: Slot,
  settings: {
    googleClientId: string; googleClientSecret: string; googleRefreshToken: string;
    calendarId: string | null; resendApiKey: string | null; fromEmail: string | null; fromName: string | null;
  },
) {
  const title = `Meeting with ${state.lead.companyName}`;

  const event = await createEvent(
    settings.googleClientId, settings.googleClientSecret, settings.googleRefreshToken,
    settings.calendarId ?? "primary", slot, title, state.lead.email!,
  ).catch((err) => { console.error("[hot] Calendar error:", err); return null; });

  if (!event) return false;

  await db.calendarEvent.create({
    data: {
      leadId: state.leadId,
      googleEventId: event.eventId,
      meetLink: event.meetLink,
      startTime: event.start,
      endTime: event.end,
      title,
    },
  });

  await db.lead.update({ where: { id: state.leadId }, data: { state: "meeting_booked", lastTouchedAt: new Date() } });

  const confirmBody = [
    `Great — I've booked our meeting for ${formatSlot(slot)}.`,
    event.meetLink ? `\nGoogle Meet: ${event.meetLink}` : "",
    "\nLooking forward to speaking with you!",
  ].filter(Boolean).join("");

  if (settings.resendApiKey && settings.fromEmail && state.lead.email) {
    await sendEmail(
      { resendApiKey: settings.resendApiKey, fromEmail: settings.fromEmail, fromName: settings.fromName ?? null },
      state.lead.email,
      `Meeting confirmed – ${title}`,
      confirmBody,
    );
    await db.message.create({
      data: { leadId: state.leadId, direction: "outbound", subject: `Meeting confirmed – ${title}`, body: confirmBody },
    });
  }

  if (state.telegramChatId) {
    await sendTelegramMessage(
      state.telegramChatId,
      `📅 <b>Meeting booked with ${state.lead.companyName}</b>\n${formatSlot(slot)}${event.meetLink ? `\nGoogle Meet: ${event.meetLink}` : ""}`,
    );
  }

  return true;
}

async function proposeSlots(
  state: InboxState,
  slots: Slot[],
  settings: { resendApiKey: string | null; fromEmail: string | null; fromName: string | null },
) {
  const slotList = slots.slice(0, 3).map((s, i) => `${i + 1}. ${formatSlot(s)}`).join("\n");

  const draftPrompt = `You are a B2B sales rep. The lead wants to meet.
Propose these 3 time slots in a friendly 2-sentence message. Be warm and concise.
Company: ${state.lead.companyName}
Slots:\n${slotList}
Return ONLY the email body — no subject, no sign-off.`;

  const draft = await generateText(draftPrompt).catch(
    () => `I'd love to connect! Here are a few times that work:\n\n${slotList}\n\nLet me know which suits you.`,
  );

  const subject = `Re: Let's connect – ${state.lead.companyName}`;
  const body = `${draft}\n\n— ${settings.fromName ?? "The team"}`;

  if (settings.resendApiKey && settings.fromEmail && state.lead.email) {
    await sendEmail(
      { resendApiKey: settings.resendApiKey, fromEmail: settings.fromEmail, fromName: settings.fromName ?? null },
      state.lead.email, subject, body,
    );
  }

  await db.message.create({ data: { leadId: state.leadId, direction: "outbound", subject, body } });
  console.log(`[hot] Slot proposal sent to ${state.lead.companyName}`);
}

async function askHumanViaTelegram(
  state: InboxState,
  decisionReason: string,
  slots: Slot[],
  chatId: string,
) {
  const slotList = slots.slice(0, 3).map((s, i) => `${i + 1}. ${formatSlot(s)}`).join("\n");
  const snippet = state.inboundEmail.body.slice(0, 200).replace(/\n/g, " ");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Save pending confirmation for the Telegram handler to act on
  const pending = await db.pendingConfirmation.create({
    data: {
      leadId: state.leadId,
      type: "booking",
      context: JSON.stringify({
        companyName: state.lead.companyName,
        email: state.lead.email,
        slots: slots.slice(0, 3).map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
        inboundBody: state.inboundEmail.body,
      }),
      status: "pending",
    },
  });

  await sendTelegramMessage(
    chatId,
    [
      `🤔 <b>Need your input — ${state.lead.companyName}</b>`,
      `They said: <i>"${snippet}"</i>`,
      ``,
      `AI couldn't decide: ${decisionReason}`,
      ``,
      `Available slots:`,
      slotList,
      ``,
      `Reply with:`,
      `/confirm_${pending.id}_0 — book slot 1`,
      `/confirm_${pending.id}_1 — book slot 2`,
      `/confirm_${pending.id}_2 — book slot 3`,
      `/skip_${pending.id} — skip, handle manually`,
      ``,
      `Or go to: ${appUrl}/inbox`,
    ].join("\n"),
  );
}

export async function hotNode(state: InboxState): Promise<Partial<InboxState>> {
  await db.lead.update({
    where: { id: state.leadId },
    data: { state: "replied", lastTouchedAt: new Date() },
  });
  await db.job.updateMany({
    where: { leadId: state.leadId, status: "pending" },
    data: { status: "cancelled" },
  });

  const hasMeetingIntent = MEETING_KEYWORDS.test(state.inboundEmail.body);
  if (!hasMeetingIntent) {
    // Hot but no meeting intent — just ping Telegram
    if (state.telegramChatId) {
      const snippet = state.inboundEmail.body.slice(0, 200).replace(/\n/g, " ");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await sendTelegramMessage(
        state.telegramChatId,
        `🔥 <b>HOT LEAD: ${state.lead.companyName}</b>\nThey said: <i>${snippet}</i>\n→ ${appUrl}/inbox`,
      );
    }
    return {};
  }

  // Load Google Calendar settings
  const settings = await db.settings.findFirst({
    where: { googleClientId: { not: null }, googleClientSecret: { not: null }, googleRefreshToken: { not: null } },
    select: {
      googleClientId: true, googleClientSecret: true, googleRefreshToken: true,
      calendarId: true, resendApiKey: true, fromEmail: true, fromName: true,
    },
  });

  if (!settings?.googleClientId || !settings.googleClientSecret || !settings.googleRefreshToken) {
    // No calendar — just notify
    if (state.telegramChatId) {
      const snippet = state.inboundEmail.body.slice(0, 200).replace(/\n/g, " ");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      await sendTelegramMessage(
        state.telegramChatId,
        `🔥 <b>HOT LEAD: ${state.lead.companyName}</b>\nThey said: <i>${snippet}</i>\n(Connect Google Calendar in settings to auto-book)\n→ ${appUrl}/inbox`,
      );
    }
    return {};
  }

  const slots = await getAvailableSlots(
    settings.googleClientId, settings.googleClientSecret, settings.googleRefreshToken,
    settings.calendarId ?? "primary",
  ).catch(() => [] as Slot[]);

  const priorSlotProposal = state.priorMessages
    .filter((m) => m.direction === "outbound" && m.subject?.startsWith("Re: Let's connect"))
    .at(-1)?.body ?? "";

  if (slots.length === 0) {
    if (state.telegramChatId) {
      await sendTelegramMessage(
        state.telegramChatId,
        `🔥 <b>HOT LEAD: ${state.lead.companyName}</b> wants to meet but your calendar has no free slots in the next 5 days. Handle manually.`,
      );
    }
    return {};
  }

  // Ask AI what to do
  const decision = await getBookingDecision(
    state.inboundEmail.body,
    priorSlotProposal,
    state.lead.companyName,
    slots,
  );

  if (decision.decision === "confirm") {
    const slot = slots[decision.slotIndex] ?? slots[0];
    await bookMeeting(state, slot, {
      ...settings,
      googleClientId: settings.googleClientId!,
      googleClientSecret: settings.googleClientSecret!,
      googleRefreshToken: settings.googleRefreshToken!,
    });
    return {};
  }

  if (decision.decision === "propose") {
    await proposeSlots(state, slots, settings);
    if (state.telegramChatId) {
      await sendTelegramMessage(
        state.telegramChatId,
        `🔥 <b>HOT LEAD: ${state.lead.companyName}</b>\nThey want to meet — slot proposal sent automatically.`,
      );
    }
    return {};
  }

  // unclear — ask human via Telegram
  if (state.telegramChatId) {
    await askHumanViaTelegram(state, decision.reasoning, slots, state.telegramChatId);
  }

  return {};
}
