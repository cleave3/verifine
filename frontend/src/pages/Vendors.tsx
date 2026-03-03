import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "../lib/axios";
import { RoleGuard } from "../components/RoleGuard";

const vendorSchema = z.object({
    name: z.string().min(2),
    contact_name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    payment_terms_days: z.coerce.number().min(0),
});
type VendorFormValues = z.infer<typeof vendorSchema>;

export default function Vendors() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: vendorsResponse, isLoading } = useQuery({
        queryKey: ["vendors"],
        queryFn: async () => {
            const { data } = await api.get("/ap/vendors/");
            return data;
        },
    });

    const vendors = vendorsResponse?.data || [];

    const createMutation = useMutation({
        mutationFn: async (newVendor: VendorFormValues) => {
            return await api.post("/ap/vendors/", newVendor);
        },
        onSuccess: () => {
            toast.success("Vendor added successfully");
            queryClient.invalidateQueries({ queryKey: ["vendors"] });
            setIsModalOpen(false);
            form.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to add vendor");
        }
    });

    const form = useForm<any>({
        // @ts-ignore
        resolver: zodResolver(vendorSchema),
        defaultValues: { name: "", contact_name: "", email: "", phone: "", payment_terms_days: 30 },
    });

    const onSubmit = (data: any) => createMutation.mutate(data);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Vendors Directory</h1>
                <RoleGuard allowedRoles={['admin', 'controller', 'clerk']}>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition"
                    >
                        + Add Vendor
                    </button>
                </RoleGuard>
            </div>

            {isLoading ? (
                <div className="text-slate-500 animate-pulse">Loading vendors...</div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Vendor Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Terms</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {vendors.map((v: any) => (
                                <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{v.name}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{v.contact_name || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{v.email || "-"}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">Net {v.payment_terms_days}</td>
                                </tr>
                            ))}
                            {vendors.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        No vendors configured.
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
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Add Vendor</h2>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                                <input {...form.register("name")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
                                <input {...form.register("contact_name")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                                <input type="email" {...form.register("email")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Payment Terms (Days)</label>
                                <input type="number" {...form.register("payment_terms_days")} className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2" />
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
        </div>
    );
}
