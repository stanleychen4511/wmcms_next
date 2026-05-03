/**
 * 審核意見表 PDF（refine-disbursement-flow）
 *
 * 用於會計列印「審核意見表」時的合併 PDF 來源。
 * 僅以 React-PDF 渲染基本欄位 — 不做與 HTML 列印頁完全對齊的版面美化，
 * 目標是內容齊全、可閱讀、可印列。
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { ReviewOpinionPrintData } from '../../app/actions/printDocumentActions';
import { CATEGORY_LABEL } from '../caseCategory';
import { formatRocDate } from '../rocDate';

const FONT = 'NotoSansTC';

const s = StyleSheet.create({
    page: { padding: 40, fontFamily: FONT, fontSize: 11, color: '#0f172a' },
    h1: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 14 },
    metaRow: { flexDirection: 'row', marginBottom: 6 },
    metaLabel: { width: 70, fontWeight: 'bold' },
    metaValue: { flex: 1 },
    section: { marginTop: 12, marginBottom: 4, fontWeight: 'bold', fontSize: 12 },
    block: {
        borderWidth: 1, borderColor: '#0f172a',
        padding: 8, minHeight: 60, marginBottom: 10,
    },
    sigGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    sigCell: {
        width: '50%',
        padding: 6,
        flexDirection: 'column',
    },
    sigLabel: { fontSize: 10, marginBottom: 2 },
    sigImg: { width: 120, height: 40, objectFit: 'contain' },
    sigDate: { fontSize: 9, color: '#475569', marginTop: 2 },
    decisionRow: { flexDirection: 'row', marginTop: 6, gap: 16 },
    decisionItem: { fontSize: 11 },
});

interface Props {
    data: ReviewOpinionPrintData;
}

export function ReviewOpinionPdf({ data }: Props) {
    const categoryLabel = data.category ? CATEGORY_LABEL[data.category] : '—';
    const reviewDateRoc = data.reviewDate ? (formatRocDate(new Date(data.reviewDate)) || '—') : '—';
    const verdict = data.isApproved === true ? '通過' : data.isApproved === false ? '不通過' : '—';
    const approvedAmount = data.approvedAmount != null
        ? `NT$ ${Number(data.approvedAmount).toLocaleString()}` : '—';

    return (
        <Document>
            <Page size="A4" style={s.page}>
                <Text style={s.h1}>萬美基金會 自費醫療補助 審核意見表</Text>

                <View style={s.metaRow}>
                    <Text style={s.metaLabel}>案號：</Text>
                    <Text style={s.metaValue}>{data.caseNumber || '—'}</Text>
                </View>
                <View style={s.metaRow}>
                    <Text style={s.metaLabel}>申請人：</Text>
                    <Text style={s.metaValue}>{data.applicantName || '—'}</Text>
                </View>
                <View style={s.metaRow}>
                    <Text style={s.metaLabel}>類別：</Text>
                    <Text style={s.metaValue}>{categoryLabel}</Text>
                </View>
                <View style={s.metaRow}>
                    <Text style={s.metaLabel}>審核日期：</Text>
                    <Text style={s.metaValue}>{reviewDateRoc}</Text>
                </View>

                <Text style={s.section}>個管師案件說明</Text>
                <View style={s.block}>
                    <Text>{data.caseDescription?.trim() || '—'}</Text>
                </View>

                <Text style={s.section}>董事審核意見</Text>
                <View style={s.block}>
                    <Text>{data.boardComments?.trim() || '—'}</Text>
                </View>

                <View style={s.decisionRow}>
                    <Text style={s.decisionItem}>審核結果：{verdict}</Text>
                    <Text style={s.decisionItem}>核定金額：{approvedAmount}</Text>
                </View>

                <Text style={s.section}>董事簽章</Text>
                <View style={s.sigGrid}>
                    {data.signatures.length === 0 && (
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>（尚無簽章）</Text>
                    )}
                    {data.signatures.map((sig, i) => (
                        <View key={i} style={s.sigCell}>
                            <Text style={s.sigLabel}>{sig.signerName}</Text>
                            {sig.signatureDataUrl
                                ? <Image style={s.sigImg} src={sig.signatureDataUrl} />
                                : <Text style={{ fontSize: 9, color: '#94a3b8' }}>（無簽章圖檔）</Text>}
                            <Text style={s.sigDate}>
                                {sig.signedAt ? new Date(sig.signedAt).toLocaleString('zh-TW') : ''}
                            </Text>
                        </View>
                    ))}
                </View>
            </Page>
        </Document>
    );
}
