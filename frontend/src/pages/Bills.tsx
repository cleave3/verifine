import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import api from "../lib/axios";
import { ConfirmDialog } from "../components/ConfirmDialog";

const billSchema = z.object({
    vendor_id: z.coerce.number().min(1),
    period_id: z.coerce.number().min(1),
    bill_date: z.string(),
    due_date: z.string(),
    bill_number: z.string().min(1),
    description: z.string().optional(),
    lines: z.array(z.object({
        account_id: z.coerce.number().min(1),
        amount: z.coerce.number().min(0.01),
        description: z.string().optional()
    })).min(1),
});
type BillFormValues = z.infer<typeof billSchema>;

export default function Bills() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ type: 'APPROVE' | 'POST' | 'PAY', id: number } | null>(null);

    const { data: billsRes, isLoading } = useQuery({ queryKey: ["bills"], queryFn: async () => (await api.get("/ap/bills/")).data });
    const { data: venRes } = useQuery({ queryKey: ["vendors"], queryFn: async () => (await api.get("/ap/vendors/")).data });
    const { data: accRes } = useQuery({ queryKey: ["accounts"], queryFn: async () => (await api.get("/accounts/")).data });
    const { data: perRes } = useQuery({ queryKey: ["periods"], queryFn: async () => (await api.get("/periods/")).data });

    const bills = billsRes?.data || [];
    const vendors = venRes?.data || [];

    const getVendorName = (id: number) => vendors.find((v: any) => v.id === id)?.name || `ID: ${id}`;
    const accounts = accRes?.data?.filter((a: any) => a.type === 'EXPENSE' || a.type === 'ASSET') || [];
    const periods = perRes?.data?.filter((p: any) => p.status === "OPEN") || [];

    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const total = payload.lines.reduce((sum: number, line: any) => sum + Number(line.amount), 0);
            return await api.post("/ap/bills/", { ...payload, total_amount: total });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bills"] });
            setIsModalOpen(false);
            form.reset();
        },
    });

    const approveMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/ap/bills/${id}/approve`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
    });

    const postMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/ap/bills/${id}/post`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
    });

    const payMutation = useMutation({
        mutationFn: async (id: number) => await api.patch(`/ap/bills/${id}/pay`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bills"] }),
    });

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(billSchema),
        defaultValues: {
            vendor_id: 0, period_id: 0,
            bill_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            bill_number: "", description: "",
            lines: [{ account_id: 0, amount: 0, description: "" }]
        }
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Accounts Payable Bills</h1>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                    + Enter Bill
                </button>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading bills...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bill #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {bills.map((b: any) => (
                                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{b.bill_number}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-indigo-600 dark:text-indigo-400">{getVendorName(b.vendor_id)}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{format(new Date(b.bill_date), 'MMM d, yyyy')}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">${b.total_amount.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${b.status === 'APPROVED' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {b.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {b.status === 'DRAFT' && (
                                            <button onClick={() => setConfirmAction({ type: 'APPROVE', id: b.id })} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium whitespace-nowrap">Approve</button>
                                        )}
                                        {b.status === 'APPROVED' && (
                                            <button onClick={() => setConfirmAction({ type: 'POST', id: b.id })} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium whitespace-nowrap">Post to GL</button>
                                        )}
                                        {b.status === 'POSTED' && (
                                            <button onClick={() => setConfirmAction({ type: 'PAY', id: b.id })} className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium whitespace-nowrap">Mark Paid</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {bills.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No bills found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Enter Bill</h2>
                        <form onSubmit={form.handleSubmit((d: any) => createMutation.mutate(d))} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Bill Number</label>
                                    <input {...form.register("bill_number")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Memo</label>
                                    <input {...form.register("description")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Expenses/Items</h3>
                                    <button type="button" onClick={() => append({ account_id: 0, amount: 0, description: "" })} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">+ Add Line</button>
                                </div>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-center mb-2">
                                        <select {...form.register(`lines.${index}.account_id`)} className="flex-1 min-w-[150px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                            <option value={0}>Expense Account</option>
                                            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                        </select>
                                        <input type="number" step="0.01" placeholder="Amount" {...form.register(`lines.${index}.amount`)} className="w-32 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                        <button type="button" onClick={() => remove(index)} className="text-rose-500 px-2 font-bold">✕</button>
                                    </div>
                                ))}
                                {form.formState.errors.lines?.root && <p className="text-rose-500 text-sm mt-2">{form.formState.errors.lines.root.message}</p>}
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
