import api from "../lib/axios";

export const itemService = {
    getItems: async () => {
        const response = await api.get("/items");
        return response.data;
    },

    getItem: async (id: number) => {
        const response = await api.get(`/items/${id}`);
        return response.data;
    },

    createItem: async (payload: any) => {
        const response = await api.post("/items", payload);
        return response.data;
    },

    updateItem: async (id: number, payload: any) => {
        const response = await api.put(`/items/${id}`, payload);
        return response.data;
    }
};
