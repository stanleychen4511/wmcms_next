/**
 * Server-side PDF buffer generation for the payment receipt.
 *
 * Wraps `fetchPaymentReceiptPrintData` (auth + data) and renders
 * `PaymentReceiptPdf` to a Buffer suitable for email attachment.
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { fetchPaymentReceiptPrintData } from '../../app/actions/printDocumentActions';
import { ensureFontsRegistered } from './registerFonts';
import { PaymentReceiptPdf } from './PaymentReceiptPdf';

export async function generatePaymentReceiptPdf(
    applicationId: string,
    operatorUserId: string
): Promise<Buffer> {
    ensureFontsRegistered();

    const res = await fetchPaymentReceiptPrintData(applicationId, operatorUserId);
    if (!res.success) {
        // auth 失敗 (`'權限不足'`) 或案件不存在 → throw 讓 caller 知道
        throw new Error(res.error);
    }

    const buffer = await renderToBuffer(<PaymentReceiptPdf data={res.data} />);
    return buffer;
}
