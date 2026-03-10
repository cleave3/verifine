import api from "../lib/axios";

export interface GetInvoicesParams {
    page?: number;
    page_size?: number;
    status?: string;
    customer_id?: string;
    start_date?: string;
    end_date?: string;
}

export interface InvoiceLinePayload {
    account_id: number;
    amount: number;
    description?: string;
    tax_rate_id?: number | null;
    tracking_option_id?: number | null;
}

export interface CreateInvoicePayload {
    customer_id: number;
    period_id: number;
    invoice_date: string;
    due_date: string;
    invoice_number: string;
    description?: string;
    currency_code: string;
    exchange_rate: number;
    total_amount: number;
    lines: InvoiceLinePayload[];
}

export const invoiceService = {
    getInvoices: async (params?: GetInvoicesParams) => {
        const response = await api.get("/ar/invoices/", { params });
        return response.data;
    },

    createInvoice: async (payload: CreateInvoicePayload) => {
        const response = await api.post("/ar/invoices/", payload);
        return response.data;
    },

    sendInvoice: async (id: number) => {
        const response = await api.patch(`/ar/invoices/${id}/sent`);
        return response.data;
    },

    postInvoice: async (id: number) => {
        const response = await api.patch(`/ar/invoices/${id}/post`);
        return response.data;
    },

    payInvoice: async (id: number) => {
        const response = await api.patch(`/ar/invoices/${id}/pay`);
        return response.data;
    },

    downloadInvoicePdf: async (id: number) => {
        const response = await api.get(`/ar/invoices/${id}/pdf`, { responseType: 'blob' });
        return response.data;
    }
};
