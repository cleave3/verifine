import api from "../lib/axios";

export interface CreateCustomerPayload {
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    payment_terms_days: number;
}

export const customerService = {
    getCustomers: async () => {
        const response = await api.get("/ar/customers/");
        return response.data;
    },

    createCustomer: async (payload: CreateCustomerPayload) => {
        const response = await api.post("/ar/customers/", payload);
        return response.data;
    }
};
