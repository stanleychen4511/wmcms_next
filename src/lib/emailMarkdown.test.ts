import { describe, expect, it } from 'vitest';
import { markdownToPlainText, renderEmailHtml } from './emailMarkdown';

const inner = (html: string) => html.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');

describe('renderEmailHtml', () => {
    it('renders bold, underline and line breaks', () => {
        expect(inner(renderEmailHtml('請於 **9/30 前** 回覆\n並 ++簽名++'))).toBe(
            '請於 <strong>9/30 前</strong> 回覆<br>並 <u>簽名</u>',
        );
    });

    it('escapes HTML from user text and placeholder values', () => {
        const html = renderEmailHtml('<script>alert(1)</script> & "王<b>小明</b>"');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<b>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&amp;');
    });

    it('turns dash lines into a list', () => {
        expect(inner(renderEmailHtml('需補件：\n- 身分證\n- 存摺封面\n謝謝'))).toBe(
            '需補件：<ul style="margin:4px 0;padding-left:20px;"><li>身分證</li><li>存摺封面</li></ul>謝謝',
        );
    });

    it('links only http(s) urls and keeps trailing punctuation outside', () => {
        const html = renderEmailHtml('請見 https://example.org/a?x=1&y=2。');
        expect(html).toContain('<a href="https://example.org/a?x=1&amp;y=2"');
        expect(renderEmailHtml('javascript:alert(1)')).not.toContain('<a ');
    });

    it('does not pull surrounding quotes into the link', () => {
        const html = renderEmailHtml('網址 "https://example.org/x" 請點選');
        expect(html).toContain('<a href="https://example.org/x" target="_blank" rel="noopener noreferrer">https://example.org/x</a>&quot;');
    });

    it('leaves plain text without markers unchanged apart from escaping', () => {
        expect(inner(renderEmailHtml('一般內容\n──────────────\n財團法人'))).toBe(
            '一般內容<br>──────────────<br>財團法人',
        );
    });

    it('does not treat lone markers as formatting', () => {
        expect(inner(renderEmailHtml('1 + 1 = 2，** 不是粗體'))).toBe('1 + 1 = 2，** 不是粗體');
    });
});

describe('markdownToPlainText', () => {
    it('strips markers for LINE and text email', () => {
        expect(markdownToPlainText('**重要** 請 ++簽名++\n* 項目')).toBe('重要 請 簽名\n- 項目');
    });
});
