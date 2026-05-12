import { Queue } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const scoutQueue = new Queue("scout", { connection });
export const outreachQueue = new Queue("outreach", { connection });
export const followupQueue = new Queue("followup", { connection });
