import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { fixedAssetService } from "../services/fixedAssetService";
import { accountService } from "../services/accountService";
import { fiscalPeriodService } from "../services/fiscalPeriodService";
import { RoleGuard } from "../components/RoleGuard";
import { Building, Plus, Trash2, ArrowDownRight } from "lucide-react";
import { useCurrencyStore } from "../store/currencyStore";
import { useConfirmStore } from "../store/confirmStore";

const assetSchema = z.object({
    asset_name: z.string().min(1, "Asset name is required"),
    description: z.string().optional(),
    serial_number: z.string().optional(),
    purchase_date: z.string().min(1, "Purchase date is required"),
    purchase_price: z.coerce.number().min(0.01, "Price must be greater than 0"),
    salvage_value: z.coerce.number().min(0).default(0),
    useful_life_months: z.coerce.number().min(1, "Useful life is required").default(12),
    asset_account_id: z.coerce.number().min(1, "Asset account is required"),
    depreciation_expense_account_id: z.coerce.number().min(1, "Depreciation expense account is required"),
    accumulated_depreciation_account_id: z.coerce.number().min(1, "Accumulated depreciation account is required"),
});

const depreciationSchema = z.object({
    target_date: z.string().min(1, "Target date is required"),
    period_id: z.coerce.number().min(1, "Fiscal period is required"),
});

