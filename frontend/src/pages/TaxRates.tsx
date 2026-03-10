import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taxService } from "../services/taxService";
import { accountService } from "../services/accountService";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { RoleGuard } from "../components/RoleGuard";

const taxRateSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    rate: z.coerce.number().min(0).max(1, "Rate must be between 0 and 1 (e.g. 0.075 for 7.5%)"),
    account_id: z.coerce.number().min(1, "Please select an account"),
    description: z.string().optional(),
    is_active: z.boolean().default(true)
});

type TaxRateFormValues = z.infer<typeof taxRateSchema>;

export default function TaxRates() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTax, setEditingTax] = useState<any>(null);

    const { data: taxesRes, isLoading } = useQuery({
        queryKey: ["taxes"],
        queryFn: taxService.getTaxes
    });

    const { data: accountsRes } = useQuery({
        queryKey: ["accounts"],
        queryFn: accountService.getAccounts
    });

    const taxes = taxesRes || [];
    const accounts = accountsRes?.data || [];

    const createMutation = useMutation({
        mutationFn: taxService.createTaxRate,
        onSuccess: () => {
            toast.success("Tax Rate created successfully");
            queryClient.invalidateQueries({ queryKey: ["taxes"] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to create tax rate");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: TaxRateFormValues }) => taxService.updateTaxRate(id, data),
        onSuccess: () => {
            toast.success("Tax Rate updated successfully");
            queryClient.invalidateQueries({ queryKey: ["taxes"] });
            closeModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to update tax rate");
        }
    });

    const form = useForm({
        resolver: zodResolver(taxRateSchema),
        defaultValues: { name: "", rate: 0, account_id: 0, description: "", is_active: true },
    });

    const openModal = (tax: any = null) => {
        if (tax) {
            setEditingTax(tax);
            form.reset({
                name: tax.name,
                rate: tax.rate,
                account_id: tax.account_id,
                description: tax.description || "",
                is_active: tax.is_active
            });
        } else {
            setEditingTax(null);
            form.reset({ name: "", rate: 0, account_id: 0, description: "", is_active: true });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingTax(null);
        form.reset();
    };

    const onSubmit = (data: TaxRateFormValues) => {
        if (editingTax) {
            updateMutation.mutate({ id: editingTax.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tax Rates</h1>
                <RoleGuard allowedRoles={['admin', 'controller']}>
                    <button onClick={() => openModal()} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                        + New Tax Rate
                    </button>
                </RoleGuard>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading taxes...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rate</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {taxes.map((tax: any) => {
                                const account = accounts.find((a: any) => a.id === tax.account_id);
                                return (
                                    <tr key={tax.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{tax.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{(tax.rate * 100).toFixed(2)}%</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{account ? `${account.code} - ${account.name}` : "Unknown"}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase
                                                ${tax.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                    'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                                                {tax.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <RoleGuard allowedRoles={['admin', 'controller']}>
                                                <button onClick={() => openModal(tax)} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                                    Edit
                                                </button>
                                            </RoleGuard>
                                        </td>
                                    </tr>
                                );
                            })}
                            {taxes.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No tax rates found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">
                            {editingTax ? "Edit Tax Rate" : "New Tax Rate"}
                        </h2>
                        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                                <input {...form.register("name")} placeholder="e.g. VAT 7.5%" className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                {form.formState.errors.name && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.name.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rate (Decimal, e.g. 0.075 for 7.5%)</label>
                                <input type="number" step="0.0001" {...form.register("rate")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                {form.formState.errors.rate && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.rate.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                                <input {...form.register("description")} placeholder="Optional description" className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Liability Account</label>
                                <select {...form.register("account_id")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                    <option value={0}>Select Account...</option>
                                    {accounts?.map((acc: any) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.code} - {acc.name}
                                        </option>
                                    ))}
                                </select>
                                {form.formState.errors.account_id && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.account_id.message}</p>}
                            </div>
                            <div className="flex items-center">
                                <input type="checkbox" {...form.register("is_active")} id="is_active" className="h-4 w-4 text-indigo-600 rounded border-slate-300" />
                                <label htmlFor="is_active" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">Active</label>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
