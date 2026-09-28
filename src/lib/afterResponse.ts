import { after } from 'next/server';

/**
 * 在回應送出後執行背景工作（通知、自動派案等）。
 *
 * 為什麼不直接 `void task()`：部署在 Vercel serverless 時，server action 回傳後
 * function 可能立即被凍結，未完成的 promise（寄信、LINE push、寫 log）會整批消失。
 * `after()` 會讓平台等背景工作跑完再結束。
 *
 * 在 request scope 之外（單元測試、腳本）呼叫 `after()` 會丟錯，此時退回 fire-and-forget。
 * 背景工作的錯誤一律只記 log，不影響主流程。
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
    const run = async () => {
        try {
            await task();
        } catch (err) {
            console.error(`[afterResponse] ${label} failed`, err);
        }
    };
    try {
        after(run);
    } catch {
        void run();
    }
}
