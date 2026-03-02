import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import api from "../lib/axios";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RoleGuard } from "../components/RoleGuard";

const periodSchema = z.object({
    name: z.string().min(3),
    start_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
    end_date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }),
});
type PeriodFormValues = z.infer<typeof periodSchema>;

export default function FiscalPeriods() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'LOCK' | 'CLOSE', id: number } | null>(null);

    const { data: periodsResponse, isLoading } = useQuery({
        queryKey: ["periods"],
        queryFn: async () => {
            const { data } = await api.get("/periods/");
            return data;
        },
    });

    const periods = periodsResponse?.data || [];

    const createMutation = useMutation({
        mutationFn: async (newPeriod: PeriodFormValues) => {
            return await api.post("/periods/", newPeriod);
        },
        onSuccess: () => {
            toast.success("Fiscal period opened successfully");
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            setIsModalOpen(false);
            form.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to open fiscal period");
        }
    });

    const closeMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/periods/${id}/close`),
        onSuccess: () => {
            toast.success("Fiscal period closed successfully");
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            setConfirmAction(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to close fiscal period");
        }
    });

    const lockMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/periods/${id}/lock`),
        onSuccess: () => {
            toast.success("Fiscal period locked successfully");
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            setConfirmAction(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to lock fiscal period");
        }
    });

    const form = useForm<PeriodFormValues>({
        resolver: zodResolver(periodSchema),
        defaultValues: { name: "", start_date: "", end_date: "" },
    });

    const onSubmit = (data: PeriodFormValues) => createMutation.mutate(data);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fiscal Periods</h1>
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
                                                <button onClick={() => setConfirmAction({ type: 'CLOSE', id: period.id })} className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300 font-medium whitespace-nowrap">
                                                    Hard Close
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
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start Date</label>
                                <input type="date" {...form.register("start_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">End Date</label>
                                <input type="date" {...form.register("end_date")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
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

            <ConfirmDialog
                isOpen={confirmAction?.type === 'LOCK'}
                title="Lock Fiscal Period"
                message="Are you sure you want to lock this period? This will prevent new daily operational transactions from being posted in this period, but still allow adjusting journal entries."
                confirmText="Yes, Lock Period"
                type="warning"
                onConfirm={() => confirmAction && lockMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />

            <ConfirmDialog
                isOpen={confirmAction?.type === 'CLOSE'}
                title="Hard Close Fiscal Period"
                message="Are you sure you want to HARD CLOSE this period? This is irreversible. Absolutely no new entries can be posted."
                confirmText="Yes, Hard Close"
                type="danger"
                onConfirm={() => confirmAction && closeMutation.mutate(confirmAction.id)}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
