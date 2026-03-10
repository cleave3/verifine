import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { billService } from "../services/billService";
import { vendorService } from "../services/vendorService";
import { accountService } from "../services/accountService";
import { fiscalPeriodService } from "../services/fiscalPeriodService";
import { taxService } from "../services/taxService";
import { trackingService } from "../services/trackingService";
import { itemService } from "../services/itemService";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useCurrencyStore } from "../store/currencyStore";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { RoleGuard } from "../components/RoleGuard";

const billSchema = z.object({
    vendor_id: z.coerce.number().min(1),
    period_id: z.coerce.number().min(1),
    bill_date: z.string(),
    due_date: z.string(),
    bill_number: z.string().min(1),
    description: z.string().optional(),
    currency_code: z.string().default("NGN"),
    exchange_rate: z.number().default(1.0),
    lines: z.array(z.object({
        item_id: z.coerce.number().optional().nullable().transform(v => v === 0 ? null : v),
        account_id: z.coerce.number().min(1),
        quantity: z.coerce.number().min(0.01).default(1.0),
        amount: z.coerce.number().min(0.01),
        description: z.string().optional(),
        tax_rate_id: z.coerce.number().optional().nullable().transform(v => v === 0 ? null : v),
        tracking_option_id: z.coerce.number().optional().nullable().transform(v => v === 0 ? null : v)
    })).min(1),
});
// type BillFormValues = z.infer<typeof billSchema>;

