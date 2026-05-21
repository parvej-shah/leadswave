import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { generateText } from "@/lib/gemini";
import { getAvailableSlots, createEvent, Slot } from "@/lib/calendar/client";
import { InboxState } from "../graph";
import { Resend } from "resend";

const MEETING_KEYWORDS = /\b(yes|interested|let'?s (talk|chat|meet|connect)|call|meeting|schedule|when are you free|available|book|hop on|demo|sounds good)\b/i;

function formatSlot(slot: Slot): string {
  return slot.start.toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

async function tryBookMeeting(
  state: InboxState,
  settings: { googleClientId: string; googleClientSecret: string; googleRefreshToken: string; calendarId: string | null; resendApiKey: string | null; fromEmail: string | null; fromName: string | null },
): Promise<boolean> {
  const slots = await getAvailableSlots(
    settings.googleClientId,
    settings.googleClientSecret,
    settings.googleRefreshToken,
    settings.calendarId ?? "primary",
  ).catch(() => [] as Slot[]);

  if (slots.length === 0) return false;

  // Check if we already sent slot proposals — use the most recent one
  const priorSlotProposal = state.priorMessages
    .filter(m => m.direction === "outbound" && m.subject?.startsWith("Re: Let's connect"))
    .at(-1)?.body ?? "";

  const slotListForCheck = slots.slice(0, 3).map((s, i) => `${i + 1}. ${formatSlot(s)}`).join("\n");

  const confirmCheckPrompt = `A lead replied to a B2B outreach email.
${priorSlotProposal
    ? `We already proposed these meeting times:\n${priorSlotProposal}`
    : `Available slots we could propose:\n${slotListForCheck}`}

Their latest reply: "${state.inboundEmail.body}"

Is this reply CONFIRMING they want to book (e.g. "option 1", "yes", "that works", "let's do it"), or just expressing general interest for the first time?
Respond JSON: {"confirming": true/false, "slotIndex": 0}  (slotIndex 0-based: which slot they picked, default 0 if unclear)`;

  // Fast regex check first — catches "option 1/2/3", "that works", "let's do it", etc.
  const CONFIRM_REGEX = /\b(option\s*[123one two three]|that works|let'?s (do it|confirm|book|go with)|sounds (great|perfect|good)|confirmed?|perfect|i'?ll take|slot [123]|works (for me|perfectly|great))\b/i;
  const SLOT_REGEX = /\b(option\s*|slot\s*)?([123]|one|two|three)\b/i;

  let isConfirmation = priorSlotProposal ? CONFIRM_REGEX.test(state.inboundEmail.body) : false;
  let slotIndex = 0;

  if (isConfirmation) {
    const slotMatch = state.inboundEmail.body.match(SLOT_REGEX);
    if (slotMatch) {
      const raw = slotMatch[2].toLowerCase();
      slotIndex = raw === "2" || raw === "two" ? 1 : raw === "3" || raw === "three" ? 2 : 0;
    }
  }

  // Fall back to AI if regex didn't match and we have a prior proposal
  if (!isConfirmation && priorSlotProposal) {
    try {
      const raw = await generateText(confirmCheckPrompt);
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as { confirming: boolean; slotIndex: number };
        isConfirmation = parsed.confirming === true;
        slotIndex = Math.max(0, Math.min(2, parsed.slotIndex ?? 0));
      }
    } catch { /* quota exhausted or error — regex result stands */ }
  }

  if (isConfirmation) {
    const slot = slots[slotIndex] ?? slots[0];
    const title = `Meeting with ${state.lead.companyName}`;

    const event = await createEvent(
      settings.googleClientId,
      settings.googleClientSecret,
      settings.googleRefreshToken,
      settings.calendarId ?? "primary",
      slot,
      title,
      state.lead.email!,
    ).catch(() => null);

    if (event) {
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

      await db.lead.update({
        where: { id: state.leadId },
        data: { state: "meeting_booked", lastTouchedAt: new Date() },
      });

      // Send confirmation email
      if (settings.resendApiKey && settings.fromEmail && state.lead.email) {
        const resend = new Resend(settings.resendApiKey);
        const from = settings.fromName
          ? `${settings.fromName} <${settings.fromEmail}>`
          : settings.fromEmail;
        const body = [
          `Great news! I've scheduled our meeting for ${formatSlot(slot)}.`,
          event.meetLink ? `\nGoogle Meet link: ${event.meetLink}` : "",
          "\nLooking forward to speaking with you!",
        ]
          .filter(Boolean)
          .join("");

        await resend.emails.send({
          from,
          to: state.lead.email,
          subject: `Meeting confirmed – ${title}`,
          text: body,
        }).catch(() => null);

        await db.message.create({
          data: { leadId: state.leadId, direction: "outbound", subject: `Meeting confirmed – ${title}`, body },
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
  }

  // Propose available slots — draft and send the email automatically
  const slotList = slots
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${formatSlot(s)}`)
    .join("\n");

  const draftPrompt = `You are a B2B sales rep. The lead has expressed interest in a meeting.
Propose these 3 time slots in a friendly 2-3 sentence message. Be concise.
Company: ${state.lead.companyName}
Available slots:
${slotList}
Return ONLY the email body — no subject, no greeting/sign-off.`;

  const draft = await generateText(draftPrompt).catch(
    () => `I'd love to set up a call! Here are a few times that work for me:\n\n${slotList}\n\nLet me know which works best.`,
  );

  const subject = `Re: Let's connect – ${state.lead.companyName}`;

  // Send the slot proposal email automatically
  if (settings.resendApiKey && settings.fromEmail && state.lead.email) {
    const resend = new Resend(settings.resendApiKey);
    const from = settings.fromName ? `${settings.fromName} <${settings.fromEmail}>` : settings.fromEmail;
    await resend.emails.send({ from, to: state.lead.email, subject, text: draft }).catch(() => null);
  }

  await db.message.create({
    data: {
      leadId: state.leadId,
      direction: "outbound",
      subject,
      body: draft,
    },
  });

  return false;
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
  let meetingBooked = false;

  if (hasMeetingIntent) {
    const settings = await db.settings.findFirst({
      where: {
        googleClientId: { not: null },
        googleClientSecret: { not: null },
        googleRefreshToken: { not: null },
      },
      select: {
        googleClientId: true,
        googleClientSecret: true,
        googleRefreshToken: true,
        calendarId: true,
        resendApiKey: true,
        fromEmail: true,
        fromName: true,
      },
    });

    if (settings?.googleClientId && settings?.googleClientSecret && settings?.googleRefreshToken) {
      meetingBooked = await tryBookMeeting(state, {
        ...settings,
        googleClientId: settings.googleClientId,
        googleClientSecret: settings.googleClientSecret,
        googleRefreshToken: settings.googleRefreshToken,
      });
    }
  }

  if (!meetingBooked && state.telegramChatId) {
    const snippet = state.inboundEmail.body.slice(0, 200).replace(/\n/g, " ").trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    await sendTelegramMessage(
      state.telegramChatId,
      `🔥 <b>HOT LEAD: ${state.lead.companyName}</b>\nThey said: <i>${snippet}</i>\n→ Reply now: ${appUrl}/inbox`,
    );
  }

  return {};
}
