export const STORAGE_KEY = 'wmcms_state_v1';

export interface AppState {
    stage: string;
    applicant: any;
    documents: any[];
    auditLog: string[];
}

export const saveState = (state: AppState) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save state', e);
    }
};

export const loadState = (): AppState | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('Failed to load state', e);
        return null;
    }
};
