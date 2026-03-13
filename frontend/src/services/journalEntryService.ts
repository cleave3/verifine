import api from "../lib/axios";

export interface GetJournalEntriesParams {
    page?: number;
    page_size?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
}

export interface JournalEntryLinePayload {
    account_id: number;
    transaction_debit: number;
    transaction_credit: number;
    description?: string;
    tracking_option_id?: number | null;
    currency_code?: string;
    exchange_rate?: number;
}

export interface CreateJournalEntryPayload {
    description: string;
    entry_date: string;
    period_id: number;
    lines: JournalEntryLinePayload[];
}

export const journalEntryService = {
    getJournalEntries: async (params?: GetJournalEntriesParams) => {
        const response = await api.get("/journal-entries/", { params });
        return response.data;
    },

    createJournalEntry: async (payload: CreateJournalEntryPayload) => {
        const response = await api.post("/journal-entries/", payload);
        return response.data;
    },

    postJournalEntry: async (id: number) => {
        const response = await api.post(`/journal-entries/${id}/post`);
        return response.data;
    },
    updateJournalEntry: async (id: number, data: any) => {
        const response = await api.put(`/journal-entries/${id}`, data);
        return response.data;
    }
};
