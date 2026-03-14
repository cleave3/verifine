import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { accountService } from "../services/accountService";
import { ChevronLeft, ChevronRight, Filter, ArrowLeft } from "lucide-react";
import { useCurrencyStore } from "../store/currencyStore";

export default function AccountEntries() {
    const { id } = useParams<{ id: string }>();
    const { formatCurrency } = useCurrencyStore();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("");
    const [dateRangeType, setDateRangeType] = useState("this-month");
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

    const startDate = dateRangeType === "this-month" ? format(startOfMonth(new Date()), "yyyy-MM-dd") : customStartDate;
    const endDate = dateRangeType === "this-month" ? format(endOfMonth(new Date()), "yyyy-MM-dd") : customEndDate;

    const { data: accountRes } = useQuery({
        queryKey: ["account", id],
        queryFn: () => accountService.getAccounts().then(res => res.data.find((a: any) => a.id === Number(id))),
        enabled: !!id
    });

    const { data: entriesRes, isLoading } = useQuery({
        queryKey: ["account-entries", id, page, statusFilter, startDate, endDate],
        queryFn: () => accountService.getAccountEntries(Number(id), {
            page,
            page_size: 10,
            status: statusFilter || undefined,
            start_date: startDate,
            end_date: endDate
        }),
        enabled: !!id
    });

    const entries = entriesRes?.data?.results || [];
    const pageInfo = entriesRes?.data?.meta || { current_page: 1, page_count: 1, total_count: 0, is_first_page: true, is_last_page: true };
    const account = accountRes;

    return (
        <div className="p-6">
            <div className="mb-6">
                <Link to="/accounts" className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:underline mb-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Chart of Accounts
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">
                    Entries for {account ? `${account.code} - ${account.name}` : "Account"}
                </h1>
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
                <div className="text-slate-500 animate-pulse">Loading entries...</div>
            ) : (
                <>
                    <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-x-auto border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reference</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Debit</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {entries.map((entry: any) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {format(new Date(entry.entry_date), 'MMM d, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium font-mono text-slate-900 dark:text-white">
                                            {entry.transaction_id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                            <div className="font-medium text-slate-900 dark:text-white">{entry.header_description}</div>
                                            {entry.description && <div className="text-xs text-slate-500">{entry.description}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase
                                                ${entry.status === 'POSTED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                {entry.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-slate-900 dark:text-white">
                                            {entry.base_debit > 0 ? formatCurrency(entry.base_debit) : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono text-slate-900 dark:text-white">
                                            {entry.base_credit > 0 ? formatCurrency(entry.base_credit) : "-"}
                                        </td>
                                    </tr>
                                ))}
                                {entries.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                            No entries found for this account.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 sm:px-6 border border-slate-200 dark:border-slate-700 rounded-lg">
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
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:z-20 focus:outline-offset-0">
                                        Page {page} of {pageInfo.page_count}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(pageInfo.page_count, p + 1))}
                                        disabled={pageInfo.is_last_page}
                                        className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 dark:text-slate-500 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