export default function Bills() {
    const { formatCurrency, baseCurrency, activeRates } = useCurrencyStore();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'APPROVE' | 'POST' | 'PAY', id: number } | null>(null);
    const [page, setPage] = useState(1);

    // Filtering State
    const [statusFilter, setStatusFilter] = useState("");
    const [vendorFilter, setVendorFilter] = useState("");
    const [dateRangeType, setDateRangeType] = useState("this-month");
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

    const startDate = dateRangeType === "this-month" ? format(startOfMonth(new Date()), "yyyy-MM-dd") : customStartDate;
    const endDate = dateRangeType === "this-month" ? format(endOfMonth(new Date()), "yyyy-MM-dd") : customEndDate;

    const { data: billsRes, isLoading } = useQuery({
        queryKey: ["bills", page, statusFilter, vendorFilter, startDate, endDate],
        queryFn: () => billService.getBills({
            page,
            page_size: 10,
            status: statusFilter || undefined,
            vendor_id: vendorFilter || undefined,
            start_date: startDate,
            end_date: endDate
        })
    });
    const { data: venRes } = useQuery({ queryKey: ["vendors"], queryFn: vendorService.getVendors });
    const { data: accRes } = useQuery({ queryKey: ["accounts"], queryFn: accountService.getAccounts });
    const { data: perRes } = useQuery({ queryKey: ["periods"], queryFn: fiscalPeriodService.getPeriods });
    const { data: taxRes } = useQuery({ queryKey: ["taxes"], queryFn: taxService.getTaxes });
    const { data: trackingRes } = useQuery({ queryKey: ["tracking-categories"], queryFn: trackingService.getCategories });
    const { data: itemRes } = useQuery({ queryKey: ["items"], queryFn: itemService.getItems });

    const bills = billsRes?.data?.results || [];
    const pageInfo = billsRes?.data?.meta || billsRes?.data?.page_info || { current_page: 1, page_count: 1, total_count: 0, is_first_page: true, is_last_page: true };
    const vendors = venRes?.data || [];

    const getVendorName = (id: number) => vendors.find((v: any) => v.id === id)?.name || `ID: ${id}`;
    const accounts = accRes?.data?.filter((a: any) => a.type === 'EXPENSE' || a.type === 'ASSET') || [];
    const periods = perRes?.data?.filter((p: any) => p.status === "OPEN") || [];
    const taxes = taxRes?.data || taxRes || [];
    const trackingCategories = trackingRes?.data || trackingRes || [];
    const itemsList = itemRes?.data || itemRes || [];

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const total = payload.lines.reduce((sum: number, line: any) => sum + Number(line.amount), 0);
            payload.exchange_rate = activeRates[payload.currency_code] || 1.0;
            return await billService.createBill({ ...payload, total_amount: total });
        },
        onSuccess: () => {
            toast.success("Bill entered successfully");
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setIsModalOpen(false);
            form.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to enter bill");
        }
    });

    const approveMutation = useMutation({
        mutationFn: billService.approveBill,
        onSuccess: () => {
            toast.success("Bill approved successfully");
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setConfirmAction(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to approve bill");
        }
    });

    const postMutation = useMutation({
        mutationFn: billService.postBill,
        onSuccess: () => {
            toast.success("Bill posted successfully");
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setConfirmAction(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to post bill");
        }
    });

    const payMutation = useMutation({
        mutationFn: billService.payBill,
        onSuccess: () => {
            toast.success("Bill marked as paid");
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setConfirmAction(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to mark as paid");
        }
    });

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(billSchema),
        defaultValues: {
            vendor_id: 0, period_id: 0,
            bill_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            bill_number: "", description: "",
            currency_code: baseCurrency || "NGN",
            exchange_rate: 1.0,
            lines: [{ item_id: 0, account_id: 0, quantity: 1, amount: 0, description: "", tax_rate_id: 0, tracking_option_id: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

    const watchedCurrency = form.watch("currency_code");
    const watchedLines = form.watch("lines");
    const totalInputAmount = watchedLines?.reduce((sum: number, line: any) => {
        let amt = Number(line.amount) || 0;
        if (line.tax_rate_id) {
            const tr = taxes.find((t: any) => t.id === Number(line.tax_rate_id));
            if (tr) amt += amt * tr.rate;
        }
        return sum + amt;
    }, 0) || 0;
    const activeRate = activeRates[watchedCurrency] || 1.0;
    const baseTotal = totalInputAmount * activeRate;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Accounts Payable Bills</h1>
                <RoleGuard allowedRoles={['admin', 'controller', 'clerk']}>
                    <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                        + Enter Bill
                    </button>
                </RoleGuard>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filter Bills</span>
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
                            <option value="APPROVED">Approved</option>
                            <option value="POSTED">Posted</option>
                            <option value="PAID">Paid</option>
                            <option value="VOIDED">Voided</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Vendor</label>
                        <select
                            value={vendorFilter}
                            onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                        >
                            <option value="">All Vendors</option>
                            {vendors.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name}</option>
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
                            setVendorFilter("");
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
                <div className="text-slate-500 animate-pulse">Loading bills...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bill #</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {bills.map((b: any) => (
                                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{b.bill_number}</td>
                                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{getVendorName(b.vendor_id)}</td>
                                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{format(new Date(b.bill_date), 'MMM d, yyyy')}</td>
                                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                        {formatCurrency(b.total_amount, b.currency_code || baseCurrency)}
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${b.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="px-4 sm:px-6 py-4 text-sm flex gap-2 flex-wrap min-w-[120px]">
                                        {b.status === 'DRAFT' && (
                                            <RoleGuard allowedRoles={['admin', 'controller']}>
                                                <button onClick={() => setConfirmAction({ type: 'APPROVE', id: b.id })} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded">Approve</button>
                                            </RoleGuard>
                                        )}
                                        {b.status === 'APPROVED' && (
                                            <RoleGuard allowedRoles={['admin', 'controller']}>
                                                <button onClick={() => setConfirmAction({ type: 'POST', id: b.id })} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium whitespace-nowrap bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded">Post to GL</button>
                                            </RoleGuard>
                                        )}
                                        {b.status === 'POSTED' && (
                                            <RoleGuard allowedRoles={['admin', 'controller', 'clerk']}>
                                                <button onClick={() => setConfirmAction({ type: 'PAY', id: b.id })} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium whitespace-nowrap bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded">Mark Paid</button>
                                            </RoleGuard>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {bills.length === 0 && <tr><td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-slate-500">No bills found.</td></tr>}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium text-slate-900 dark:text-white">{bills.length}</span> of <span className="font-medium text-slate-900 dark:text-white">{pageInfo.total_count}</span> bills
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
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 w-full sm:w-[95%] md:max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Enter Bill</h2>
                        <form onSubmit={form.handleSubmit((d: any) => createMutation.mutate(d))} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Vendor</label>
                                    <select {...form.register("vendor_id")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                        <option value={0}>Select Vendor</option>
                                        {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Bill Date</label>
                                    <input type="date" {...form.register("bill_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due Date</label>
                                    <input type="date" {...form.register("due_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Bill Number</label>
                                    <input {...form.register("bill_number")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Memo</label>
                                    <input {...form.register("description")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md border border-slate-200 dark:border-slate-700 font-semibold opacity-80 overflow-x-auto whitespace-nowrap">
                                        {formatCurrency(baseTotal)}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Expenses/Items</h3>
                                    <button type="button" onClick={() => append({ item_id: 0, account_id: 0, quantity: 1, amount: 0, description: "", tax_rate_id: 0, tracking_option_id: 0 })} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add Line</button>
                                </div>
                                <div className="overflow-x-auto pb-4">
                                    <div className="min-w-[500px]">
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="flex flex-wrap gap-2 items-center mb-2">
                                                <select
                                                    {...form.register(`lines.${index}.item_id`)}
                                                    className="w-32 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                                    onChange={(e) => {
                                                        const itemId = Number(e.target.value);
                                                        const selectedItem = itemsList.find((i: any) => i.id === itemId);
                                                        if (selectedItem) {
                                                            const acct = selectedItem.asset_account_id || selectedItem.cogs_account_id;
                                                            if (acct) form.setValue(`lines.${index}.account_id`, acct);
                                                            if (selectedItem.name) form.setValue(`lines.${index}.description`, selectedItem.name);
                                                            if (selectedItem.unit_cost) {
                                                                const qty = form.getValues(`lines.${index}.quantity`) || 1;
                                                                form.setValue(`lines.${index}.amount`, selectedItem.unit_cost * qty);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <option value={0}>Item...</option>
                                                    {itemsList.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                </select>
                                                <select {...form.register(`lines.${index}.account_id`)} className="flex-1 min-w-[150px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                                    <option value={0}>Expense Account</option>
                                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                </select>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="Qty"
                                                    {...form.register(`lines.${index}.quantity`)}
                                                    className="w-20 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right"
                                                    onChange={(e) => {
                                                        const qty = Number(e.target.value) || 0;
                                                        const itemId = form.getValues(`lines.${index}.item_id`);
                                                        if (itemId) {
                                                            const selectedItem = itemsList.find((i: any) => i.id === Number(itemId));
                                                            if (selectedItem && selectedItem.unit_cost) {
                                                                form.setValue(`lines.${index}.amount`, selectedItem.unit_cost * qty);
                                                            }
                                                        }
                                                    }}
                                                />
                                                <input type="number" step="0.01" placeholder="Total Amt" {...form.register(`lines.${index}.amount`)} className="w-28 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                                <select {...form.register(`lines.${index}.tax_rate_id`)} className="w-28 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                                    <option value={0}>No Tax</option>
                                                    {taxes.filter((t: any) => t.is_active).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                                <select {...form.register(`lines.${index}.tracking_option_id`)} className="w-36 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                                    <option value={0}>No Tracking</option>
                                                    {trackingCategories.filter((c: any) => c.is_active).map((c: any) => (
                                                        <optgroup key={c.id} label={c.name}>
                                                            {c.options.filter((o: any) => o.is_active).map((o: any) => (
                                                                <option key={o.id} value={o.id}>{o.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <button type="button" onClick={() => remove(index)} className="text-rose-500 px-2 font-bold shrink-0">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
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
                isOpen={confirmAction?.type === 'APPROVE'}
                title="Approve Bill"
                message="Are you sure you want to APPROVE this bill? This verifies its validity. It will be ready to be posted."
                confirmText="Yes, Approve"
                type="primary"
                onConfirm={() => confirmAction && approveMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />

            <ConfirmDialog
                isOpen={confirmAction?.type === 'POST'}
                title="Post to General Ledger"
                message="Are you sure you want to POST this bill? This will permanently generate a Journal Entry crediting Accounts Payable and debiting Expenses."
                confirmText="Yes, Post to GL"
                type="success"
                onConfirm={() => confirmAction && postMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />

            <ConfirmDialog
                isOpen={confirmAction?.type === 'PAY'}
                title="Mark Bill Paid"
                message="Are you sure you want to mark this bill as fully PAID? This closes out the payable."
                confirmText="Yes, Mark Paid"
                type="primary"
                onConfirm={() => confirmAction && payMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
