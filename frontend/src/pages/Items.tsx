import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { itemService } from "../services/itemService";
import { accountService } from "../services/accountService";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Package, Plus, Edit2, Archive, BarChart3 } from "lucide-react";

const itemSchema = z.object({
    type: z.enum(["INVENTORY", "NON_INVENTORY", "SERVICE"]),
    name: z.string().min(1, "Name is required"),
    sku: z.string().optional(),
    description: z.string().optional(),
    quantity_on_hand: z.coerce.number().default(0),
    unit_cost: z.coerce.number().default(0),
    unit_price: z.coerce.number().default(0),
    income_account_id: z.coerce.number().optional().nullable().transform(v => v === 0 ? null : v),
    cogs_account_id: z.coerce.number().optional().nullable().transform(v => v === 0 ? null : v),
    asset_account_id: z.coerce.number().optional().nullable().transform(v => v === 0 ? null : v),
});

export default function Items() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const { data: itemRes, isLoading } = useQuery({ queryKey: ["items"], queryFn: itemService.getItems });
    const { data: accRes } = useQuery({ queryKey: ["accounts"], queryFn: accountService.getAccounts });

    const items = itemRes?.data || [];
    const accounts = accRes?.data || [];

    // Group accounts for easy dropdowns
    const incomeAccounts = accounts.filter((a: any) => a.type === 'REVENUE');
    const expenseAccounts = accounts.filter((a: any) => a.type === 'EXPENSE' || a.type === 'COGS');
    const assetAccounts = accounts.filter((a: any) => a.type === 'ASSET' && a.code !== '1100' && a.code !== '1200'); // Excluding bank and AR

    const getAccountName = (id: number) => accounts.find((a: any) => a.id === id)?.name;

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(itemSchema),
        defaultValues: {
            type: "SERVICE", name: "", sku: "", description: "",
            quantity_on_hand: 0, unit_cost: 0, unit_price: 0,
            income_account_id: 0, cogs_account_id: 0, asset_account_id: 0
        }
    });

    const watchedType = form.watch("type");

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            if (editingItem) {
                return await itemService.updateItem(editingItem.id, payload);
            }
            return await itemService.createItem(payload);
        },
        onSuccess: () => {
            toast.success(`Item ${editingItem ? 'updated' : 'created'} successfully`);
            queryClient.invalidateQueries({ queryKey: ["items"] });
            setIsModalOpen(false);
            form.reset();
            setEditingItem(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to save item");
        }
    });

    const handleEdit = (item: any) => {
        setEditingItem(item);
        form.reset({
            ...item,
            income_account_id: item.income_account_id || 0,
            cogs_account_id: item.cogs_account_id || 0,
            asset_account_id: item.asset_account_id || 0,
        });
        setIsModalOpen(true);
    };

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center justify-between mb-8">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-gray-100 flex items-center">
                        <Package className="w-6 h-6 mr-2 text-indigo-500" />
                        Products & Services
                    </h1>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
                        Manage your catalog. Inventory items track stock and COGS. Services and Non-Inventory items track revenue and expenses.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            form.reset({
                                type: "SERVICE", name: "", sku: "", description: "",
                                quantity_on_hand: 0, unit_cost: 0, unit_price: 0,
                                income_account_id: 0, cogs_account_id: 0, asset_account_id: 0
                            });
                            setIsModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Item
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="animate-pulse flex flex-col gap-4">
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-lg mb-8 p-8 flex items-center justify-center flex-col min-h-[400px]">
                    <Package className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No products or services</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
                        Create a product or service to get started tracking inventory and automating invoices.
                    </p>
                </div>
            ) : (
                <div className="mt-8 flex flex-col">
                    <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                                        <tr>
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-200 sm:pl-6">Name / SKU</th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900 dark:text-slate-200">Type</th>
                                            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-200">Unit Price</th>
                                            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-200">Unit Cost</th>
                                            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900 dark:text-slate-200">Qty on Hand</th>
                                            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                        {items.map((item: any) => (
                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                                                    <div className="flex items-center">
                                                        <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                                        {item.sku && <div className="ml-2 text-slate-500 text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{item.sku}</div>}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${item.type === 'INVENTORY' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/10 dark:text-indigo-400' :
                                                        item.type === 'SERVICE' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-400' :
                                                            'bg-slate-100 text-slate-800 dark:bg-slate-400/10 dark:text-slate-400'
                                                        }`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-slate-900 dark:text-slate-200">
                                                    {item.unit_price > 0 ? Number(item.unit_price).toLocaleString() : '-'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right font-medium text-slate-900 dark:text-slate-200">
                                                    {item.unit_cost > 0 ? Number(item.unit_cost).toLocaleString() : '-'}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-slate-500 dark:text-slate-400">
                                                    {item.type === 'INVENTORY' ? item.quantity_on_hand : 'N/A'}
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4">Edit</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingItem ? 'Edit Item' : 'New Item'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500">✕</button>
                        </div>

                        <form onSubmit={form.handleSubmit((d: any) => mutation.mutate(d))} className="space-y-6">

                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
                                        <select {...form.register("type")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                            <option value="SERVICE">Service</option>
                                            <option value="NON_INVENTORY">Non-Inventory Part</option>
                                            <option value="INVENTORY">Inventory Product</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                                        <input {...form.register("name")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                                        {form.formState.errors.name && <p className="text-rose-500 text-xs mt-1">{form.formState.errors.name.message as string}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">SKU (Optional)</label>
                                        <input {...form.register("sku")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description (Optional)</label>
                                        <textarea {...form.register("description")} rows={2} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Sales Info */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Sales Information</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sales Price / Rate</label>
                                        <input type="number" step="0.01" {...form.register("unit_price")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Income Account</label>
                                        <select {...form.register("income_account_id")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                            <option value={0}>Select Income Account...</option>
                                            {incomeAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Purchasing Info */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2">Purchasing Information</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cost</label>
                                        <input type="number" step="0.01" {...form.register("unit_cost")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Expense/COGS Account</label>
                                        <select {...form.register("cogs_account_id")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                            <option value={0}>Select Expense Account...</option>
                                            {expenseAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Inventory specific info */}
                            {watchedType === "INVENTORY" && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/30 space-y-4">
                                    <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 flex items-center">
                                        <BarChart3 className="w-4 h-4 mr-2" />
                                        Inventory Tracking
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Initial Quantity on Hand</label>
                                            <input type="number" {...form.register("quantity_on_hand")} disabled={!!editingItem} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm disabled:opacity-50 focus:border-indigo-500 hover:disabled:cursor-not-allowed focus:ring-indigo-500 sm:text-sm p-2 border" />
                                            {!!editingItem && <p className="text-xs text-slate-500 mt-1">Quantity is adjusted through Bills and Invoices.</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Inventory Asset Account</label>
                                            <select {...form.register("asset_account_id")} className="mt-1 block w-full rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border">
                                                <option value={0}>Select Asset Account...</option>
                                                {assetAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" disabled={mutation.isPending} className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50">
                                    {mutation.isPending ? 'Saving...' : 'Save Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
