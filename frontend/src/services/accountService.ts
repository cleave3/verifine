import api from "../lib/axios";

export interface CreateAccountPayload {
    code: string;
    name: string;
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    description?: string;
}

export const accountService = {
    getAccounts: async () => {
        const response = await api.get("/accounts/");
        return response.data;
    },

    createAccount: async (payload: CreateAccountPayload) => {
        const response = await api.post("/accounts/", payload);
        return response.data;
    }
};
