import { getAvailableSlots, createEvent } from "../lib/calendar/client";
import { db } from "../lib/db";

async function main() {
  const settings = await db.settings.findFirst({
    where: { googleRefreshToken: { not: null } },
    select: { googleClientId: true, googleClientSecret: true, googleRefreshToken: true, calendarId: true },
  });

  if (!settings?.googleClientId || !settings?.googleClientSecret || !settings?.googleRefreshToken) {
    console.error("No settings with refresh token found");
    process.exit(1);
  }

  console.log("Fetching available slots...");
  try {
    const slots = await getAvailableSlots(
      settings.googleClientId,
      settings.googleClientSecret,
      settings.googleRefreshToken,
      settings.calendarId ?? "primary",
    );
    console.log("Slots found:", slots.length);
    slots.forEach((s, i) => console.log(`  ${i + 1}. ${s.start.toISOString()} – ${s.end.toISOString()}`));

    if (slots.length > 0 && process.argv[2] === "--book") {
      console.log("\nBooking test event with slot 1...");
      const event = await createEvent(
        settings.googleClientId,
        settings.googleClientSecret,
        settings.googleRefreshToken,
        settings.calendarId ?? "primary",
        slots[0],
        "Test Meeting – LeadsWave",
        "bsse1610@iit.du.ac.bd",
      );
      console.log("Event created:", event.eventId);
      console.log("Meet link:", event.meetLink);
      console.log("HTML link:", event.htmlLink);
    }
  } catch (e: any) {
    console.error("ERROR:", e.message);
    if (e.response?.data) console.error("API error:", JSON.stringify(e.response.data, null, 2));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
