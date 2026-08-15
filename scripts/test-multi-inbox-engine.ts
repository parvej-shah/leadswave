import { db } from "../lib/db";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import { generateUnsubscribeToken, verifyUnsubscribeToken } from "../lib/email/unsubscribe";
import { sendOutboundEmail } from "../lib/email/send";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING LEADSWAVE MULTI-INBOX ENGINE TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${extra || ""}`);
      failed++;
    }
  }

  // Find or create test organization
  const testOrg = await db.organization.findFirst({
    where: { name: "XpeedLab" },
  }) || await db.organization.create({
    data: { name: "Test Org" },
  });

  const orgId = testOrg.id;

  // TEST 1: Password encryption & decryption roundtrip
  const testPassword = "abcd efgh ijkl mnop";
  const encrypted = encryptSecret(testPassword);
  assert("Password is encrypted with prefix", encrypted !== testPassword && (encrypted?.startsWith("enc:v1:") ?? false));
  const decrypted = decryptSecret(encrypted);
  assert("Decrypted password matches original", decrypted === testPassword);

  // TEST 2: Unsubscribe HMAC token generation & verification
  const testEmail = "prospect@example.com";
  const token = generateUnsubscribeToken({ orgId, email: testEmail });
  assert("Generated token is valid string format", typeof token === "string" && token.includes("."));
  const payload = verifyUnsubscribeToken(token);
  assert("Verified token payload matches email and orgId", payload?.email === testEmail && payload?.orgId === orgId);
  const tamperedToken = token + "bad";
  assert("Tampered token fails verification", verifyUnsubscribeToken(tamperedToken) === null);

  // TEST 3: SenderInbox creation & daily limit tracking
  const inboxA = await db.senderInbox.upsert({
    where: { orgId_fromEmail: { orgId, fromEmail: "test-a@withminions.com" } },
    create: {
      orgId,
      name: "Test Inbox A",
      fromEmail: "test-a@withminions.com",
      fromName: "Test Sender A",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpUser: "test-a@withminions.com",
      smtpPassEncrypted: encryptSecret("mock-app-pass-1")!,
      dailyLimit: 2,
      sentToday: 0,
      isActive: true,
    },
    update: {
      dailyLimit: 2,
      sentToday: 0,
      isActive: true,
    },
  });

  const inboxB = await db.senderInbox.upsert({
    where: { orgId_fromEmail: { orgId, fromEmail: "test-b@withminions.com" } },
    create: {
      orgId,
      name: "Test Inbox B",
      fromEmail: "test-b@withminions.com",
      fromName: "Test Sender B",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      smtpUser: "test-b@withminions.com",
      smtpPassEncrypted: encryptSecret("mock-app-pass-2")!,
      dailyLimit: 2,
      sentToday: 0,
      isActive: true,
    },
    update: {
      dailyLimit: 2,
      sentToday: 0,
      isActive: true,
    },
  });

  assert("Created Inbox A with limit 2", inboxA.dailyLimit === 2);
  assert("Created Inbox B with limit 2", inboxB.dailyLimit === 2);

  // TEST 4: Suppression block check
  const suppressedEmail = "unsubscribed-lead@example.com";
  await db.suppression.upsert({
    where: { orgId_email: { orgId, email: suppressedEmail } },
    create: { orgId, email: suppressedEmail, reason: "unsubscribed" },
    update: { reason: "unsubscribed" },
  });

  const suppressedResult = await sendOutboundEmail({
    orgId,
    to: suppressedEmail,
    subject: "Hello",
    text: "Testing suppression",
  });

  assert("Suppressed recipient is blocked from sending", suppressedResult.suppressed === true && suppressedResult.success === false);

  // Clean up mock test records
  await db.suppression.deleteMany({
    where: { orgId, email: suppressedEmail },
  });
  await db.senderInbox.deleteMany({
    where: { orgId, fromEmail: { in: ["test-a@withminions.com", "test-b@withminions.com"] } },
  });

  console.log("\n==================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
