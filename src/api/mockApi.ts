import { AppState, loadState, saveState } from '../utils/storage';

const DELAY_MS = 600;

export const mockApi = {
    fetchState: async (): Promise<AppState | null> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(loadState());
            }, DELAY_MS);
        });
    },

    updateState: async (newState: AppState): Promise<AppState> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                saveState(newState);
                resolve(newState);
            }, DELAY_MS);
        });
    }
};