export default function FixedAssets() {
    const queryClient = useQueryClient();
    const { formatCurrency } = useCurrencyStore();
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false);

    const { data: assetsRes, isLoading: isLoadingAssets } = useQuery({
        queryKey: ["fixed-assets"],
        queryFn: fixedAssetService.getAssets,
    });
    const assets = assetsRes?.data || [];

    const { data: accountsRes } = useQuery({
        queryKey: ["accounts"],
        queryFn: accountService.getAccounts,
    });
    const accounts = accountsRes?.data || [];

    const { data: periodsRes } = useQuery({
        queryKey: ["fiscal-periods"],
        queryFn: fiscalPeriodService.getPeriods,
    });
    const periods = periodsRes?.data || [];

    // Filtered account lists
    const fixedAssetAccounts = accounts.filter((a: any) => a.type === 'ASSET');
    const expenseAccounts = accounts.filter((a: any) => a.type === 'EXPENSE');
    const contraAssetAccounts = accounts.filter((a: any) => a.type === 'ASSET' || a.type === 'LIABILITY'); // Typically a contra-asset or liability type depending on setup

    const assetForm = useForm({
        resolver: zodResolver(assetSchema),
        defaultValues: {
            asset_name: "",
            description: "",
            serial_number: "",
            purchase_date: new Date().toISOString().split("T")[0],
            purchase_price: 0,
            salvage_value: 0,
            useful_life_months: 12,
            asset_account_id: "",
            depreciation_expense_account_id: "",
            accumulated_depreciation_account_id: "",
        },
    });

    const depreciationForm = useForm({
        resolver: zodResolver(depreciationSchema),
        defaultValues: { target_date: new Date().toISOString().split("T")[0], period_id: "" },
    });

    const createAssetMutation = useMutation({
        mutationFn: fixedAssetService.createAsset,
        onSuccess: () => {
            toast.success("Fixed asset registered successfully");
            queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
            setIsAssetModalOpen(false);
            assetForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to register fixed asset");
        },
    });

    const runDepreciationMutation = useMutation({
        mutationFn: fixedAssetService.runDepreciation,
        onSuccess: () => {
            toast.success("Depreciation run successfully");
            queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
            setIsDepreciationModalOpen(false);
            depreciationForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to run depreciation");
        },
    });

    const disposeAssetMutation = useMutation({
        mutationFn: fixedAssetService.disposeAsset,
        onSuccess: () => {
            toast.success("Asset disposed successfully");
            queryClient.invalidateQueries({ queryKey: ["fixed-assets"] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to dispose asset");
        },
    });

    const { confirm } = useConfirmStore();

    const onSubmitAsset = (data: any) => createAssetMutation.mutate(data);
    const onSubmitDepreciation = (data: any) => runDepreciationMutation.mutate(data);

    const handleDispose = async (assetId: number) => {
        const confirmed = await confirm({
            title: "Dispose Asset",
            message: "Are you sure you want to dispose of this asset? This will calculate final depreciation and remove it from the active register.",
            confirmText: "Yes, Dispose Asset",
            type: "danger"
        });

        if (confirmed) {
            disposeAssetMutation.mutate(assetId);
        }
    };

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center justify-between mb-8">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Building className="w-6 h-6 mr-2 text-indigo-500" />
                        Fixed Assets
                    </h1>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
                        Manage your company's fixed assets and automate periodic depreciation.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
                    <RoleGuard allowedRoles={["admin", "controller", "accountant"]}>
                        <button
                            onClick={() => setIsDepreciationModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                        >
                            <ArrowDownRight className="w-4 h-4 mr-2" />
                            Run Depreciation
                        </button>
                    </RoleGuard>
                    <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                        <button
                            onClick={() => setIsAssetModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            New Asset
                        </button>
                    </RoleGuard>
                </div>
            </div>

            {isLoadingAssets ? (
                <div className="text-slate-500 animate-pulse">Loading fixed assets...</div>
            ) : assets.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-lg mb-8 p-8 flex items-center justify-center flex-col min-h-[400px]">
                    <Building className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No fixed assets</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
                        Register a new fixed asset to track its value and automate depreciation entries.
                    </p>
                    <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                        <button
                            onClick={() => setIsAssetModalOpen(true)}
                            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            Register Asset
                        </button>
                    </RoleGuard>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Asset Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Purchase Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Purchase Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Useful Life</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {assets.map((asset: any) => (
                                <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                        <div>{asset.asset_name}</div>
                                        {asset.serial_number && <div className="text-xs text-slate-500">SN: {asset.serial_number}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {asset.purchase_date}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {formatCurrency(asset.purchase_price)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                        {asset.useful_life_months} months
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${asset.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                            }`}>
                                            {asset.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {asset.status === 'ACTIVE' && (
                                            <RoleGuard allowedRoles={["admin", "controller"]}>
                                                <button
                                                    onClick={() => handleDispose(asset.id)}
                                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
                                                    title="Dispose Asset"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </RoleGuard>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Register Asset Modal */}
            {isAssetModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Register Fixed Asset</h2>
                        <form onSubmit={assetForm.handleSubmit(onSubmitAsset)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Asset Name <span className="text-red-500">*</span></label>
                                    <input
                                        {...assetForm.register("asset_name")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {assetForm.formState.errors.asset_name && (
                                        <p className="mt-1 text-sm text-red-600">{assetForm.formState.errors.asset_name.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Serial Number</label>
                                    <input
                                        {...assetForm.register("serial_number")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                                <textarea
                                    {...assetForm.register("description")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    rows={2}
                                />
                            </div>

                            <h3 className="font-semibold text-slate-900 dark:text-white mt-6 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">Financial Details</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Purchase Date <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        {...assetForm.register("purchase_date")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {assetForm.formState.errors.purchase_date && (
                                        <p className="mt-1 text-sm text-red-600">{assetForm.formState.errors.purchase_date.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Purchase Price <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...assetForm.register("purchase_price")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {assetForm.formState.errors.purchase_price && (
                                        <p className="mt-1 text-sm text-red-600">{assetForm.formState.errors.purchase_price.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Salvage Value</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...assetForm.register("salvage_value")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Useful Life (Months) <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    {...assetForm.register("useful_life_months")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                />
                            </div>

                            <h3 className="font-semibold text-slate-900 dark:text-white mt-6 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">Account Mapping</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fixed Asset Account <span className="text-red-500">*</span></label>
                                    <select
                                        {...assetForm.register("asset_account_id")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    >
                                        <option value="">Select Asset Account</option>
                                        {fixedAssetAccounts.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                    {assetForm.formState.errors.asset_account_id && (
                                        <p className="mt-1 text-sm text-red-600">{assetForm.formState.errors.asset_account_id.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Accumulated Depreciation Account <span className="text-red-500">*</span></label>
                                    <select
                                        {...assetForm.register("accumulated_depreciation_account_id")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    >
                                        <option value="">Select Contra-Asset Account</option>
                                        {contraAssetAccounts.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                    {assetForm.formState.errors.accumulated_depreciation_account_id && (
                                        <p className="mt-1 text-sm text-red-600">{assetForm.formState.errors.accumulated_depreciation_account_id.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Depreciation Expense Account <span className="text-red-500">*</span></label>
                                    <select
                                        {...assetForm.register("depreciation_expense_account_id")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    >
                                        <option value="">Select Expense Account</option>
                                        {expenseAccounts.map((a: any) => (
                                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                        ))}
                                    </select>
                                    {assetForm.formState.errors.depreciation_expense_account_id && (
                                        <p className="mt-1 text-sm text-red-600">{assetForm.formState.errors.depreciation_expense_account_id.message}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button type="button" onClick={() => setIsAssetModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createAssetMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {createAssetMutation.isPending ? "Registering..." : "Register Asset"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Run Depreciation Modal */}
            {isDepreciationModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Run Depreciation</h2>
                        <form onSubmit={depreciationForm.handleSubmit(onSubmitDepreciation)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Target Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    {...depreciationForm.register("target_date")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                />
                                {depreciationForm.formState.errors.target_date && (
                                    <p className="mt-1 text-sm text-red-600">{depreciationForm.formState.errors.target_date.message}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fiscal Period <span className="text-red-500">*</span></label>
                                <select
                                    {...depreciationForm.register("period_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select a period...</option>
                                    {periods.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.start_date} to {p.end_date})</option>
                                    ))}
                                </select>
                                {depreciationForm.formState.errors.period_id && (
                                    <p className="mt-1 text-sm text-red-600">{depreciationForm.formState.errors.period_id.message}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsDepreciationModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={runDepreciationMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {runDepreciationMutation.isPending ? "Processing..." : "Run Depreciation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
