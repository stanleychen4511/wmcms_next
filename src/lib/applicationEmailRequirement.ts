/** 轉介案件由轉介窗口收件；僅自提案件需要驗證申請人 Email。 */
export const isApplicantEmailRequired = (applicationWay: '1' | '2') => applicationWay === '1';
