import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    validateSignature: vi.fn(() => true),
    writeAuditLog: vi.fn(async () => undefined),
    replyLineMessage: vi.fn(async () => undefined),
    findUserByLineUserId: vi.fn(async () => null),
    consumeLinkCodeFromWebhook: vi.fn(async () => ({
        replyText: '綁定成功',
        linkedUserId: '42',
    })),
}));

vi.mock('@line/bot-sdk', () => ({
    validateSignature: mocks.validateSignature,
}));

vi.mock('../../../actions/auditActions', () => ({
    writeAuditLog: mocks.writeAuditLog,
}));

vi.mock('../../../actions/lineActions', () => ({
    replyLineMessage: mocks.replyLineMessage,
    findUserByLineUserId: mocks.findUserByLineUserId,
    consumeLinkCodeFromWebhook: mocks.consumeLinkCodeFromWebhook,
}));

import { POST } from './route';

function webhookRequest(events: unknown[]): NextRequest {
    return new NextRequest('http://localhost/api/line/webhook', {
        method: 'POST',
        headers: { 'x-line-signature': 'valid-signature' },
        body: JSON.stringify({ events }),
    });
}

describe('LINE webhook replies', () => {
    beforeEach(() => {
        vi.stubEnv('LINE_CHANNEL_SECRET', 'test-secret');
        vi.clearAllMocks();
    });

    it('audits a follow event without replying', async () => {
        const response = await POST(webhookRequest([{
            type: 'follow',
            replyToken: 'reply-token',
            source: { type: 'user', userId: 'Ufollow' },
        }]));

        expect(response.status).toBe(200);
        expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
        expect(mocks.replyLineMessage).not.toHaveBeenCalled();
    });

    it('audits a general text message without replying', async () => {
        await POST(webhookRequest([{
            type: 'message',
            replyToken: 'reply-token',
            source: { type: 'user', userId: 'Ugeneral' },
            message: { type: 'text', text: '你好' },
        }]));

        expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
        expect(mocks.findUserByLineUserId).not.toHaveBeenCalled();
        expect(mocks.replyLineMessage).not.toHaveBeenCalled();
    });

    it('handles only an explicit binding code and redacts it from the audit', async () => {
        await POST(webhookRequest([{
            type: 'message',
            replyToken: 'reply-token',
            source: { type: 'user', userId: 'Ubinder' },
            message: { type: 'text', text: 'WMCMS-01ABCZ' },
        }]));

        expect(mocks.consumeLinkCodeFromWebhook).toHaveBeenCalledWith('WMCMS-01ABCZ', 'Ubinder');
        expect(mocks.replyLineMessage).toHaveBeenCalledWith('reply-token', '綁定成功');
        expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
            detail: expect.objectContaining({ message_text: '[REDACTED_LINE_LINK_CODE]' }),
        }));
    });
});
