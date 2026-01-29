import { NextRequest, NextResponse } from "next/server";
import { getBonusRecord } from "@/lib/kv";
import { env, validateEnv } from "@/lib/env";

// ChatBot.com sends verification token as query param: ?token=YOUR_TOKEN
function verifyWebhookToken(req: NextRequest): boolean {
    const { searchParams } = new URL(req.url);
    const receivedToken = searchParams.get("token");

    // If no LIVECHAT_WEBHOOK_TOKEN is set, skip verification
    if (!env.LIVECHAT_WEBHOOK_TOKEN) {
        return true;
    }

    return receivedToken === env.LIVECHAT_WEBHOOK_TOKEN;
}

// GET handler for ChatBot.com webhook validation AND status checks
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const challenge = searchParams.get("challenge");
        const bonusCode = searchParams.get("bonus_code");

        // If challenge is present, this is a ChatBot.com validation request
        if (challenge) {
            // Verify the webhook token
            if (!verifyWebhookToken(req)) {
                return new NextResponse("Unauthorized", { status: 401 });
            }
            // Return the challenge as plain text
            return new NextResponse(challenge, {
                status: 200,
                headers: { "Content-Type": "text/plain" },
            });
        }

        // Otherwise, this is a status check request
        // The bonus_code can come from query param
        if (!bonusCode) {
            return NextResponse.json({
                attributes: {
                    verified: "false",
                    error: "bonus_code required"
                }
            });
        }

        const record = await getBonusRecord(bonusCode);

        if (!record) {
            return NextResponse.json({
                attributes: {
                    verified: "false",
                    status: "not_found"
                }
            });
        }

        const now = Math.floor(Date.now() / 1000);
        if (record.expiresAt < now) {
            return NextResponse.json({
                attributes: {
                    verified: "false",
                    status: "expired"
                }
            });
        }

        return NextResponse.json({
            attributes: {
                verified: record.verified ? "true" : "false",
                status: record.verified ? "success" : "pending"
            }
        });
    } catch (error) {
        console.error("Error in /api/bonus/telegram/status GET:", error);
        return NextResponse.json({
            attributes: {
                verified: "false",
                error: "Internal Server Error"
            }
        }, { status: 500 });
    }
}

// POST handler for ChatBot.com webhook calls
export async function POST(req: NextRequest) {
    try {
        validateEnv();

        // Verify the webhook token from query params
        if (!verifyWebhookToken(req)) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get the bonus_code from request body (ChatBot.com sends attributes)
        const body = await req.json().catch(() => ({}));
        console.log("Status webhook received body:", JSON.stringify(body));

        const bonusCode = body.attributes?.bonus_code;

        if (!bonusCode) {
            return NextResponse.json({
                responses: [
                    {
                        type: "text",
                        message: "❌ Error: Could not find your verification code. Please start over."
                    }
                ],
                attributes: {
                    verified: "false",
                    error: "bonus_code not provided"
                }
            });
        }

        const record = await getBonusRecord(bonusCode);

        if (!record) {
            return NextResponse.json({
                responses: [
                    {
                        type: "text",
                        message: "❌ Verification code not found. Please request a new link."
                    }
                ],
                attributes: {
                    verified: "false",
                    status: "not_found"
                }
            });
        }

        const now = Math.floor(Date.now() / 1000);
        if (record.expiresAt < now) {
            return NextResponse.json({
                responses: [
                    {
                        type: "text",
                        message: "❌ Your verification link has expired. Please request a new one."
                    }
                ],
                attributes: {
                    verified: "false",
                    status: "expired"
                }
            });
        }

        // Return verification status in ChatBot.com format
        if (record.verified) {
            return NextResponse.json({
                responses: [
                    {
                        type: "text",
                        message: "✅ Great! Your Telegram membership has been verified. You can now claim your bonus!"
                    }
                ],
                attributes: {
                    verified: "true",
                    status: "success"
                }
            });
        } else {
            return NextResponse.json({
                responses: [
                    {
                        type: "text",
                        message: "❌ Verification not complete yet. Please verify in Telegram first, then try again."
                    }
                ],
                attributes: {
                    verified: "false",
                    status: "pending"
                }
            });
        }
    } catch (error) {
        console.error("Error in /api/bonus/telegram/status POST:", error);
        return NextResponse.json({
            responses: [
                {
                    type: "text",
                    message: "❌ An error occurred. Please try again."
                }
            ],
            attributes: {
                verified: "false",
                error: "Internal Server Error"
            }
        }, { status: 500 });
    }
}
