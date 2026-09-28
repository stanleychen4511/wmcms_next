/**
 * 通知信件的簡易格式（WMCMS-12）：讓承辦人在純文字輸入框中用標記做粗體、底線、清單。
 *
 * 支援語法：
 *   **粗體**      → <strong>
 *   ++底線++      → <u>（CommonMark 沒有底線語法，故自訂）
 *   行首「- 」    → 項目清單
 *   http(s) 網址  → 可點擊連結
 *   換行          → <br>
 *
 * 安全性：先整段 HTML escape，再套上白名單標記，所以使用者輸入或佔位符值
 * （例如申請人姓名）都無法注入 HTML。連結只接受 http/https。
 *
 * 純函式、無 'use server'，client 預覽與 server 寄信共用同一份實作，確保所見即所寄。
 */

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 已 escape 過的文字中找網址；& 已變成 &amp;。只收 ASCII 網址字元，避免吃進中文全形標點（如「。」）
const URL_RE = /\bhttps?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&()*+,;=%]+/g;

function renderInline(escaped: string): string {
    return escaped
        .replace(URL_RE, url => {
            // 句尾標點、被 escape 的引號／角括號不算網址
            const m = url.match(/^(.*?)((?:&quot;|&#39;|&gt;|&lt;|[.,;:!?)\]])*)$/);
            const href = m ? m[1] : url;
            const tail = m ? m[2] : '';
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>${tail}`;
        })
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
        .replace(/\+\+(?=\S)([\s\S]*?\S)\+\+/g, '<u>$1</u>');
}

/** 將信件內容轉為 HTML（escape-first，安全） */
export function renderEmailHtml(source: string): string {
    const lines = escapeHtml(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out: string[] = [];
    let listItems: string[] = [];
    const flushList = () => {
        if (listItems.length === 0) return;
        out.push(`<ul style="margin:4px 0;padding-left:20px;">${listItems.map(li => `<li>${li}</li>`).join('')}</ul>`);
        listItems = [];
    };
    const textLines: string[] = [];
    const flushText = () => {
        if (textLines.length === 0) return;
        out.push(textLines.join('<br>'));
        textLines.length = 0;
    };
    for (const line of lines) {
        const item = line.match(/^\s*[-*]\s+(.*)$/);
        if (item) {
            flushText();
            listItems.push(renderInline(item[1]));
        } else {
            flushList();
            textLines.push(renderInline(line));
        }
    }
    flushText();
    flushList();
    // 區塊間用 <br> 串接（清單本身是 block，不需額外換行）
    const html = out.join('<br>').replace(/<br>(<ul )/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
    return `<div style="font-size:14px;line-height:1.7;">${html}</div>`;
}

/** 去除格式標記，供純文字 email 與 LINE 使用 */
export function markdownToPlainText(source: string): string {
    return (source ?? '')
        .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')
        .replace(/\+\+(?=\S)([\s\S]*?\S)\+\+/g, '$1')
        .replace(/^(\s*)\*\s+/gm, '$1- ');
}
