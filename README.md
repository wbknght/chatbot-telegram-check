# Telegram Membership Verification for Livechat

This project provides a simple API to verify users' Telegram channel membership before granting a bonus in Livechat.

## Tech Stack
- Next.js 14+ (App Router)
- Vercel KV (Redis)
- Telegram Bot API

## Environment Variables

Set the following environment variables in Vercel:

```bash
BOT_USERNAME=livechatsbonusbot
BOT_TOKEN=<your_bot_token>
CHANNEL_ID=<your_channel_id> # e.g., -100...
LIVECHAT_WEBHOOK_TOKEN=<shared_secret>

# Vercel KV (automatically added if using Vercel KV integration)
KV_REST_API_URL
KV_REST_API_TOKEN
```

## Setup

### 1. Telegram Webhook
Set your Telegram webhook by visiting the following URL in your browser:
`https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<vercel-domain>/api/telegram/webhook`

### 2. Livechat Integration
Configure your Livechat webhooks to call these endpoints.

## API Endpoints

### 1. Start Verification
`POST /api/bonus/telegram/start`

**Headers:**
`x-livechat-token`: `<LIVECHAT_WEBHOOK_TOKEN>`

**Response:**
```json
{
  "token": "<token>",
  "telegram_url": "https://t.me/livechatsbonusbot?start=<token>",
  "expires_in": 600
}
```

### 2. Check Status
`GET /api/bonus/telegram/status?token=<token>`

**Response:**
```json
{
  "verified": true | false
}
```

## How it Works
1. Livechat calls `/api/bonus/telegram/start`.
2. A unique token is generated and stored in KV with a 600s TTL.
3. Livechat presents the user with the `telegram_url`.
4. User clicks the link, which opens the Telegram bot with the `/start <token>` payload.
5. The bot checks if the user is a member of the configured `CHANNEL_ID`.
6. If the user is a member, the record in KV is marked as `verified: true`.
7. Livechat periodically polls `/api/bonus/telegram/status` to check completion.
