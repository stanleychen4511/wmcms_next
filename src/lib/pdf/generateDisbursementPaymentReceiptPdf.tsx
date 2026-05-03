/**
 * 為單筆 payment_disbursements 產生領款收據 PDF buffer。
 * 與 generatePaymentReceiptPdf 不同處：
 *   - 用 disbursement.amount 取代 applications.approved_amount
 *   - 帶入該筆撥款的領款方式 / 銀行 / 具領人等欄位
 *   - caller 必須自行做角色守門（此函式內部仍透過 fetchPaymentReceiptPrintData 取資料，
 *     需傳入一個有 admin/accountant 權限的 user_id 作為 dataFetchOperatorId）
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { fetchPaymentReceiptPrintData } from '../../app/actions/printDocumentActions';
import { ensureFontsRegistered } from './registerFonts';
import { PaymentReceiptPdf } from './PaymentReceiptPdf';

export interface DisbursementOverrides {
    amount: number;
    externalCode?: string;
    paymentMethod?: string | null;
    bankName?: string | null;
    bankBranch?: string | null;
    bankAccount?: string | null;
    payeeName?: string | null;
    payeeRelation?: string | null;
    payeeRelationOther?: string | null;
}

export async function generateDisbursementPaymentReceiptPdf(
    applicationId: string,
    dataFetchOperatorId: string,  // 需有 admin/accountant 權限以通過 fetchPaymentReceiptPrintData 守門
    overrides: DisbursementOverrides,
): Promise<Buffer> {
    ensureFontsRegistered();
    const res = await fetchPaymentReceiptPrintData(applicationId, dataFetchOperatorId);
    if (!res.success) {
        throw new Error(res.error);
    }
    const data = {
        ...res.data,
        approvedAmount: overrides.amount,
        externalCode: overrides.externalCode,
        paymentMethod: overrides.paymentMethod ?? null,
        bankName: overrides.bankName ?? null,
        bankBranch: overrides.bankBranch ?? null,
        bankAccount: overrides.bankAccount ?? null,
        payeeName: overrides.payeeName ?? null,
        payeeRelation: overrides.payeeRelation ?? null,
        payeeRelationOther: overrides.payeeRelationOther ?? null,
    };
    return await renderToBuffer(<PaymentReceiptPdf data={data} />);
}
