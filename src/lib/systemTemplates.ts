/**
 * Names of notification_templates rows that the dispatcher relies on.
 * These templates cannot be deleted or renamed because the dispatcher falls
 * back to template lookup by name.
 *
 * Body and subject editing is allowed so admins can tune the message text.
 *
 * Shared between server actions and client components. Do not place inside a
 * 'use server' file; that would violate Next.js export rules.
 */
export const SYSTEM_TEMPLATE_NAMES = new Set<string>([
    'line_case_entered_board_review',
    'email_case_entered_board_review',
    'line_case_assigned_to_board_group',
    'email_case_assigned_to_board_group',
    'line_case_assigned_to_officer',
    'email_case_assigned_to_officer',
    'email_case_payment_receipt_to_applicant',
    'email_case_disbursement_approval_to_applicant',
    'email_disbursement_completed',
    'line_disbursement_completed',
]);

const TEMPLATE_LABELS: Record<string, string> = {
    line_case_entered_board_review: 'LINE：案件進入董事審核待派組通知',
    email_case_entered_board_review: 'Email：案件進入董事審核待派組通知',
    line_case_assigned_to_board_group: 'LINE：董事審核派組通知',
    email_case_assigned_to_board_group: 'Email：董事審核派組通知',
    line_case_assigned_to_officer: 'LINE：承辦人被派發案件通知',
    email_case_assigned_to_officer: 'Email：承辦人被派發案件通知',
    email_case_payment_receipt_to_applicant: 'Email：寄送領款收據通知',
    email_case_disbursement_approval_to_applicant: 'Email：寄送申請通過通知',
    email_disbursement_completed: 'Email：撥款完成通知',
    line_disbursement_completed: 'LINE：撥款完成通知',
};

export function getNotificationTemplateLabel(name: string | null | undefined): string {
    if (!name) return '-';
    return TEMPLATE_LABELS[name] ?? name;
}
