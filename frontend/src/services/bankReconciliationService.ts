import api from "../lib/axios";

export interface UploadStatementPayload {
    account_id: number;
    statement_date: string;
    start_balance: number;
    end_balance: number;
    lines: {
        date: string;
        description: string;
        amount: number;
        reference: string;
    }[];
}

export interface MatchTransactionPayload {
    bank_line_id: number;
    ledger_line_id: number;
}

export const bankReconciliationService = {
    getStatements: async () => {
        const response = await api.get("/bank-rec/statements");
        // Handling nested `.data.data` from the original code
        return response.data?.data || response.data;
    },

    getStatementDetail: async (id: number) => {
        const response = await api.get(`/bank-rec/statements/${id}`);
        return response.data;
    },

    getSuggestions: async (id: number) => {
        const response = await api.get(`/bank-rec/statements/${id}/suggest-matches`);
        return response.data;
    },

    uploadStatement: async (payload: UploadStatementPayload) => {
        const response = await api.post("/bank-rec/statements", payload);
        return response.data;
    },

    matchTransaction: async (statementId: number, payload: MatchTransactionPayload) => {
        const response = await api.post(`/bank-rec/statements/${statementId}/match`, payload);
        return response.data;
    }
};
