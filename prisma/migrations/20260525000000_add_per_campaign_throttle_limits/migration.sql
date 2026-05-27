-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "perCampaignDailyLimit" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Settings" ADD COLUMN "sendThrottleSeconds" INTEGER NOT NULL DEFAULT 30;
