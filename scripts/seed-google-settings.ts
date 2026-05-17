import { db } from "../lib/db";

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in env");
  }

  const updated = await db.settings.updateMany({
    data: { googleClientId: clientId, googleClientSecret: clientSecret },
  });

  console.log(`Updated ${updated.count} settings row(s).`);
  console.log("googleClientId:", clientId.slice(0, 20) + "...");
  console.log("googleClientSecret: SET");
  console.log("\nNext: visit http://localhost:3000/api/auth/google to connect your calendar.");
}
main().catch(e => { console.error(e.message); process.exit(1); });
