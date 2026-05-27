-- Add notification preference fields to Settings
ALTER TABLE "Settings" ADD COLUMN "notifyHotOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "notifyEmailDigest" BOOLEAN NOT NULL DEFAULT false;
