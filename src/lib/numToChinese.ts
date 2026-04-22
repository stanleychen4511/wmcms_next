/**
 * 阿拉伯數字 → 國字大寫金額（用於列印領款收據）。
 *
 * 規則：
 * - 數字字元：零壹貳參肆伍陸柒捌玖
 * - 單位：拾、佰、仟、萬
 * - 中間連續零：壓縮成單一「零」字
 * - 萬位前後是兩段（萬以下用 仟佰拾，萬以上接「萬」）
 * - 0 → 「零」
 * - 支援 0..9999999；超過 7 位數截斷後仍處理（依設計決策「不用管超過」）
 */

const DIGIT_CHARS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'] as const;
const UNIT_CHARS = ['', '拾', '佰', '仟'] as const;

/** 將最多 4 位數的整數轉為國字大寫（不含「萬」單位）。 */
function convertSection(n: number): string {
    if (n === 0) return '';
    let result = '';
    let zeroPending = false;
    const digits = String(n).split('').map(Number); // 高位優先
    const len = digits.length;
    for (let i = 0; i < len; i++) {
        const d = digits[i];
        const pos = len - 1 - i; // 個位 = 0
        if (d === 0) {
            zeroPending = true;
        } else {
            if (zeroPending) {
                result += DIGIT_CHARS[0];
                zeroPending = false;
            }
            result += DIGIT_CHARS[d] + UNIT_CHARS[pos];
        }
    }
    return result;
}

export function numToChinese(amount: number): string {
    if (!Number.isFinite(amount) || amount < 0) {
        return '';
    }
    const n = Math.floor(amount);
    if (n === 0) return '零';

    if (n > 9999999) {
        // 依決策「不用管超過」，仍嘗試但只取低 7 位避免 console 警告污染
        // eslint-disable-next-line no-console
        console.warn('[numToChinese] amount exceeds 7 digits, truncating:', amount);
    }

    const wan = Math.floor(n / 10000);
    const remain = n % 10000;

    if (wan === 0) return convertSection(remain);

    const wanPart = convertSection(wan) + '萬';
    if (remain === 0) return wanPart;

    // 萬以下若高位是 0，需要插入「零」連接（例如 10500 → 壹萬零伍佰）
    const remainPart = convertSection(remain);
    const needsZero = remain < 1000; // 千位是 0
    return wanPart + (needsZero ? '零' : '') + remainPart;
}
