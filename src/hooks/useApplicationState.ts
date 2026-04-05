import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockApi } from '../api/mockApi';
import { AppState } from '../utils/storage';
import { DOCUMENT_LIST } from '../types';

const QUERY_KEY = ['appState'];

const DEFAULT_STATE: AppState = {
    stage: 'application',
    applicant: {
        type: 'married',
        hasMinorChildren: true,
        annualIncome: 80,
        movableAssets: 50,
        realEstateValue: 1000,
    },
    documents: DOCUMENT_LIST,
    auditLog: [],
};

export function useApplicationState() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const data = await mockApi.fetchState();
            return data || DEFAULT_STATE;
        },
        staleTime: Infinity, // Keep data fresh for this session unless explicitly mutated
    });

    const mutation = useMutation({
        mutationFn: mockApi.updateState,
        onSuccess: (newData) => {
            queryClient.setQueryData(QUERY_KEY, newData);
        },
    });

    const updateState = (updates: Partial<AppState>) => {
        if (!query.data) return;

        // Optimistic update could go here, but for now we just mutate
        const newState = { ...query.data, ...updates };
        mutation.mutate(newState);
    };

    return {
        state: query.data,
        isLoading: query.isLoading,
        isUpdating: mutation.isPending, // v5 uses isPending
        error: query.error,
        updateState,
    };
}
