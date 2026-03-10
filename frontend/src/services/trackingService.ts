import api from "../lib/axios";

export const trackingService = {
    getCategories: async () => {
        const response = await api.get("/tracking/categories/");
        return response.data;
    },

    createCategory: async (payload: any) => {
        const response = await api.post("/tracking/categories/", payload);
        return response.data;
    },

    updateCategory: async (id: number, payload: any) => {
        const response = await api.put(`/tracking/categories/${id}`, payload);
        return response.data;
    }
};
