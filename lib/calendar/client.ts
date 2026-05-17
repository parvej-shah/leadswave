import { google } from "googleapis";

export type Slot = {
  start: Date;
  end: Date;
};

export type CreatedEvent = {
  eventId: string;
  meetLink: string | null;
  start: Date;
  end: Date;
  htmlLink: string | null;
};

function buildAuth(clientId: string, clientSecret: string, refreshToken: string) {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

/**
 * Returns up to `count` free 30-min slots within the next `days` weekdays,
 * between 9am and 5pm.
 */
export async function getAvailableSlots(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  calendarId = "primary",
  days = 5,
  count = 3,
): Promise<Slot[]> {
  const auth = buildAuth(clientId, clientSecret, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setHours(now.getHours() + 1, 0, 0, 0);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + days);
  timeMax.setHours(17, 0, 0, 0);

  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busy = (freebusy.data.calendars?.[calendarId]?.busy ?? []).map((b) => ({
    start: new Date(b.start!),
    end: new Date(b.end!),
  }));

  const slots: Slot[] = [];
  const cursor = new Date(timeMin);
  cursor.setMinutes(0, 0, 0);

  while (slots.length < count && cursor < timeMax) {
    const day = cursor.getDay();
    const hour = cursor.getHours();

    if (day === 0 || day === 6) {
      cursor.setDate(cursor.getDate() + (day === 6 ? 2 : 1));
      cursor.setHours(9, 0, 0, 0);
      continue;
    }
    if (hour < 9) { cursor.setHours(9, 0, 0, 0); continue; }
    if (hour >= 17) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(9, 0, 0, 0); continue; }

    const slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
    const overlaps = busy.some((b) => cursor < b.end && slotEnd > b.start);
    if (!overlaps) slots.push({ start: new Date(cursor), end: new Date(slotEnd) });

    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  return slots;
}

export async function createEvent(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  calendarId = "primary",
  slot: Slot,
  title: string,
  attendeeEmail: string,
): Promise<CreatedEvent> {
  const auth = buildAuth(clientId, clientSecret, refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendNotifications: true,
    requestBody: {
      summary: title,
      start: { dateTime: slot.start.toISOString() },
      end: { dateTime: slot.end.toISOString() },
      attendees: [{ email: attendeeEmail }],
      conferenceData: {
        createRequest: {
          requestId: `lw-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const meetLink =
    event.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;

  return {
    eventId: event.data.id!,
    meetLink,
    start: new Date(event.data.start!.dateTime!),
    end: new Date(event.data.end!.dateTime!),
    htmlLink: event.data.htmlLink ?? null,
  };
}
