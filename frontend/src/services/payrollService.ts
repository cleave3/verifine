import api from "../lib/axios";

export const payrollService = {
    getEmployees: async () => {
        const response = await api.get("/payroll/employees");
        return response.data;
    },

    getEmployee: async (id: number) => {
        const response = await api.get(`/payroll/employees/${id}`);
        return response.data;
    },

    createEmployee: async (payload: any) => {
        const response = await api.post("/payroll/employees", payload);
        return response.data;
    },

    updateEmployee: async (id: number, payload: any) => {
        const response = await api.put(`/payroll/employees/${id}`, payload);
        return response.data;
    },

    getPayrollRuns: async () => {
        const response = await api.get("/payroll/runs");
        return response.data;
    },

    initiatePayrollRun: async (payload: { period_id: number; pay_date: string }) => {
        const response = await api.post("/payroll/runs", payload);
        return response.data;
    },

    confirmPayrollRun: async (id: number, payload: { wages_expense_account_id: number; payroll_liabilities_account_id: number; cash_account_id: number }) => {
        const response = await api.post(`/payroll/runs/${id}/confirm`, payload);
        return response.data;
    },

    getPayslips: async (run_id: number) => {
        const response = await api.get(`/payroll/runs/${run_id}/payslips`);
        return response.data;
    },

    getSettings: async () => {
        const response = await api.get("/payroll/settings");
        return response.data;
    },

    updateSettings: async (payload: { tax_percentage: number; benefits_percentage: number }) => {
        const response = await api.put("/payroll/settings", payload);
        return response.data;
    },
    downloadPayslip: async (id: number) => {
        const response = await api.get(`/payroll/payslips/${id}/download`, {
            responseType: 'blob'
        });
        return response.data;
    }
};
