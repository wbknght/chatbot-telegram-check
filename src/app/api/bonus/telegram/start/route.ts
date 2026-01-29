import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { env, validateEnv } from "@/lib/env";
import { setBonusRecord } from "@/lib/kv";

// GET handler for Livechat webhook validation
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const challenge = searchParams.get("challenge");

    if (challenge) {
        // Echo back the challenge for webhook validation
        return new NextResponse(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    return NextResponse.json({ status: "ok" });
}

export async function POST(req: NextRequest) {
    try {
        validateEnv();

        const authHeader = req.headers.get("x-livechat-token") || req.headers.get("verification-token");

        if (authHeader !== env.LIVECHAT_WEBHOOK_TOKEN) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = randomBytes(16).toString("hex"); // 32 chars
        const now = Math.floor(Date.now() / 1000);
        const ttl = 600;
        const expiresAt = now + ttl;

        await setBonusRecord(token, {
            verified: false,
            createdAt: now,
            expiresAt: expiresAt,
            telegramUserId: null,
        }, ttl);

        const telegramUrl = `https://t.me/${env.BOT_USERNAME}?start=${token}`;

        // ChatBot.com webhook response format
        // Returns attributes that can be used in the chatbot flow
        return NextResponse.json({
            attributes: {
                bonus_code: token,
                telegram_link: telegramUrl,
                expires_in: String(ttl),
            }
        });
    } catch (error) {
        console.error("Error in /api/bonus/telegram/start:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
