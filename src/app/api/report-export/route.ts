/**
 * 報表匯出 — XLSX
 *
 * POST /api/report-export
 *   body: {
 *     reportType: 'self_pay' | 'disbursement' | 'rejected',
 *     operatorUserId: string,
 *     filter: { from?, to?, subsidySubtype?, officerId?, reasonCodes? },
 *     flatten?: boolean,   // 報表 2 專用：是否展開為平面格式（每列重複案件資訊）
 *   }
 *
 * 回傳：xlsx 檔（Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet）
 *
 * 樣式：
 *   - 標題列灰底粗體 + 凍結首列
 *   - 民國日期格式（YYY/MM/DD）
 *   - 報表 2 預設將同案件的基本資訊欄合併（merge cells）
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import {
    fetchSelfPayMedicalReport,
    fetchDisbursementReport,
    fetchRejectedReport,
} from '../../actions/reportActions';

const SUBSIDY_LABEL: Record<string, string> = { '1': '經濟弱勢', '2': '小康家庭' };
const APP_FORM_LABEL: Record<string, string> = { P: '紙本', E: '電子郵件' };
const PHASE_LABEL: Record<string, string> = { B: '治療前', A: '治療後', X: '治療前後' };
const STATUS_LABEL: Record<string, string> = { '1': '審核中', '2': '審核未通過', '3': '待核銷', '4': '核銷完成' };

/** 西元 YYYY-MM-DD → 民國 YYY/MM/DD */
function toRoc(s: string | null | undefined): string {
    if (!s) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return s;
    const year = Number(m[1]) - 1911;
    return `${year}/${m[2]}/${m[3]}`;
}

function applyHeaderStyle(row: ExcelJS.Row) {
    row.eachCell(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF94A3B8' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
    });
    row.height = 32;
}

