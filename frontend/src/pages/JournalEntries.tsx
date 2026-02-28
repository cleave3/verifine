import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import api from "../lib/axios";
import { exportToCsv } from "../lib/export";
import { Download } from "lucide-react";

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

    const { data: jeRes, isLoading } = useQuery({
        queryKey: ["journal-entries"],
        queryFn: async () => (await api.get("/journal-entries/")).data
    });
    const { data: accRes } = useQuery({
        queryKey: ["accounts"],
        queryFn: async () => (await api.get("/accounts/")).data
    });
    const { data: perRes } = useQuery({
        queryKey: ["periods"],
        queryFn: async () => (await api.get("/periods/")).data
    });

    const entries = jeRes?.data || [];
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

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading ledger...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {entries.map((je: any) => (
                                <tr key={je.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 text-sm font-medium font-mono text-slate-900 dark:text-white">{je.transaction_id}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{format(new Date(je.entry_date), 'MMM d, yyyy')}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{je.description}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase
                                            ${je.status === 'POSTED' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {je.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {je.status === 'DRAFT' && (
                                            <button onClick={() => postMutation.mutate(je.id)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium">
                                                Post
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {entries.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        No journal entries.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">New Journal Entry</h2>
                        <form onSubmit={form.handleSubmit((d: any) => createMutation.mutate(d))} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-center mb-2">
                                        <select {...form.register(`lines.${index}.account_id`)} className="flex-1 min-w-[150px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2">
                                            <option value={0}>Account</option>
                                            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                        </select>
                                        <input type="number" step="0.01" placeholder="Debit" {...form.register(`lines.${index}.debit`)} className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                        <input type="number" step="0.01" placeholder="Credit" {...form.register(`lines.${index}.credit`)} className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 text-right" />
                                        <button type="button" onClick={() => remove(index)} className="text-rose-500 px-2 font-bold">✕</button>
                                    </div>
                                ))}
                                {form.formState.errors.lines?.root && (
                                    <p className="text-rose-500 text-sm mt-2">{form.formState.errors.lines.root.message}</p>
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
        </div>
    );
}
