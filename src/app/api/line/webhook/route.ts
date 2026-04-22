import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { writeAuditLog } from '../../../actions/auditActions';
import {
    replyLineMessage,
    findUserByLineUserId,
    consumeLinkCodeFromWebhook,
} from '../../../actions/lineActions';

/**
 * LINE Messaging API webhook endpoint.
 *
 * Phase 1 (foundation): signature verification + audit log per event.
 * Phase 2 (account linking): message events dispatch by binding state:
 *   - already linked → silent (Phase 3 may add business commands)
 *   - unlinked + 6-digit text → try to consume binding code
 *   - unlinked + other text → reply with guidance
 * Follow events also reply with welcome + binding instructions.
 */

interface LineEvent {
    type: string;
    replyToken?: string;
    source?: {
        type?: string;
        userId?: string;
        groupId?: string;
        roomId?: string;
    };
    message?: {
        type?: string;
        text?: string;
    };
    timestamp?: number;
}

const SIX_DIGIT = /^\d{6}$/;
const WELCOME_TEXT =
    '歡迎！請至系統「個人設定」產生 6 位綁定碼後傳給我以完成帳號連結。';
const GUIDANCE_TEXT =
    '此 LINE 帳號尚未綁定。請至系統「個人設定」產生綁定碼後傳給我（6 位數字）。';

function truncate(s: string | undefined | null, n: number): string | null {
    if (!s) return null;
    return s.length > n ? s.slice(0, n) : s;
}

async function handleMessageEvent(ev: LineEvent): Promise<void> {
    const lineUserId = ev.source?.userId;
    const text = ev.message?.text;
    const replyToken = ev.replyToken;
    if (!lineUserId || !text || !replyToken) return;

    // 1. Already linked → silent
    const linkedSysId = await findUserByLineUserId(lineUserId);
    if (linkedSysId) return;

    // 2. Unlinked
    if (SIX_DIGIT.test(text)) {
        const result = await consumeLinkCodeFromWebhook(text, lineUserId);
        await replyLineMessage(replyToken, result.replyText);
    } else {
        await replyLineMessage(replyToken, GUIDANCE_TEXT);
    }
}

async function handleFollowEvent(ev: LineEvent): Promise<void> {
    if (ev.replyToken) {
        await replyLineMessage(ev.replyToken, WELCOME_TEXT);
    }
}

export async function POST(req: NextRequest) {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
        return new NextResponse('LINE channel secret not configured', { status: 500 });
    }

    const signature = req.headers.get('x-line-signature');
    if (!signature) {
        return new NextResponse(null, { status: 401 });
    }

    const rawBody = await req.text();

    let valid = false;
    try {
        valid = validateSignature(rawBody, channelSecret, signature);
    } catch {
        valid = false;
    }
    if (!valid) {
        return new NextResponse(null, { status: 401 });
    }

    let parsed: { events?: LineEvent[]; destination?: string };
    try {
        parsed = JSON.parse(rawBody);
    } catch {
        return new NextResponse('OK', { status: 200 });
    }

    const events = Array.isArray(parsed.events) ? parsed.events : [];

    // Process events sequentially so each handler can complete (notably reply)
    // before the response is sent. LINE Platform allows a few seconds.
    for (const ev of events) {
        const detail: Record<string, unknown> = {
            event_type: ev.type ?? 'unknown',
            line_user_id: ev.source?.userId ?? null,
            source_type: ev.source?.type ?? null,
        };
        if (ev.type === 'message') {
            detail.message_type = ev.message?.type ?? null;
            if (ev.message?.type === 'text') {
                detail.message_text = truncate(ev.message.text, 200);
            }
        }
        if (typeof ev.timestamp === 'number') {
            detail.line_timestamp = ev.timestamp;
        }
        void writeAuditLog({
            userId: null,
            action: 'line.webhook_received',
            targetType: 'notification',
            targetId: null,
            detail,
        });

        // Phase 2 dispatch
        try {
            if (ev.type === 'message') {
                await handleMessageEvent(ev);
            } else if (ev.type === 'follow') {
                await handleFollowEvent(ev);
            }
        } catch (err) {
            console.error('[LINE webhook] handler error for event', ev.type, err);
        }
    }

    return new NextResponse('OK', { status: 200 });
}
