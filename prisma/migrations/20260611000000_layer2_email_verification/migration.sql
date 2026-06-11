-- Layer 2: email verification provenance
ALTER TABLE "Lead" ADD COLUMN "emailSource" TEXT;
ALTER TABLE "Lead" ADD COLUMN "emailStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "Settings" ADD COLUMN "emailVerifierApiKey" TEXT;
