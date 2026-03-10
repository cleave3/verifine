import api from "../lib/axios";

export const mfaService = {
    setup: async () => {
        const response = await api.post("/auth/mfa/setup");
        return response.data.data;
    },

    verify: async (code: string) => {
        const response = await api.post("/auth/mfa/verify", { code });
        return response.data;
    },

    disable: async () => {
        const response = await api.post("/auth/mfa/disable");
        return response.data;
    },

    getStatus: async () => {
        const response = await api.get("/auth/mfa/status");
        return response.data.data;
    }
};
