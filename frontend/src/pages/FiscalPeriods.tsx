import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { accountService } from "../services/accountService";
import { fiscalPeriodService } from "../services/fiscalPeriodService";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RoleGuard } from "../components/RoleGuard";

const periodSchema = z.object({
    name: z.string().min(3),
    start_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
    end_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
}).superRefine((data, ctx) => {
    if (new Date(data.start_date) >= new Date(data.end_date)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Start date must be before end date",
            path: ["end_date"]
        });
    }
});
type PeriodFormValues = z.infer<typeof periodSchema>;

export default function FiscalPeriods() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'LOCK' | 'CLOSE', id: number } | null>(null);

    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [periodToClose, setPeriodToClose] = useState<any>(null);

    const { data: accRes } = useQuery({ queryKey: ["accounts"], queryFn: accountService.getAccounts });
    const accounts = accRes?.data?.filter((a: any) => a.type === 'EQUITY') || [];

    const { data: periodsResponse, isLoading } = useQuery({
        queryKey: ["periods"],
        queryFn: fiscalPeriodService.getPeriods,
    });

    const periods = periodsResponse?.data || [];

    const createMutation = useMutation({
        mutationFn: fiscalPeriodService.createPeriod,
        onSuccess: () => {
            toast.success("Fiscal period opened successfully");
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            setIsModalOpen(false);
            form.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.response?.data?.detail || "Failed to open fiscal period");
        }
    });

    const closeMutation = useMutation({
        mutationFn: fiscalPeriodService.closePeriod,
        onSuccess: () => {
            toast.success("Fiscal period closed and Net Income transferred to Retained Earnings.");
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            setIsCloseModalOpen(false);
            setPeriodToClose(null);
            closeForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || err.response?.data?.detail || "Failed to close fiscal period");
        }
    });

    const lockMutation = useMutation({
        mutationFn: fiscalPeriodService.lockPeriod,
        onSuccess: () => {
            toast.success("Fiscal period locked successfully");
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            setConfirmAction(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to lock fiscal period");
        }
    });

    const form = useForm<PeriodFormValues>({
        resolver: zodResolver(periodSchema),
        defaultValues: { name: "", start_date: "", end_date: "" },
    });

    const closeSchema = z.object({
        retained_earnings_account_id: z.coerce.number().min(1, "Please select an account")
    });
    const closeForm = useForm({
        resolver: zodResolver(closeSchema),
        defaultValues: { retained_earnings_account_id: 0 }
    });

    const onSubmit = (data: PeriodFormValues) => createMutation.mutate(data);
    const onCloseSubmit = (data: any) => {
        if (!periodToClose) return;
        closeMutation.mutate({ id: periodToClose.id, retained_earnings_account_id: data.retained_earnings_account_id });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fiscal Periods & Year-End Close</h1>
                <RoleGuard allowedRoles={['admin', 'controller']}>
                    <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                        + Open New Month
                    </button>
                </RoleGuard>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading periods...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Start Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">End Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {periods.map((period: any) => (
                                <tr key={period.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{period.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{format(new Date(period.start_date), "MMM d, yyyy")}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{format(new Date(period.end_date), "MMM d, yyyy")}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase
                                            ${period.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                period.status === 'LOCKED' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                                                    'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                            {period.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm flex gap-3">
                                        {period.status === "OPEN" && (
                                            <RoleGuard allowedRoles={['admin', 'controller']}>
                                                <button onClick={() => setConfirmAction({ type: 'LOCK', id: period.id })} className="text-orange-600 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300 font-medium whitespace-nowrap">
                                                    Lock Period
                                                </button>
                                            </RoleGuard>
                                        )}
                                        {period.status !== "CLOSED" && (
                                            <RoleGuard allowedRoles={['admin', 'controller']}>
                                                <button onClick={() => { setPeriodToClose(period); setIsCloseModalOpen(true); }} className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium whitespace-nowrap">
                                                    Hard Close / Year-End
                                                </button>
                                            </RoleGuard>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {periods.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No fiscal periods found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Open Period</h2>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                                <input {...form.register("name")} placeholder="e.g. March 2026" className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                {form.formState.errors.name && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.name.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</label>
                                <input type="date" {...form.register("start_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                {form.formState.errors.start_date && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.start_date.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">End Date</label>
                                <input type="date" {...form.register("end_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                {form.formState.errors.end_date && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.end_date.message}</p>}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {createMutation.isPending ? "Opening..." : "Open"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isCloseModalOpen && periodToClose && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-rose-200 dark:border-rose-900/50">
                        <h2 className="text-xl font-bold mb-2 text-rose-600 dark:text-rose-400">Hard Close: {periodToClose.name}</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            Closing a period is irreversible. This action will compute the Net Income for this period and automatically generate a permanent Journal Entry that zeroes out all Revenue and Expense accounts, transferring the Net Income into your Retained Earnings equity account.
                        </p>
                        <form onSubmit={closeForm.handleSubmit(onCloseSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Retained Earnings Account</label>
                                <select {...closeForm.register("retained_earnings_account_id")} className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                    <option value={0}>-- Select Equity Account --</option>
                                    {accounts.map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                                {closeForm.formState.errors.retained_earnings_account_id && <p className="text-rose-500 text-xs mt-1">{closeForm.formState.errors.retained_earnings_account_id.message as string}</p>}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => { setIsCloseModalOpen(false); setPeriodToClose(null); }} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={closeMutation.isPending} className="px-4 py-2 bg-rose-600 text-white font-medium rounded-md hover:bg-rose-700 transition">
                                    {closeMutation.isPending ? "Closing..." : "Execute Year-End Close"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmAction?.type === 'LOCK'}
                title="Lock Fiscal Period"
                message="Are you sure you want to lock this period? This will prevent new daily operational transactions from being posted in this period, but still allow adjusting journal entries."
                confirmText="Yes, Lock Period"
                type="warning"
                onConfirm={() => confirmAction && lockMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
