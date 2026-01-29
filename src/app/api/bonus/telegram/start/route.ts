import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { env, validateEnv } from "@/lib/env";
import { setBonusRecord } from "@/lib/kv";

// ChatBot.com sends verification token as query param: ?token=YOUR_TOKEN
function verifyToken(req: NextRequest): boolean {
    const { searchParams } = new URL(req.url);
    const receivedToken = searchParams.get("token");

    // If no LIVECHAT_WEBHOOK_TOKEN is set, skip verification (for testing)
    if (!env.LIVECHAT_WEBHOOK_TOKEN) {
        return true;
    }

    return receivedToken === env.LIVECHAT_WEBHOOK_TOKEN;
}

// GET handler for ChatBot.com webhook validation (challenge-response)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const challenge = searchParams.get("challenge");

    // Verify the token from query params
    if (!verifyToken(req)) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    if (challenge) {
        // Return the challenge as plain text (required by ChatBot.com)
        return new NextResponse(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    return NextResponse.json({ status: "ok" });
}

// POST handler for actual webhook calls from ChatBot.com
export async function POST(req: NextRequest) {
    try {
        validateEnv();

        // Verify the token from query params
        if (!verifyToken(req)) {
            console.log("Auth failed - token mismatch");
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Log request body for debugging
        const body = await req.json().catch(() => ({}));
        console.log("Received webhook body:", JSON.stringify(body));

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

        console.log("Webhook success - generated token:", token);

        // ChatBot.com expects: { responses: [...], attributes: {...} }
        return NextResponse.json({
            responses: [
                {
                    type: "text",
                    message: `Click here to verify your Telegram membership: ${telegramUrl}`
                }
            ],
            attributes: {
                bonus_code: token,
                telegram_link: telegramUrl,
                expires_in: String(ttl),
            }
        });
    } catch (error) {
        console.error("Error in /api/bonus/telegram/start:", error);
        return NextResponse.json({
            error: "Internal Server Error",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