function applyDataBorders(ws: ExcelJS.Worksheet, fromRow: number, toRow: number) {
    for (let r = fromRow; r <= toRow; r++) {
        ws.getRow(r).eachCell({ includeEmpty: true }, cell => {
            cell.border = {
                top: { style: 'hair', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } },
                left: { style: 'hair', color: { argb: 'FFCBD5E1' } },
                right: { style: 'hair', color: { argb: 'FFCBD5E1' } },
            };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
    }
}

// ─── Builders ──────────────────────────────────────────────────────────────

async function buildSelfPay(wb: ExcelJS.Workbook, operatorUserId: string, filter: any) {
    const res = await fetchSelfPayMedicalReport(operatorUserId, filter);
    if (!res.success) throw new Error(res.error);
    const ws = wb.addWorksheet('自費醫療');
    ws.columns = [
        { header: '承辦人', width: 10 },
        { header: '案件編號', width: 12 },
        { header: '申請案別', width: 12 },
        { header: '自行/轉介', width: 14 },
        { header: '窗口聯絡方式', width: 18 },
        { header: '申請者', width: 12 },
        { header: '聯絡電話', width: 16 },
        { header: '申請日期（民國）', width: 16 },
        { header: '申請形式', width: 10 },
        { header: '治療階段', width: 10 },
        { header: '癌症期數', width: 10 },
        { header: '行政審核', width: 36 },
        { header: '董事審核', width: 36 },
        { header: '待收到的資料', width: 24 },
        { header: '案件狀態', width: 10 },
    ];
    applyHeaderStyle(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    res.data.forEach(r => {
        ws.addRow([
            r.officerName,
            r.caseNumber,
            r.subsidySubtype ? SUBSIDY_LABEL[r.subsidySubtype] ?? r.subsidySubtype : '',
            r.applicationWay === '2' ? `轉介${r.referralUnitName ? `（${r.referralUnitName}）` : ''}` : '自行申請',
            r.applicationWay === '2' ? (r.referralContactPhone ?? '') : (r.applicantPhone ?? ''),
            r.applicantName,
            r.applicantPhone ?? '',
            toRoc(r.applyAt),
            r.applicationForm ? APP_FORM_LABEL[r.applicationForm] ?? '' : '',
            r.treatmentPhase ? PHASE_LABEL[r.treatmentPhase] ?? '' : '',
            r.cancerStage ?? '',
            r.adminReviewText ?? '',
            r.boardReviewText ?? '',
            r.pendingDocuments.length > 0 ? r.pendingDocuments.join('\n') : '已收齊',
            STATUS_LABEL[r.status] ?? r.status,
        ]);
    });
    applyDataBorders(ws, 2, ws.rowCount);
}

async function buildDisbursement(wb: ExcelJS.Workbook, operatorUserId: string, filter: any, flatten: boolean) {
    const res = await fetchDisbursementReport(operatorUserId, filter);
    if (!res.success) throw new Error(res.error);
    const ws = wb.addWorksheet('自費醫療補助款項');
    ws.columns = [
        { header: '案件編號', width: 12 },
        { header: '自行/轉介', width: 16 },
        { header: '申請者', width: 12 },
        { header: '身分證字號', width: 14 },
        { header: '申請日期（民國）', width: 16 },
        { header: '給付方式', width: 12 },
        { header: '通過補助額度', width: 16 },
        { header: '收據編號', width: 14 },
        { header: '給付日期（民國）', width: 16 },
        { header: '給付費用', width: 16 },
        { header: '備註', width: 40 },
    ];
    applyHeaderStyle(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // 寫入：flatten=true → 每列都填案件資訊；false → 只第一列填，後續列空（後面會 merge cells）
    const data = res.data;
    // 先把每筆 row 的「案件資訊」展開（flatten 模式）；非 flatten 直接用 server 回傳值
    let flatData = data;
    if (flatten) {
        let lastInfo: any = {};
        flatData = data.map(r => {
            if (r.caseNumber) {
                lastInfo = {
                    caseNumber: r.caseNumber,
                    applicationWay: r.applicationWay,
                    referralUnitName: r.referralUnitName,
                    applicantName: r.applicantName,
                    idNumber: r.idNumber,
                    applyAt: r.applyAt,
                    approvedAmount: r.approvedAmount,
                };
            }
            return { ...r, ...lastInfo };
        });
    }

    flatData.forEach(r => {
        const row = ws.addRow([
            r.caseNumber ?? '',
            r.applicationWay === '2' ? `轉介${r.referralUnitName ? `（${r.referralUnitName}）` : ''}` : (r.applicationWay === '1' ? '自行申請' : ''),
            r.applicantName ?? '',
            r.idNumber ?? '',
            toRoc(r.applyAt),
            r.paymentMethod ?? '',
            r.approvedAmount != null ? r.approvedAmount : '',
            r.receiptNo ?? '',
            toRoc(r.paidAt),
            r.amount != null ? r.amount : '',
            r.notes ?? '',
        ]);
        // 通過額度（col 7）+ 給付費用（col 10）：千分位 + 靠左
        const fmtCols = [7, 10];
        for (const c of fmtCols) {
            const cell = row.getCell(c);
            if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0';
            }
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
    });

    // 非 flatten 模式：把同案件的前 7 欄合併儲存格（案件資訊欄）
    if (!flatten && data.length > 0) {
        // 從 row 2 開始，找連續同 caseNumber 群組
        const startRow = 2;
        let groupStart = startRow;
        let lastCase = data[0].caseNumber ?? '';
        for (let i = 1; i <= data.length; i++) {
            const cur = data[i]?.caseNumber ?? null;
            // server 把續筆 caseNumber 設為 null；只有 group head 有值
            if (cur !== null || i === data.length) {
                const groupEnd = startRow + i - 1;
                if (groupEnd > groupStart) {
                    // 合併欄 1 案件編號、2 自行轉介、3 申請者、4 身分證、5 申請日期、7 通過補助額度
                    [1, 2, 3, 4, 5, 7].forEach(colIdx => {
                        ws.mergeCells(groupStart, colIdx, groupEnd, colIdx);
                    });
                }
                groupStart = startRow + i;
                if (cur !== null) lastCase = cur;
            }
        }
        // 防 unused var lint
        void lastCase;
    }

    applyDataBorders(ws, 2, ws.rowCount);
}

async function buildRejected(wb: ExcelJS.Workbook, operatorUserId: string, filter: any) {
    const res = await fetchRejectedReport(operatorUserId, filter);
    if (!res.success) throw new Error(res.error);
    const ws = wb.addWorksheet('自費醫療_未通過');
    ws.columns = [
        { header: 'NO', width: 6 },
        { header: '姓名', width: 12 },
        { header: '申請日期（民國）', width: 16 },
        { header: '文件屬性', width: 10 },
        { header: '未符合原因', width: 56 },
        { header: '承辦人員', width: 10 },
        { header: '備註', width: 32 },
    ];
    applyHeaderStyle(ws.getRow(1));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    res.data.forEach(r => {
        ws.addRow([
            r.rowNo,
            r.applicantName,
            toRoc(r.applyAt),
            r.applicationForm ? APP_FORM_LABEL[r.applicationForm] ?? '' : '',
            r.reasonsText,
            r.officerName,
            r.notes ?? '',
        ]);
    });
    applyDataBorders(ws, 2, ws.rowCount);
}

// ─── Handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { reportType, operatorUserId, filter, flatten } = body ?? {};
        if (!reportType || !operatorUserId) {
            return NextResponse.json({ error: 'missing reportType / operatorUserId' }, { status: 400 });
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = '萬美基金會醫療補助管理系統';
        wb.created = new Date();

        let filename = 'report.xlsx';
        if (reportType === 'self_pay') {
            await buildSelfPay(wb, operatorUserId, filter ?? {});
            filename = '自費醫療.xlsx';
        } else if (reportType === 'disbursement') {
            await buildDisbursement(wb, operatorUserId, filter ?? {}, !!flatten);
            filename = '自費醫療補助款項.xlsx';
        } else if (reportType === 'rejected') {
            await buildRejected(wb, operatorUserId, filter ?? {});
            filename = '自費醫療_未通過.xlsx';
        } else {
            return NextResponse.json({ error: 'unknown reportType' }, { status: 400 });
        }

        const buf = await wb.xlsx.writeBuffer();

        // 中文檔名要 RFC 5987 encode 成 UTF-8
        const utf8Encoded = encodeURIComponent(filename);
        const headers = new Headers();
        headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        headers.set('Content-Disposition', `attachment; filename="report.xlsx"; filename*=UTF-8''${utf8Encoded}`);
        headers.set('Content-Length', String(buf.byteLength));
        return new NextResponse(buf as ArrayBuffer, { status: 200, headers });
    } catch (err: any) {
        console.error('report-export', err);
        return NextResponse.json({ error: err?.message ?? '匯出失敗' }, { status: 500 });
    }
}
