import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "react-router-dom";
import { accountService } from "../services/accountService";
import { RoleGuard } from "../components/RoleGuard";
import { ConfirmDialog } from "../components/ConfirmDialog";

const accountSchema = z.object({
    code: z.string().min(3).max(10),
    name: z.string().min(2),
    type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
    description: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountSchema>;

export default function Accounts() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{type: 'activate' | 'deactivate', account: any} | null>(null);

    const { data: accountsResponse, isLoading } = useQuery({
        queryKey: ["accounts"],
        queryFn: accountService.getAccounts,
    });

    const accounts = accountsResponse?.data || [];

    const createMutation = useMutation({
        mutationFn: accountService.createAccount,
        onSuccess: () => {
            toast.success("Account created successfully");
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
            setIsModalOpen(false);
            form.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to create account");
        }
    });

    const actMutation = useMutation({
        mutationFn: accountService.activateAccount,
        onSuccess: () => {
            toast.success("Account activated successfully");
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to activate account");
        }
    });

    const deactMutation = useMutation({
        mutationFn: accountService.deactivateAccount,
        onSuccess: () => {
            toast.success("Account deactivated successfully");
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to deactivate account");
        }
    });

    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountSchema),
        defaultValues: { code: "", name: "", type: "ASSET", description: "" },
    });

    const onSubmit = (data: AccountFormValues) => {
        createMutation.mutate(data);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chart of Accounts</h1>
                <RoleGuard allowedRoles={['admin', 'controller', 'accountant']}>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition"
                    >
                        + New Account
                    </button>
                </RoleGuard>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading accounts...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {accounts.map((account: any) => (
                                <tr key={account.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 text-sm font-medium">
                                        <Link to={`/accounts/${account.id}/entries`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                            {account.code}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        <Link to={`/accounts/${account.id}/entries`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                                            {account.name}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400">
                                            {account.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {account.is_active ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 font-medium font-mono">Active</span>
                                        ) : (
                                            <span className="text-rose-500 font-mono">Inactive</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <RoleGuard allowedRoles={['admin', 'accountant']}>
                                            <button
                                                onClick={() => setConfirmAction({ type: account.is_active ? 'deactivate' : 'activate', account })}
                                                className={`text-xs font-medium px-3 py-1 rounded shadow-sm transition ${account.is_active ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50'}`}
                                            >
                                                {account.is_active ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </RoleGuard>
                                    </td>
                                </tr>
                            ))}
                            {accounts.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        No accounts found. Start by creating your Chart of Accounts.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Create New Account</h2>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Account Code</label>
                                <input {...form.register("code")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Account Name</label>
                                <input {...form.register("name")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
                                <select {...form.register("type")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                    <option value="ASSET">Asset</option>
                                    <option value="LIABILITY">Liability</option>
                                    <option value="EQUITY">Equity</option>
                                    <option value="REVENUE">Revenue</option>
                                    <option value="EXPENSE">Expense</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                                <textarea {...form.register("description")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" rows={3} />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {createMutation.isPending ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog 
                isOpen={!!confirmAction}
                title={confirmAction?.type === 'activate' ? 'Activate Account' : 'Deactivate Account'}
                message={confirmAction?.type === 'activate' 
                    ? `Are you sure you want to activate the account "${confirmAction?.account?.name}" (${confirmAction?.account?.code})?` 
                    : `Are you sure you want to deactivate the account "${confirmAction?.account?.name}" (${confirmAction?.account?.code})? This will prevent future entries from using this account.`}
                confirmText={confirmAction?.type === 'activate' ? 'Activate' : 'Deactivate'}
                type={confirmAction?.type === 'activate' ? 'primary' : 'danger'}
                onConfirm={() => {
                    if (!confirmAction) return;
                    if (confirmAction.type === 'activate') {
                        actMutation.mutate(confirmAction.account.id);
                    } else if (confirmAction.type === 'deactivate') {
                        deactMutation.mutate(confirmAction.account.id);
                    }
                }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
}
