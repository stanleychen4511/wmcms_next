import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { writeAuditLog } from '../../../actions/auditActions';
import {
    replyLineMessage,
    findUserByLineUserId,
    consumeLinkCodeFromWebhook,
} from '../../../actions/lineActions';
import { parseLineLinkCode } from '../../../../lib/lineLinkCode';

/**
 * LINE Messaging API webhook endpoint.
 *
 * Phase 1 (foundation): signature verification + audit log per event.
 * Phase 2 (account linking): only an explicit WMCMS binding code is handled.
 * Follow events and all other messages are audited without a reply.
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

function truncate(s: string | undefined | null, n: number): string | null {
    if (!s) return null;
    return s.length > n ? s.slice(0, n) : s;
}

async function handleMessageEvent(ev: LineEvent): Promise<void> {
    const lineUserId = ev.source?.userId;
    const text = ev.message?.text;
    const replyToken = ev.replyToken;
    if (!lineUserId || !text || !replyToken) return;

    // General messages (including follow-up chatter) are intentionally silent.
    if (!parseLineLinkCode(text)) return;

    // Already linked → silent
    const linkedSysId = await findUserByLineUserId(lineUserId);
    if (linkedSysId) return;

    const result = await consumeLinkCodeFromWebhook(text, lineUserId);
    await replyLineMessage(replyToken, result.replyText);
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
                detail.message_text = ev.message.text && parseLineLinkCode(ev.message.text)
                    ? '[REDACTED_LINE_LINK_CODE]'
                    : truncate(ev.message.text, 200);
            }
        }
        if (typeof ev.timestamp === 'number') {
            detail.line_timestamp = ev.timestamp;
        }
        await writeAuditLog({
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
            }
        } catch (err) {
            console.error('[LINE webhook] handler error for event', ev.type, err);
        }
    }

    return new NextResponse('OK', { status: 200 });
}
