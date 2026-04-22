/**
 * Names of notification_templates rows that the dispatcher relies on.
 * These templates cannot be deleted or renamed — deletion / renaming breaks
 * the dispatcher's template lookup by name.
 *
 * Body and subject editing is allowed so admins can tune the message text.
 *
 * Shared between server actions and client components — do NOT place inside
 * a 'use server' file (that would violate Next.js export rules).
 */
export const SYSTEM_TEMPLATE_NAMES = new Set<string>([
    'line_case_entered_board_review',
    'email_case_entered_board_review',
    'line_case_assigned_to_board_group',
    'email_case_assigned_to_board_group',
    'email_case_payment_receipt_to_applicant',
]);
