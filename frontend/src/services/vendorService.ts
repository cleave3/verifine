import api from "../lib/axios";

export interface CreateVendorPayload {
    name: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    payment_terms_days: number;
}

export const vendorService = {
    getVendors: async () => {
        const response = await api.get("/ap/vendors/");
        return response.data;
    },

    createVendor: async (payload: CreateVendorPayload) => {
        const response = await api.post("/ap/vendors/", payload);
        return response.data;
    }
};
