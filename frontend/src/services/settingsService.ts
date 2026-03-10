import api from "../lib/axios";

export const settingsService = {
    getSettings: async () => {
        const response = await api.get("/settings");
        return response.data;
    },

    updateBaseCurrency: async (currency: string) => {
        const response = await api.patch("/settings/", { base_currency_code: currency });
        return response.data;
    },

    updateOrganizationSettings: async (payload: any) => {
        const response = await api.patch("/organizations/me", payload);
        return response.data;
    },

    lockSystem: async () => {
        const response = await api.post("/settings/lock");
        return response.data;
    },

    updateExchangeRates: async (rates: Record<string, number>) => {
        const response = await api.patch("/settings/exchange-rates", { rates });
        return response.data;
    }
};
