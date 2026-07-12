-- Backfills migration history for columns that were previously applied to the
-- database directly via `prisma db push` (migration history had drifted — see
-- .claude/memory.md "2026-06-21" entry) instead of through a tracked migration.
-- Every column below already exists in the live database; this migration only
-- teaches the tracked history about them so `prisma migrate dev`/`deploy` stop
-- flagging drift. Uses IF NOT EXISTS everywhere so it is a safe no-op if a
-- column happens to already be present.

-- Message: rich-text + delivery tracking (added 2026-06-21)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "bodyHtml" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "resendId" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deliveryStatus" TEXT;

-- Settings: signature, OAuth, and additional API key columns (added 2026-06-21)
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "signatureHtml" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "signatureText" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "resendApiKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "firecrawlApiKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "anthropicApiKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "apifyApiKey" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "googleClientId" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "googleClientSecret" TEXT;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "calendarId" TEXT DEFAULT 'primary';

-- Lead: skip re-billing paid enrichment on re-run; quality score
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichmentTriedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL DEFAULT 0;

-- Campaign: per-campaign auto-send toggle
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "autoSend" BOOLEAN NOT NULL DEFAULT false;

-- Campaign: hotspot-area search (this session, 2026-07-12)
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "selectedAreas" JSONB;

-- CalendarEvent: Google Calendar booking tracking
CREATE TABLE IF NOT EXISTS "CalendarEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "meetLink" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PendingConfirmation: awaiting-user-confirmation state for bookings/replies
CREATE TABLE IF NOT EXISTS "PendingConfirmation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingConfirmation_pkey" PRIMARY KEY ("id")
);
