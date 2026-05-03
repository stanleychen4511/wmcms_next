/**
 * Render ReviewOpinionPdf to a Buffer.
 * Caller MUST already have done role gate (admin/accountant) before invoking,
 * because this internally calls fetchReviewOpinionPrintData with that operatorUserId.
 */
import { renderToBuffer } from '@react-pdf/renderer';
import { fetchReviewOpinionPrintData } from '../../app/actions/printDocumentActions';
import { ensureFontsRegistered } from './registerFonts';
import { ReviewOpinionPdf } from './ReviewOpinionPdf';

export async function generateReviewOpinionPdf(
    applicationId: string,
    operatorUserId: string,
): Promise<Buffer> {
    ensureFontsRegistered();
    const res = await fetchReviewOpinionPrintData(applicationId, operatorUserId);
    if (!res.success) {
        throw new Error(res.error);
    }
    return await renderToBuffer(<ReviewOpinionPdf data={res.data} />);
}
