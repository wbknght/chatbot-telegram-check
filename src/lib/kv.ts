import { kv } from "@vercel/kv";

export interface BonusRecord {
    verified: boolean;
    createdAt: number;
    expiresAt: number;
    telegramUserId: number | null;
}

const KEY_PREFIX = "tg_bonus";

export async function getBonusRecord(token: string): Promise<BonusRecord | null> {
    return await kv.get<BonusRecord>(`${KEY_PREFIX}:${token}`);
}

export async function setBonusRecord(token: string, data: BonusRecord, ttl: number = 600): Promise<void> {
    await kv.set(`${KEY_PREFIX}:${token}`, data, { ex: ttl });
}

export async function updateBonusRecord(token: string, data: Partial<BonusRecord>): Promise<void> {
    const existing = await getBonusRecord(token);
    if (!existing) return;

    const updated = { ...existing, ...data };
    // We need to maintain the same expiry if we are just updating, 
    // but Vercel KV set with object might not preserve TTL unless we re-fetch remaining TTL or just use the original expiresAt.
    // To keep it simple, we'll just set it again. The request expiresAt is in the data.
    const now = Math.floor(Date.now() / 1000);
    const ttl = updated.expiresAt - now;

    if (ttl > 0) {
        await kv.set(`${KEY_PREFIX}:${token}`, updated, { ex: ttl });
    }
}
