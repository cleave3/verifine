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
        return response.data?.data || response.data;
    },

    getSuggestions: async (id: number) => {
        const response = await api.get(`/bank-rec/statements/${id}/suggest-matches`);
        return response.data?.data || response.data;
    },

    uploadStatement: async (payload: UploadStatementPayload) => {
        const response = await api.post("/bank-rec/statements", payload);
        return response.data?.data || response.data;
    },

    matchTransaction: async (statementId: number, payload: MatchTransactionPayload) => {
        const response = await api.post(`/bank-rec/statements/${statementId}/match`, payload);
        return response.data?.data || response.data;
    }
};


// opening balance = 0
// Date,Description,Amount,Reference
// 2026-03-01,Stripe Payout,1500000.00,STR-PO-991
// 2026-03-02,Office Supplies Transfer,-250000.00,OFF-01
// 2026-03-03,Client Invoice Payment,340000.00,INV-2024-001
// 2026-03-03,Monthly Software Subscriptions,-212550.50,SUB-MAR
// 2026-03-04,Payroll Run March,-500000.00,PAY-MAR-01

// Endbalance 