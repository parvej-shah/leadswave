-- Campaign: country + AI-ranked city selection + dual-track offer text
ALTER TABLE "Campaign" ADD COLUMN "country" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "selectedCities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Campaign" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "websiteOffer" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "crmOffer" TEXT;

-- Lead: category + Google Maps metadata
ALTER TABLE "Lead" ADD COLUMN "category" TEXT;
ALTER TABLE "Lead" ADD COLUMN "address" TEXT;
ALTER TABLE "Lead" ADD COLUMN "phone" TEXT;
ALTER TABLE "Lead" ADD COLUMN "rating" DOUBLE PRECISION;
ALTER TABLE "Lead" ADD COLUMN "mapsUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN "placeId" TEXT;

-- Idempotent re-runs: one row per (campaign, place)
CREATE UNIQUE INDEX "Lead_campaignId_placeId_key" ON "Lead"("campaignId", "placeId");

-- Settings: Google Maps (Places API) key
ALTER TABLE "Settings" ADD COLUMN "googleMapsApiKey" TEXT;
