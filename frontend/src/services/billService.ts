import api from "../lib/axios";

export interface GetBillsParams {
    page?: number;
    page_size?: number;
    status?: string;
    vendor_id?: string;
    start_date?: string;
    end_date?: string;
}

export interface BillLinePayload {
    account_id: number;
    amount: number;
    description?: string;
    tax_rate_id?: number | null;
    tracking_option_id?: number | null;
}

export interface CreateBillPayload {
    vendor_id: number;
    period_id: number;
    bill_date: string;
    due_date: string;
    bill_number: string;
    description?: string;
    currency_code: string;
    exchange_rate: number;
    total_amount: number;
    lines: BillLinePayload[];
}

export const billService = {
    getBills: async (params?: GetBillsParams) => {
        const response = await api.get("/ap/bills/", { params });
        return response.data;
    },

    createBill: async (payload: CreateBillPayload) => {
        const response = await api.post("/ap/bills/", payload);
        return response.data;
    },

    approveBill: async (id: number) => {
        const response = await api.patch(`/ap/bills/${id}/approve`);
        return response.data;
    },

    postBill: async (id: number) => {
        const response = await api.patch(`/ap/bills/${id}/post`);
        return response.data;
    },

    payBill: async (id: number) => {
        const response = await api.patch(`/ap/bills/${id}/pay`);
        return response.data;
    }
};
