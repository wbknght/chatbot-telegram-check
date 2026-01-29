import { NextRequest, NextResponse } from "next/server";
import { getBonusRecord } from "@/lib/kv";
import { env, validateEnv } from "@/lib/env";

// ChatBot.com sends verification token as query param: ?token=YOUR_TOKEN
function verifyToken(req: NextRequest): boolean {
    const { searchParams } = new URL(req.url);
    const receivedToken = searchParams.get("token");

    // Check the 'auth' param for ChatBot.com webhook authentication
    const authToken = searchParams.get("auth");

    // If no LIVECHAT_WEBHOOK_TOKEN is set, skip verification
    if (!env.LIVECHAT_WEBHOOK_TOKEN) {
        return true;
    }

    return authToken === env.LIVECHAT_WEBHOOK_TOKEN;
}

// GET handler for status check
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({
                attributes: {
                    verified: "false",
                    error: "Token required"
                }
            }, { status: 400 });
        }

        const record = await getBonusRecord(token);

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

        // ChatBot.com format - return as attributes
        return NextResponse.json({
            attributes: {
                verified: record.verified ? "true" : "false",
                status: record.verified ? "success" : "pending"
            }
        });
    } catch (error) {
        console.error("Error in /api/bonus/telegram/status:", error);
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

        // Verify the auth token from query params
        if (!verifyToken(req)) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get the bonus_code from request body (ChatBot.com sends attributes)
        const body = await req.json().catch(() => ({}));
        const token = body.attributes?.bonus_code;

        if (!token) {
            return NextResponse.json({
                attributes: {
                    verified: "false",
                    error: "bonus_code not provided"
                }
            });
        }

        const record = await getBonusRecord(token);

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
        console.error("Error in /api/bonus/telegram/status:", error);
        return NextResponse.json({
            attributes: {
                verified: "false",
                error: "Internal Server Error"
            }
        }, { status: 500 });
    }
}
