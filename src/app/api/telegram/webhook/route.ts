import { NextRequest, NextResponse } from "next/server";
import { env, validateEnv } from "@/lib/env";
import { getBonusRecord, updateBonusRecord } from "@/lib/kv";

// --- Telegram API Helpers ---

async function tg(method: string, body: Record<string, unknown>) {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return response.json();
}

async function checkMembership(userId: number) {
    const res = await tg("getChatMember", {
        chat_id: env.CHANNEL_ID,
        user_id: userId,
    });

    if (res.ok && ["member", "administrator", "creator"].includes(res.result.status)) {
        return true;
    }
    return false;
}

// --- Webhook Handler ---

export async function POST(req: NextRequest) {
    try {
        validateEnv();
        const update = await req.json();

        if (update.message) {
            const { message } = update;
            const text = message.text || "";
            const userId = message.from.id;

            if (text.startsWith("/start")) {
                const token = text.split(" ")[1];

                if (!token) {
                    await tg("sendMessage", {
                        chat_id: message.chat.id,
                        text: "Welcome! To verify your membership and claim your bonus, please use the link provided in the Livechat.",
                    });
                    return NextResponse.json({ ok: true });
                }

                const record = await getBonusRecord(token);
                const now = Math.floor(Date.now() / 1000);

                if (!record || record.expiresAt < now) {
                    await tg("sendMessage", {
                        chat_id: message.chat.id,
                        text: "❌ Verification link expired. Please restart from Livechat.",
                    });
                    return NextResponse.json({ ok: true });
                }

                const isMember = await checkMembership(userId);

                if (isMember) {
                    await updateBonusRecord(token, { verified: true, telegramUserId: userId });
                    await tg("sendMessage", {
                        chat_id: message.chat.id,
                        text: "✅ Verification successful.\nReturn to Livechat to claim your bonus.",
                    });
                } else {
                    await tg("sendMessage", {
                        chat_id: message.chat.id,
                        text: "❌ You are not following our Telegram channel.\nPlease join and tap Re-check.",
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "Join Channel", url: `https://t.me/${env.CHANNEL_ID.replace("-100", "")}` }, // Attempt to make a link if it's a public channel ID style, otherwise user should already have it. 
                                    { text: "Re-check", callback_data: `recheck:${token}` }
                                ]
                            ]
                        }
                    });
                }
            }
        } else if (update.callback_query) {
            const { callback_query } = update;
            const data = callback_query.data;
            const userId = callback_query.from.id;

            if (data.startsWith("recheck:")) {
                const token = data.split(":")[1];
                const record = await getBonusRecord(token);
                const now = Math.floor(Date.now() / 1000);

                if (!record || record.expiresAt < now) {
                    await tg("answerCallbackQuery", { callback_query_id: callback_query.id, text: "Verification expired.", show_alert: true });
                    await tg("editMessageText", {
                        chat_id: callback_query.message.chat.id,
                        message_id: callback_query.message.message_id,
                        text: "❌ Verification link expired. Please restart from Livechat.",
                    });
                    return NextResponse.json({ ok: true });
                }

                const isMember = await checkMembership(userId);

                if (isMember) {
                    await updateBonusRecord(token, { verified: true, telegramUserId: userId });
                    await tg("answerCallbackQuery", { callback_query_id: callback_query.id, text: "Verified!" });
                    await tg("editMessageText", {
                        chat_id: callback_query.message.chat.id,
                        message_id: callback_query.message.message_id,
                        text: "✅ Verification successful.\nReturn to Livechat to claim your bonus.",
                    });
                } else {
                    await tg("answerCallbackQuery", {
                        callback_query_id: callback_query.id,
                        text: "Still not a member. Join the channel first."
                    });
                }
            } else {
                await tg("answerCallbackQuery", { callback_query_id: callback_query.id });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error in /api/telegram/webhook:", error);
        return NextResponse.json({ ok: true }); // Telegram likes 200 OK even on errors to stop retries
    }
}
