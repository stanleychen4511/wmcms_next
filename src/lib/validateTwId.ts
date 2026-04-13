/**
 * Taiwan ID / Resident Certificate validation
 *
 * Supports three formats:
 *  1. 本國人國民身分證        – 1st char A-Z, 2nd char 1|2
 *  2. 新版外來人口統一證號    – 1st char A-Z, 2nd char 8|9  (same checksum as 本國人)
 *  3. 舊版外來人口統一證號    – 1st char A-Z, 2nd char A-D  (2nd letter → ones digit only)
 */

// Letter → 2-digit number mapping (A=10, B=11, …, Z=33)
const LETTER_TO_NUMBER: Record<string, number> = {};
'ABCDEFGHJKLMNPQRSTUVXYWZIO'.split('').forEach((ch, i) => {
    LETTER_TO_NUMBER[ch] = i + 10;
});

function letterValue(ch: string): number {
    return LETTER_TO_NUMBER[ch.toUpperCase()] ?? -1;
}

export function validateTwId(id: string): boolean {
    const s = id.trim().toUpperCase();

    // ── 本國人 / 新版外來人口：1 letter + 9 digits ──────────────────────────
    if (/^[A-Z]\d{9}$/.test(s)) {
        const second = parseInt(s[1], 10);
        // 本國人: 2nd digit 1 or 2; 新版外來: 2nd digit 8 or 9
        if (![1, 2, 8, 9].includes(second)) return false;

        const n1 = letterValue(s[0]);
        if (n1 < 0) return false;

        const digits = [
            Math.floor(n1 / 10), // tens of letter conversion
            n1 % 10,             // ones of letter conversion
            ...s.slice(1).split('').map(Number),
        ];
        // weights: 1,9,8,7,6,5,4,3,2,1,1  (11 positions, last is the check digit itself)
        const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        const sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * weights[i], 0);
        return (sum + digits[10]) % 10 === 0;
    }

    // ── 舊版外來人口：2 letters + 8 digits ─────────────────────────────────
    if (/^[A-Z][A-D]\d{8}$/.test(s)) {
        const n1 = letterValue(s[0]);
        const n2 = letterValue(s[1]); // A=10→0, B=11→1, C=12→2, D=13→3 (ones only)
        if (n1 < 0 || n2 < 0) return false;

        const digits = [
            Math.floor(n1 / 10),
            n1 % 10,
            n2 % 10, // second letter: ones digit only
            ...s.slice(2).split('').map(Number),
        ];
        const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        const sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * weights[i], 0);
        return (sum + digits[10]) % 10 === 0;
    }

    return false;
}

/** Human-readable error message, or null if valid */
export function twIdError(id: string): string | null {
    const s = id.trim();
    if (!s) return '請輸入身分證字號';
    if (!validateTwId(s)) return '身分證字號格式或檢查碼有誤，請確認後重新輸入';
    return null;
}
