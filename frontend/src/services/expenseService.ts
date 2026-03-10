import api from "../lib/axios";

export const expenseService = {
    getClaims: async (employee_id?: number) => {
        const params = employee_id ? { employee_id } : {};
        const response = await api.get("/expenses", { params });
        return response.data;
    },

    createClaim: async (payload: any) => {
        const response = await api.post("/expenses", payload);
        return response.data;
    },

    approveClaim: async (id: number, payload: { credit_account_id: number; period_id: number }) => {
        const response = await api.post(`/expenses/${id}/approve`, payload);
        return response.data;
    },

    rejectClaim: async (id: number) => {
        const response = await api.post(`/expenses/${id}/reject`);
        return response.data;
    }
};
