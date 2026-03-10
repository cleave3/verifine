import api from "../lib/axios";

export const auditService = {
    getLogs: async (params?: any) => {
        const response = await api.get("/audit", { params });
        return response.data;
    },

    getActionTypes: async () => {
        const response = await api.get("/audit/action-types");
        return response.data;
    }
};
