import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfMonth, endOfMonth } from "date-fns";
import api from "../lib/axios";
import { exportToCsv } from "../lib/export";
import { Download, ChevronLeft, ChevronRight, Filter } from "lucide-react";

const jeSchema = z.object({
    description: z.string().min(3),
    entry_date: z.string(),
    period_id: z.coerce.number().min(1),
    lines: z.array(z.object({
        account_id: z.coerce.number().min(1),
        debit: z.coerce.number().min(0).default(0),
        credit: z.coerce.number().min(0).default(0),
        description: z.string().optional()
    })).min(2),
}).refine(data => {
    const totalD = data.lines.reduce((acc, curr) => acc + curr.debit, 0);
    const totalC = data.lines.reduce((acc, curr) => acc + curr.credit, 0);
    return Math.abs(totalD - totalC) < 0.01 && totalD > 0;
}, { message: "Debits must equal credits and be greater than 0", path: ["lines"] });

type JEFormValues = z.infer<typeof jeSchema>;

export default function JournalEntries() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    const [page, setPage] = useState(1);

    // Filtering State
    const [statusFilter, setStatusFilter] = useState("");
    const [dateRangeType, setDateRangeType] = useState("this-month");
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

    const startDate = dateRangeType === "this-month" ? format(startOfMonth(new Date()), "yyyy-MM-dd") : customStartDate;
    const endDate = dateRangeType === "this-month" ? format(endOfMonth(new Date()), "yyyy-MM-dd") : customEndDate;

    const { data: jeRes, isLoading } = useQuery({
        queryKey: ["journal-entries", page, statusFilter, startDate, endDate],
        queryFn: async () => (await api.get("/journal-entries/", {
            params: {
                page,
                page_size: 10,
                status: statusFilter || undefined,
                start_date: startDate,
                end_date: endDate
            }
        })).data
    });
    const { data: accRes } = useQuery({
        queryKey: ["accounts"],
        queryFn: async () => (await api.get("/accounts/")).data
    });
    const { data: perRes } = useQuery({
        queryKey: ["periods"],
        queryFn: async () => (await api.get("/periods/")).data
    });

    const entries = jeRes?.data?.results || [];
    const pageInfo = jeRes?.data?.page_info || { current_page: 1, page_count: 1, total_count: 0, is_first_page: true, is_last_page: true };
    const accounts = accRes?.data || [];
    const periods = perRes?.data?.filter((p: any) => p.status === "OPEN") || [];

    const createMutation = useMutation({
        mutationFn: async (payload: JEFormValues) => await api.post("/journal-entries/", payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
            setIsModalOpen(false);
            form.reset();
        },
    });

    const postMutation = useMutation({
        mutationFn: async (id: number) => await api.post(`/journal-entries/${id}/post`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
    });

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(jeSchema),
        defaultValues: {
            description: "",
            entry_date: new Date().toISOString().split('T')[0],
            period_id: 0,
            lines: [
                { account_id: 0, debit: 0, credit: 0, description: "" },
                { account_id: 0, debit: 0, credit: 0, description: "" }
            ]
        }
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

    const handleExport = () => {
        if (!entries || entries.length === 0) return;

        let rows: any[][] = [];
        rows.push(["Entry ID", "Date", "Entry Memo", "Status", "Account Code", "Account Name", "Line Memo", "Debit", "Credit"]);

        // Build an account map for fast lookup
        const accountMap = new Map<number, any>(accounts.map((a: any) => [a.id, a]));

        entries.forEach((je: any) => {
            je.lines?.forEach((line: any) => {
                const acct = accountMap.get(line.account_id);
                rows.push([
                    je.transaction_id,
                    format(new Date(je.entry_date), 'yyyy-MM-dd'),
                    je.description || "",
                    je.status,
                    acct?.code || line.account_id,
                    acct?.name || "Unknown Account",
                    line.description || "",
                    line.debit || 0,
                    line.credit || 0
                ]);
            });
        });

        exportToCsv(`General_Ledger_${format(new Date(), 'yyyyMMdd')}.csv`, rows);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Journal Entries</h1>
                <div className="flex gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-4 py-2 rounded shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                        + New Entry
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-100 dark:border-slate-700 pb-2">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filter Entries</span>
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
                            <option value="POSTED">Posted</option>
                            <option value="VOIDED">Voided</option>
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
                <div className="text-slate-500 animate-pulse">Loading ledger...</div>
            ) : (
                <>
                    <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Date</th>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {entries.map((je: any) => (
                                    <tr key={je.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-4 sm:px-6 py-4 text-sm font-medium font-mono text-slate-900 dark:text-white">{je.transaction_id}</td>
                                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{format(new Date(je.entry_date), 'MMM d, yyyy')}</td>
                                        <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 dark:text-slate-300 min-w-[200px]">{je.description}</td>
                                        <td className="px-4 sm:px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase
                                                ${je.status === 'POSTED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                {je.status}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-sm flex items-center gap-3 flex-wrap min-w-[120px]">
                                            <button onClick={() => setSelectedEntry(je)} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded">
                                                View
                                            </button>
                                            {je.status === 'DRAFT' && (
                                                <button onClick={() => postMutation.mutate(je.id)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded">
                                                    Post
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {entries.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 sm:px-6 py-8 text-center text-slate-500">
                                            No journal entries.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 sm:px-6 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex flex-1 justify-between sm:hidden">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={pageInfo.is_first_page}
                                className="relative inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pageInfo.page_count, p + 1))}
                                disabled={pageInfo.is_last_page}
                                className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-slate-700 dark:text-slate-400">
                                    Showing <span className="font-medium">{(page - 1) * 10 + 1}</span> to <span className="font-medium">{Math.min(page * 10, pageInfo.total_count)}</span> of{' '}
                                    <span className="font-medium">{pageInfo.total_count}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={pageInfo.is_first_page}
                                        className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 dark:text-slate-500 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:z-20 focus:outline-offset-0">
                                        Page {page} of {pageInfo.page_count}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(pageInfo.page_count, p + 1))}
                                        disabled={pageInfo.is_last_page}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 dark:text-slate-500 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 w-full sm:w-[95%] md:max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">New Journal Entry</h2>
                        <form onSubmit={form.handleSubmit((d: any) => createMutation.mutate(d))} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Period</label>
                                    <select {...form.register("period_id")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                        <option value={0}>Select Period</option>
                                        {periods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
                                    <input type="date" {...form.register("entry_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description / Memo</label>
                                <input {...form.register("description")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Lines</h3>
                                    <button type="button" onClick={() => append({ account_id: 0, debit: 0, credit: 0, description: "" })} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add Line</button>
                                </div>
                                <div className="overflow-x-auto pb-4">
                                    <div className="min-w-[500px]">
                                        {fields.map((field, index) => (
                                            <div key={field.id} className="flex gap-2 items-center mb-2">
                                                <select {...form.register(`lines.${index}.account_id`)} className="flex-1 min-w-[150px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                                    <option value={0}>Account</option>
                                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                                </select>
                                                <input type="number" step="0.01" placeholder="Debit" {...form.register(`lines.${index}.debit`)} className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                                <input type="number" step="0.01" placeholder="Credit" {...form.register(`lines.${index}.credit`)} className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                                <button type="button" onClick={() => remove(index)} className="text-rose-500 px-2 font-bold shrink-0">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {form.formState.errors.lines?.root && (
                                    <p className="text-rose-500 text-sm mt-2">{form.formState.errors.lines.root.message as string}</p>
                                )}
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

            {selectedEntry && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 w-full sm:w-[95%] md:max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-200 dark:border-slate-700 pb-4 mb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white pb-1">Journal Entry Details</h2>
                                <p className="text-sm font-mono text-slate-500 break-all">ID: {selectedEntry.transaction_id} | Date: {format(new Date(selectedEntry.entry_date), 'MMM d, yyyy')}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase self-start sm:self-auto
                                ${selectedEntry.status === 'POSTED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                {selectedEntry.status}
                            </span>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-200 mb-1">Memo / Description</h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded border border-slate-200 dark:border-slate-700">
                                {selectedEntry.description || "N/A"}
                            </p>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-200 mb-2">Ledger Lines</h3>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Currency</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Exchange Rate</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Txn Debit</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Txn Credit</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-indigo-500 dark:text-indigo-400 uppercase">Base Debit</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-indigo-500 dark:text-indigo-400 uppercase">Base Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                    {selectedEntry.lines?.map((line: any, idx: number) => {
                                        const account = accounts.find((a: any) => a.id === line.account_id);
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm">
                                                <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{account?.code} - {account?.name}</td>
                                                <td className="px-4 py-2 text-slate-600 dark:text-slate-300 text-xs">{line.description || "-"}</td>
                                                <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300 text-right">{line.currency_code}</td>
                                                <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300 text-right">{line.exchange_rate}</td>
                                                <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300 text-right">{line.transaction_debit > 0 ? (line.transaction_debit).toFixed(2) : "-"}</td>
                                                <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300 text-right">{line.transaction_credit > 0 ? (line.transaction_credit).toFixed(2) : "-"}</td>
                                                <td className="px-4 py-2 font-mono text-slate-900 dark:text-white text-right">{line.base_debit > 0 ? (line.base_debit).toFixed(2) : "-"}</td>
                                                <td className="px-4 py-2 font-mono text-slate-900 dark:text-white text-right">{line.base_credit > 0 ? (line.base_credit).toFixed(2) : "-"}</td>
                                            </tr>
                                        );
                                    })}
                                    {/* Subtotal Row */}
                                    <tr className="bg-slate-50 dark:bg-slate-900 font-medium">
                                        <td colSpan={6} className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 text-xs uppercase cursor-default">Totals:</td>
                                        <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400 cursor-default">
                                            {selectedEntry.lines?.reduce((acc: number, l: any) => acc + (l.base_debit || 0), 0).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-indigo-600 dark:text-indigo-400 cursor-default">
                                            {selectedEntry.lines?.reduce((acc: number, l: any) => acc + (l.base_credit || 0), 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button onClick={() => setSelectedEntry(null)} className="px-6 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
