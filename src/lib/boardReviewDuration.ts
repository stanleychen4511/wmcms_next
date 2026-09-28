/**
 * 董事審核所需天數統計（WMCMS-9 #84）— 純函式彙總。
 *
 * 一筆「審核」= 某董事在某次派案（派組／改派）後的第一次正式簽核。
 * 天數以台北日期相減（派案當天簽核 = 0 天）。尚未簽核者列為審核中，天數為至今經過天數。
 */

export interface BoardReviewDurationItem {
    applicationId: string;
    caseNumber: string;
    signerUserId: string;
    signerName: string;
    isChairman: boolean;
    /** ISO */
    assignedAt: string;
    /** ISO；null = 尚未簽核 */
    signedAt: string | null;
    /** 已簽核：派案日到簽核日的天數；審核中：派案日到今天的天數 */
    days: number;
}

export interface BoardMemberDurationSummary {
    signerUserId: string;
    signerName: string;
    isChairman: boolean;
    completedCount: number;
    avgDays: number | null;
    medianDays: number | null;
    maxDays: number | null;
    pendingCount: number;
    /** 審核中案件中最久的經過天數 */
    maxPendingDays: number | null;
}

function median(sorted: number[]): number | null {
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function summarizeBoardReviewDurations(items: BoardReviewDurationItem[]): BoardMemberDurationSummary[] {
    const bySigner = new Map<string, BoardReviewDurationItem[]>();
    for (const it of items) {
        const list = bySigner.get(it.signerUserId) ?? [];
        list.push(it);
        bySigner.set(it.signerUserId, list);
    }
    const out: BoardMemberDurationSummary[] = [];
    for (const [signerUserId, list] of bySigner) {
        const done = list.filter(i => i.signedAt).map(i => i.days).sort((a, b) => a - b);
        const pending = list.filter(i => !i.signedAt).map(i => i.days);
        const med = median(done);
        out.push({
            signerUserId,
            signerName: list[0].signerName,
            isChairman: list.some(i => i.isChairman),
            completedCount: done.length,
            avgDays: done.length ? round1(done.reduce((a, b) => a + b, 0) / done.length) : null,
            medianDays: med == null ? null : round1(med),
            maxDays: done.length ? done[done.length - 1] : null,
            pendingCount: pending.length,
            maxPendingDays: pending.length ? Math.max(...pending) : null,
        });
    }
    // 平均天數多的排前面（需要關注），無完成紀錄者排最後
    return out.sort((a, b) =>
        (b.avgDays ?? -1) - (a.avgDays ?? -1) || a.signerName.localeCompare(b.signerName, 'zh-TW'));
}
