import api from "../lib/axios";

export const taxService = {
    getTaxes: async () => {
        const response = await api.get("/taxes/");
        return response.data.data;
    },

    createTaxRate: async (payload: any) => {
        const response = await api.post("/taxes", payload);
        return response.data;
    },

    updateTaxRate: async (id: number, payload: any) => {
        const response = await api.put(`/taxes/${id}`, payload);
        return response.data;
    }
};
