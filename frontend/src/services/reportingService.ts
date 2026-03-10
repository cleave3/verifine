import api from "../lib/axios";

export const reportingService = {
    getTrialBalance: async (periodId: number) => {
        const response = await api.get(`/reports/trial-balance/${periodId}`);
        return response.data;
    },

    getProfitAndLoss: async (periodId: number, trackingOptionId?: number) => {
        const params = trackingOptionId ? { tracking_option_id: trackingOptionId } : {};
        const response = await api.get(`/reports/profit-and-loss/${periodId}`, { params });
        return response.data;
    },

    getBalanceSheet: async (periodId: number) => {
        const response = await api.get(`/reports/balance-sheet/${periodId}`);
        return response.data;
    },

    getTaxLiability: async (periodId: number) => {
        const response = await api.get(`/reports/tax-liability/${periodId}`);
        return response.data;
    }
};
