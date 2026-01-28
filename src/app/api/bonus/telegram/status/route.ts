import { NextRequest, NextResponse } from "next/server";
import { getBonusRecord } from "@/lib/kv";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ verified: false, error: "Token required" }, { status: 400 });
        }

        const record = await getBonusRecord(token);

        if (!record) {
            return NextResponse.json({ verified: false });
        }

        const now = Math.floor(Date.now() / 1000);
        if (record.expiresAt < now) {
            return NextResponse.json({ verified: false, expired: true });
        }

        return NextResponse.json({ verified: record.verified });
    } catch (error) {
        console.error("Error in /api/bonus/telegram/status:", error);
        return NextResponse.json({ verified: false, error: "Internal Server Error" }, { status: 500 });
    }
}
