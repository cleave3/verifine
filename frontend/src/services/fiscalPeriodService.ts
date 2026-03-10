import api from "../lib/axios";

export interface CreatePeriodPayload {
    name: string;
    start_date: string;
    end_date: string;
}

export interface ClosePeriodPayload {
    id: number;
    retained_earnings_account_id: number;
}

export const fiscalPeriodService = {
    getPeriods: async () => {
        const response = await api.get("/periods/");
        return response.data;
    },

    createPeriod: async (payload: CreatePeriodPayload) => {
        const response = await api.post("/periods/", payload);
        return response.data;
    },

    closePeriod: async (payload: ClosePeriodPayload) => {
        const response = await api.patch(`/periods/${payload.id}/close`, {
            retained_earnings_account_id: payload.retained_earnings_account_id
        });
        return response.data;
    },

    lockPeriod: async (id: number) => {
        const response = await api.patch(`/periods/${id}/lock`);
        return response.data;
    }
};
