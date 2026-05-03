/**
 * Payment receipt PDF component (for server-side generation).
 *
 * Visually mirrors `/print/payment-receipt/[applicationId]` (HTML print page) but uses
 * @react-pdf/renderer primitives. Not pixel-perfect — aimed at "looks like the paper
 * template when printed" rather than byte-identical rendering.
 *
 * Accepts the same DTO shape as `fetchPaymentReceiptPrintData` returns.
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import fs from 'node:fs';
import path from 'node:path';
import type { PaymentReceiptPrintData } from '../../app/actions/printDocumentActions';
import { CATEGORY_LABEL } from '../caseCategory';
import { numToChinese } from '../numToChinese';
import { toRocDate } from '../rocDate';

const FONT = 'NotoSansTC';

const s = StyleSheet.create({
    page: {
        padding: 36,
        fontFamily: FONT,
        fontSize: 10,
        color: '#0f172a',
    },
    h1: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    headerLeft: { flex: 1, paddingRight: 10 },
    headerRight: {
        width: 90, height: 90,
        borderWidth: 1, borderColor: '#cbd5e1',
        alignItems: 'center', justifyContent: 'center',
    },
    qrImg: { width: 90, height: 90 },
    qrFallback: { fontSize: 8, color: '#94a3b8', textAlign: 'center', padding: 4 },
    orgName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
    metaLine: { fontSize: 9, marginBottom: 1 },
    // table
    table: { borderWidth: 2, borderColor: '#0f172a', marginTop: 4 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#0f172a' },
    rowLast: { flexDirection: 'row' },
    cellHeader: {
        width: 90,
        padding: 6,
        fontWeight: 'bold',
        backgroundColor: '#f1f5f9',
        borderRightWidth: 1, borderRightColor: '#0f172a',
        // 水平 + 垂直置中（標題欄）
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
    },
    cellValue: { flex: 1, padding: 6, justifyContent: 'center', alignItems: 'flex-start' },
    cellLabel: {
        width: 75,
        padding: 6,
        fontWeight: 'bold',
        backgroundColor: '#f1f5f9',
        borderLeftWidth: 1, borderLeftColor: '#0f172a',
        borderRightWidth: 1, borderRightColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
    },
    fullRowValue: { flex: 1, padding: 6, justifyContent: 'center' },
    inline: { flexDirection: 'row', alignItems: 'center' },
    checkbox: {
        width: 12, height: 12,
        borderWidth: 1, borderColor: '#0f172a',
        marginRight: 4,
        alignItems: 'center', justifyContent: 'center',
    },
    checkboxFilled: {
        width: 12, height: 12,
        borderWidth: 1, borderColor: '#0f172a',
        backgroundColor: '#0f172a',
        marginRight: 4,
    },
    underline: {
        borderBottomWidth: 1, borderColor: '#0f172a',
        minWidth: 70, marginHorizontal: 4,
        textAlign: 'center',
    },
    smallUnderline: {
        borderBottomWidth: 1, borderColor: '#0f172a',
        // 給足寬度讓 textAlign:center 視覺上明顯（115 三字 ~18pt，餘 22pt 平分兩側 = 11pt 邊距）
        minWidth: 40, marginHorizontal: 4,
        textAlign: 'center',
    },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    categoryItem: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 },
    signatureGrid: {
        flexDirection: 'row',
        marginTop: 14,
        justifyContent: 'space-between',
    },
    signatureCell: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
    signatureLabel: { fontWeight: 'bold', marginRight: 4 },
    signatureLine: {
        flex: 1,
        borderBottomWidth: 1, borderColor: '#0f172a',
        minWidth: 40, marginRight: 10,
    },
    payeeLine: { marginVertical: 2, flexDirection: 'row', alignItems: 'center' },
});

function qrAbsolute(qrUrl: string): string | null {
    if (!qrUrl) return null;
    if (/^https?:\/\//i.test(qrUrl)) return qrUrl;
    const rel = qrUrl.startsWith('/') ? qrUrl.slice(1) : qrUrl;
    const abs = path.join(process.cwd(), 'public', rel);
    return fs.existsSync(abs) ? abs : null;
}

function Checkbox({ checked }: { checked: boolean }) {
    // 勾選時整格填滿，避免印列出來的 ✓ 太小看不清
    return <View style={checked ? s.checkboxFilled : s.checkbox} />;
}

interface Props {
    data: PaymentReceiptPrintData;
}

export function PaymentReceiptPdf({ data }: Props) {
    const today = toRocDate(new Date());
    const qr = qrAbsolute(data.org.line_qr_url);
    const amountCN =
        data.approvedAmount != null && data.approvedAmount > 0
            ? `新臺幣（大寫）${numToChinese(data.approvedAmount)} 元整`
            : '新臺幣（大寫）仟 佰 拾 萬 仟 佰 拾 元整';

    const categoryLabels = (Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map(
        (code) => ({
            code,
            // strip trailing "補助" to match paper template style
            label: CATEGORY_LABEL[code].replace('補助', ''),
        })
    );

    return (
        <Document>
            <Page size="A4" style={s.page}>
                <Text style={s.h1}>領款收據</Text>

                {/* Foundation header + QR */}
                <View style={s.headerRow}>
                    <View style={s.headerLeft}>
                        <Text style={s.orgName}>{data.org.full_name}</Text>
                        <Text style={s.metaLine}>核准立案字號：{data.org.license_no}</Text>
                        <Text style={s.metaLine}>法人登記證：{data.org.registration_no}</Text>
                        <Text style={s.metaLine}>統一編號：{data.org.uniform_no}</Text>
                        <Text style={s.metaLine}>{data.org.address}</Text>
                        <Text style={s.metaLine}>電話：{data.org.phone}　傳真：{data.org.fax}</Text>
                    </View>
                    <View style={s.headerRight}>
                        {qr ? (
                            <Image src={qr} style={s.qrImg} />
                        ) : (
                            <Text style={s.qrFallback}>（LINE QR{'\n'}未設定）</Text>
                        )}
                    </View>
                </View>

                {/* Main table */}
                <View style={s.table}>
                    {/* 此欄由基金會填寫 — 水平靠左、垂直置中（fullRowValue 自帶 justifyContent:center） */}
                    <View style={s.row}>
                        <View style={{ ...s.fullRowValue, backgroundColor: '#f1f5f9' }}>
                            <View style={s.inline}>
                                <Text style={{ fontWeight: 'bold' }}>此欄由基金會填寫：</Text>
                                <Text>中華民國</Text>
                                <Text style={s.smallUnderline}>{today?.year ?? ''}</Text>
                                <Text>年</Text>
                                <Text style={s.smallUnderline}>{today?.month ?? ''}</Text>
                                <Text>月</Text>
                                <Text style={s.smallUnderline}>{today?.day ?? ''}</Text>
                                <Text>日　</Text>
                                <Text style={{ fontWeight: 'bold' }}>收據編號：</Text>
                                <Text style={s.underline}>{data.externalCode ?? ' '}</Text>
                            </View>
                        </View>
                    </View>

                    {/* 申請人 + 案號 */}
                    <View style={s.row}>
                        <View style={s.cellHeader}>
                            <Text>申請人姓名</Text>
                            <Text>（單位名稱）</Text>
                        </View>
                        <View style={s.cellValue}>
                            <Text>{data.applicantName}</Text>
                        </View>
                        <View style={s.cellLabel}>
                            <Text>申請案號</Text>
                        </View>
                        <View style={s.cellValue}>
                            <Text>{data.caseNumber}</Text>
                        </View>
                    </View>

                    {/* 身分證 + 電話 */}
                    <View style={s.row}>
                        <View style={s.cellHeader}>
                            <Text>身分證字號</Text>
                            <Text>（統一編號）</Text>
                        </View>
                        <View style={s.cellValue}>
                            <Text>{data.applicantIdNumber ?? ' '}</Text>
                        </View>
                        <View style={s.cellLabel}>
                            <Text>電話</Text>
                        </View>
                        <View style={s.cellValue}>
                            <Text> </Text>
                        </View>
                    </View>

                    {/* 地址 */}
                    <View style={s.row}>
                        <View style={s.cellHeader}><Text>地址</Text></View>
                        <View style={s.fullRowValue}><Text> </Text></View>
                    </View>

                    {/* 補助類別 */}
                    <View style={s.row}>
                        <View style={s.cellHeader}><Text>申請補助類別</Text></View>
                        <View style={s.fullRowValue}>
                            <View style={s.categoryGrid}>
                                {categoryLabels.map(({ code, label }) => (
                                    <View key={code} style={s.categoryItem}>
                                        <Checkbox checked={data.category === code} />
                                        <Text>{label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* 領款金額（國字大寫） */}
                    <View style={s.row}>
                        <View style={s.cellHeader}><Text>領款金額</Text></View>
                        <View style={s.fullRowValue}>
                            <Text>{amountCN}</Text>
                        </View>
                    </View>

                    {/* 領款方式 */}
                    <View style={s.row}>
                        <View style={s.cellHeader}><Text>領款方式</Text></View>
                        <View style={s.fullRowValue}>
                            <View style={s.payeeLine}>
                                <Checkbox checked={data.paymentMethod === '匯款'} />
                                <Text style={{ fontWeight: 'bold' }}>匯款</Text>
                                <Text>（檢附存摺封面影本）</Text>
                            </View>
                            <View style={{ ...s.inline, paddingLeft: 14 }}>
                                <Text>金融機構名稱：</Text>
                                <Text style={s.underline}>{data.bankName ?? ' '}</Text>
                                <Text>銀行</Text>
                                <Text style={s.underline}>{data.bankBranch ?? ' '}</Text>
                                <Text>分行</Text>
                            </View>
                            <View style={{ ...s.inline, paddingLeft: 14 }}>
                                <Text>帳號：</Text>
                                <Text style={s.underline}>{data.bankAccount ?? ' '}</Text>
                            </View>
                            <View style={s.payeeLine}>
                                <Checkbox checked={data.paymentMethod === '代付醫院'} />
                                <Text>萬美基金會代為支付醫療費用予醫院</Text>
                            </View>
                            {(data.paymentMethod === '現金' || data.paymentMethod === '其他') && (
                                <View style={s.payeeLine}>
                                    <Checkbox checked />
                                    <Text>{data.paymentMethod}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* 具領人資料 + 簽名 */}
                    <View style={s.rowLast}>
                        <View style={{ ...s.cellValue, flex: 1, borderRightWidth: 1, borderRightColor: '#0f172a' }}>
                            <Text style={{ fontWeight: 'bold' }}>具領人與申請人之關係：</Text>
                            <View style={{ ...s.payeeLine, paddingLeft: 10 }}>
                                <Checkbox checked={data.payeeRelation === '本人'} />
                                <Text>本人，以下無需填寫</Text>
                            </View>
                            <View style={{ ...s.payeeLine, paddingLeft: 10 }}>
                                <Checkbox checked={!!data.payeeRelation && data.payeeRelation !== '本人'} />
                                <Text>非本人，與申請人關係</Text>
                                <Text style={s.underline}>
                                    {data.payeeRelation && data.payeeRelation !== '本人'
                                        ? (data.payeeRelation === '其他'
                                            ? `其他${data.payeeRelationOther ? `：${data.payeeRelationOther}` : ''}`
                                            : data.payeeRelation)
                                        : ' '}
                                </Text>
                            </View>
                            <Text style={{ marginTop: 6 }}>具領人姓名：{data.payeeName ?? '_________________'}</Text>
                            <Text style={{ marginTop: 2 }}>具領人身分證字號：_______________</Text>
                            <Text style={{ marginTop: 2 }}>具領人電話：_________________</Text>
                            <Text style={{ marginTop: 2 }}>具領人戶籍住址：___________________</Text>
                        </View>
                        <View style={{ ...s.cellValue, flex: 1 }}>
                            <Text style={{ fontWeight: 'bold' }}>具領人簽名（親筆簽名）：</Text>
                            <View style={{ height: 60 }} />
                            <View style={{ ...s.inline, justifyContent: 'center' }}>
                                <Text>中華民國</Text>
                                <Text style={s.smallUnderline}> </Text>
                                <Text>年</Text>
                                <Text style={s.smallUnderline}> </Text>
                                <Text>月</Text>
                                <Text style={s.smallUnderline}> </Text>
                                <Text>日</Text>
                            </View>
                            <Text style={{ marginTop: 4, fontSize: 8 }}>◎補助金額需列入當年度之所得申報</Text>
                        </View>
                    </View>
                </View>

                {/* 承辦人 / 主管 / 會計 / 執行長 */}
                <View style={s.signatureGrid}>
                    <View style={s.signatureCell}>
                        <Text style={s.signatureLabel}>承辦人：</Text>
                        <View style={s.signatureLine} />
                    </View>
                    <View style={s.signatureCell}>
                        <Text style={s.signatureLabel}>主管：</Text>
                        <View style={s.signatureLine} />
                    </View>
                    <View style={s.signatureCell}>
                        <Text style={s.signatureLabel}>會計：</Text>
                        <View style={s.signatureLine} />
                    </View>
                    <View style={s.signatureCell}>
                        <Text style={s.signatureLabel}>執行長：</Text>
                        <View style={s.signatureLine} />
                    </View>
                </View>
            </Page>
        </Document>
    );
}
