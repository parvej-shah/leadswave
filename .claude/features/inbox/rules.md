# Inbox — rules

- **Never auto-send a warm/drafted reply unless `Settings.autoSendReplies` is true.** Human
  approval is the v1 default. Hot pings and meeting bookings are allowed without that toggle.
- Classification must be deterministic (low temperature). Don't make it chatty.
- A `cold` or `bounce` classification must result in a `Suppression` row — never email again.
- Respect `notifyHotOnly`: when on, suppress warm "has a question" Telegram pings but keep
  HOT and meeting alerts.
- Always load full thread history before classifying/drafting — never reply to a message in
  isolation.
- Booking writes through `lib/calendar/client.ts` using the user's Google refresh token;
  record `CalendarEvent`, and clear/resolve the matching `PendingConfirmation`.
- Inbound matching is by sender email → lead. If no match, don't fabricate a lead silently;
  handle the unmatched case explicitly.
- Persist every inbound and every sent reply as a `Message`.
