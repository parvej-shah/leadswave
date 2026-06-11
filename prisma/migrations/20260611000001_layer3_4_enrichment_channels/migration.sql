-- Layer 3: third-party enrichment provider settings
ALTER TABLE "Settings" ADD COLUMN "enrichmentProvider" TEXT DEFAULT 'hunter';
ALTER TABLE "Settings" ADD COLUMN "enrichmentApiKey" TEXT;

-- Layer 4: alternative contact channels
ALTER TABLE "Lead" ADD COLUMN "hasContactForm" BOOLEAN;
ALTER TABLE "Lead" ADD COLUMN "facebookUrl" TEXT;
