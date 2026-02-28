import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfMonth, endOfMonth } from "date-fns";
import api from "../lib/axios";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useCurrencyStore } from "../store/currencyStore";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

const invoiceSchema = z.object({
    customer_id: z.coerce.number().min(1),
    period_id: z.coerce.number().min(1),
    invoice_date: z.string(),
    due_date: z.string(),
    invoice_number: z.string().min(1),
    description: z.string().optional(),
    currency_code: z.string().default("NGN"),
    exchange_rate: z.number().default(1.0),
    lines: z.array(z.object({
        account_id: z.coerce.number().min(1),
        amount: z.coerce.number().min(0.01),
        description: z.string().optional()
    })).min(1),
});
// type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export default function Invoices() {
    const { baseCurrency, activeRates } = useCurrencyStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'SEND' | 'POST' | 'PAY', id: number } | null>(null);
    const [page, setPage] = useState(1);

    // Filtering State
    const [statusFilter, setStatusFilter] = useState("");
    const [customerFilter, setCustomerFilter] = useState("");
    const [dateRangeType, setDateRangeType] = useState("this-month");
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

    const startDate = dateRangeType === "this-month" ? format(startOfMonth(new Date()), "yyyy-MM-dd") : customStartDate;
    const endDate = dateRangeType === "this-month" ? format(endOfMonth(new Date()), "yyyy-MM-dd") : customEndDate;

    const { data: invRes, isLoading } = useQuery({
        queryKey: ["invoices", page, statusFilter, customerFilter, startDate, endDate],
        queryFn: async () => (await api.get("/ar/invoices/", {
            params: {
                page,
                page_size: 10,
                status: statusFilter || undefined,
                customer_id: customerFilter || undefined,
                start_date: startDate,
                end_date: endDate
            }
        })).data
    });
    const { data: custRes } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/ar/customers/")).data });
    const { data: accRes } = useQuery({ queryKey: ["accounts"], queryFn: async () => (await api.get("/accounts/")).data });
    const { data: perRes } = useQuery({ queryKey: ["periods"], queryFn: async () => (await api.get("/periods/")).data });

    const invoices = invRes?.data?.results || [];
    const pageInfo = invRes?.data?.page_info || { current_page: 1, page_count: 1, total_count: 0, is_first_page: true, is_last_page: true };
    const customers = custRes?.data || [];

    const getCustomerName = (id: number) => customers.find((c: any) => c.id === id)?.name || `ID: ${id}`;
    const accounts = accRes?.data?.filter((a: any) => a.type === 'REVENUE') || [];
    const periods = perRes?.data?.filter((p: any) => p.status === "OPEN") || [];

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const total = payload.lines.reduce((sum: number, line: any) => sum + Number(line.amount), 0);
            payload.exchange_rate = activeRates[payload.currency_code] || 1.0;
            return await api.post("/ar/invoices/", { ...payload, total_amount: total });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            setIsModalOpen(false);
            form.reset();
        },
    });

    const sendMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/ar/invoices/${id}/sent`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    });

    const postMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/ar/invoices/${id}/post`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    });

    const payMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/ar/invoices/${id}/pay`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    });

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            customer_id: 0, period_id: 0,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            invoice_number: "", description: "",
            currency_code: baseCurrency || "NGN",
            exchange_rate: 1.0,
            lines: [{ account_id: 0, amount: 0, description: "" }]
        }
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

    const watchedCurrency = form.watch("currency_code");
    const watchedLines = form.watch("lines");
    const totalInputAmount = watchedLines?.reduce((sum: number, line: any) => sum + (Number(line.amount) || 0), 0) || 0;
    const activeRate = activeRates[watchedCurrency] || 1.0;
    const baseTotal = totalInputAmount * activeRate;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Accounts Receivable Invoices</h1>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                    + Create Invoice
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filter Invoices</span>
                </div>
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="DRAFT">Draft</option>
                            <option value="SENT">Sent</option>
                            <option value="POSTED">Posted</option>
                            <option value="PAID">Paid</option>
                            <option value="VOIDED">Voided</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Customer</label>
                        <select
                            value={customerFilter}
                            onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                        >
                            <option value="">All Customers</option>
                            {customers.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Date Range</label>
                        <select
                            value={dateRangeType}
                            onChange={(e) => { setDateRangeType(e.target.value); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="this-month">This Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {dateRangeType === "custom" && (
                        <>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Start Date</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => { setCustomStartDate(e.target.value); setPage(1); }}
                                    className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => { setCustomEndDate(e.target.value); setPage(1); }}
                                    className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </>
                    )}

                    <button
                        onClick={() => {
                            setStatusFilter("");
                            setCustomerFilter("");
                            setDateRangeType("this-month");
                            setPage(1);
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-medium pb-2 hover:underline"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading invoices...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">INV #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {invoices.map((inv: any) => (
                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{inv.invoice_number}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">{getCustomerName(inv.customer_id)}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{format(new Date(inv.invoice_date), 'MMM d, yyyy')}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: inv.currency_code || baseCurrency }).format(inv.total_amount)}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${inv.status === 'SENT' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {inv.status === 'DRAFT' && (
                                            <button onClick={() => setConfirmAction({ type: 'SEND', id: inv.id })} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium whitespace-nowrap">Send</button>
                                        )}
                                        {inv.status === 'SENT' && (
                                            <button onClick={() => setConfirmAction({ type: 'POST', id: inv.id })} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium whitespace-nowrap">Post to GL</button>
                                        )}
                                        {inv.status === 'POSTED' && (
                                            <button onClick={() => setConfirmAction({ type: 'PAY', id: inv.id })} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium whitespace-nowrap">Mark Paid</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {invoices.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No invoices found.</td></tr>}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium text-slate-900 dark:text-white">{invoices.length}</span> of <span className="font-medium text-slate-900 dark:text-white">{pageInfo.total_count}</span> invoices
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={pageInfo.is_first_page}
                                className="p-2 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Page {pageInfo.current_page} of {pageInfo.page_count}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pageInfo.page_count, p + 1))}
                                disabled={pageInfo.is_last_page}
                                className="p-2 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Create Invoice</h2>
                        <form onSubmit={form.handleSubmit((d: any) => createMutation.mutate(d))} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer</label>
                                    <select {...form.register("customer_id")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                        <option value={0}>Select Customer</option>
                                        {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Period</label>
                                    <select {...form.register("period_id")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                        <option value={0}>Select Period</option>
                                        {periods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Date</label>
                                    <input type="date" {...form.register("invoice_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due Date</label>
                                    <input type="date" {...form.register("due_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Invoice Number</label>
                                    <input {...form.register("invoice_number")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Memo</label>
                                    <input {...form.register("description")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Currency</label>
                                    <select {...form.register("currency_code")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                        {Object.keys(activeRates).map(code => (
                                            <option key={code} value={code}>{code}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Base Equivalent ({baseCurrency})</label>
                                    <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md border border-slate-200 dark:border-slate-700 font-semibold opacity-80">
                                        {new Intl.NumberFormat('en-NG', { style: 'currency', currency: baseCurrency || 'NGN' }).format(baseTotal)}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Line Items</h3>
                                    <button type="button" onClick={() => append({ account_id: 0, amount: 0, description: "" })} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add Line</button>
                                </div>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-center mb-2">
                                        <select {...form.register(`lines.${index}.account_id`)} className="flex-1 min-w-[150px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                            <option value={0}>Revenue Account</option>
                                            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                        </select>
                                        <input type="number" step="0.01" placeholder="Amount" {...form.register(`lines.${index}.amount`)} className="w-32 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                        <button type="button" onClick={() => remove(index)} className="text-rose-500 px-2 font-bold">✕</button>
                                    </div>
                                ))}
                                {form.formState.errors.lines?.root && <p className="text-rose-500 text-sm mt-2">{form.formState.errors.lines.root.message as string}</p>}
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {createMutation.isPending ? "Saving..." : "Save Draft"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmAction?.type === 'SEND'}
                title="Send Invoice"
                message="Are you sure you want to mark this invoice as SENT? This will advance its status so it can be posted to the ledger."
                confirmText="Yes, Send It"
                type="primary"
                onConfirm={() => confirmAction && sendMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />

            <ConfirmDialog
                isOpen={confirmAction?.type === 'POST'}
                title="Post to General Ledger"
                message="Are you sure you want to POST this invoice? This will permanently generate a Journal Entry debiting AR and crediting Revenue."
                confirmText="Yes, Post to GL"
                type="success"
                onConfirm={() => confirmAction && postMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />

            <ConfirmDialog
                isOpen={confirmAction?.type === 'PAY'}
                title="Mark Invoice Paid"
                message="Are you sure you want to mark this invoice as fully PAID? This closes out the receivable."
                confirmText="Yes, Mark Paid"
                type="primary"
                onConfirm={() => confirmAction && payMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
