export const env = {
  BOT_USERNAME: process.env.BOT_USERNAME!,
  BOT_TOKEN: process.env.BOT_TOKEN!,
  CHANNEL_ID: process.env.CHANNEL_ID!,
  CHANNEL_USERNAME: process.env.CHANNEL_USERNAME || "", // Optional: for Join Channel button
  LIVECHAT_WEBHOOK_TOKEN: process.env.LIVECHAT_WEBHOOK_TOKEN!,
  KV_REST_API_URL: process.env.KV_REST_API_URL!,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN!,
};

const requiredEnvVars = [
  "BOT_USERNAME",
  "BOT_TOKEN",
  "CHANNEL_ID",
  "LIVECHAT_WEBHOOK_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}
