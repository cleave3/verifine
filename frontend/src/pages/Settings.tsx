import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios";
import { useCurrencyStore } from "../store/currencyStore";
import { useAuthStore } from "../store/authStore";
import { ConfirmDialog } from "../components/ConfirmDialog";
import toast from "react-hot-toast";
import { RoleGuard } from "../components/RoleGuard";

export default function Settings() {
    const queryClient = useQueryClient();
    const { fetchSettingsAndRates } = useCurrencyStore();
    const { currentOrg, refreshOrg } = useAuthStore();
    const [isConfirmLockedOpen, setIsConfirmLockedOpen] = useState(false);
    const [isConfirmCurrencyOpen, setIsConfirmCurrencyOpen] = useState(false);
    const [isConfirmRatesOpen, setIsConfirmRatesOpen] = useState(false);

    const { data: settingsRes, isLoading } = useQuery({
        queryKey: ["settings"],
        queryFn: async () => (await api.get("/settings")).data
    });

    const settings = settingsRes?.data;
    const [selectedCurrency, setSelectedCurrency] = useState("NGN");

    const [orgProfile, setOrgProfile] = useState({
        name: "",
        slug: "",
        address: "",
        tax_id: "",
        logo_url: "",
        primary_color: "#4f46e5"
    });

    // Exchange rates local state
    const { activeRates } = useCurrencyStore();
    const [localRates, setLocalRates] = useState<Record<string, string>>({});

    useEffect(() => {
        if (settings) {
            setSelectedCurrency(settings.base_currency_code);
        }
    }, [settings]);

    useEffect(() => {
        if (currentOrg) {
            setOrgProfile({
                name: currentOrg.name || "",
                slug: currentOrg.slug || "",
                address: currentOrg.address || "",
                tax_id: currentOrg.tax_id || "",
                logo_url: currentOrg.logo_url || "",
                primary_color: currentOrg.primary_color || "#4f46e5"
            });
        }
    }, [currentOrg]);

    useEffect(() => {
        // Initialize local rates from store
        const formatted: Record<string, string> = {};
        Object.entries(activeRates).forEach(([k, v]) => {
            formatted[k] = v.toString();
        });
        setLocalRates(formatted);
    }, [activeRates]);

    const updateMutation = useMutation({
        mutationFn: async (currency: string) => await api.patch("/settings/", { base_currency_code: currency }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
            await fetchSettingsAndRates(); // Update global store
            toast.success("Settings updated successfully!");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to update settings");
        }
    });

    const updateOrgMutation = useMutation({
        mutationFn: async (data: any) => await api.patch("/organizations/me", data),
        onSuccess: async () => {
            await refreshOrg();
            toast.success("Organization details updated successfully!");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to update organization");
        }
    });

    const lockMutation = useMutation({
        mutationFn: async () => await api.post("/settings/lock"),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
            await fetchSettingsAndRates(); // Update global store
            setIsConfirmLockedOpen(false);
            toast.success("Base currency locked successfully!");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to lock currency");
        }
    });

    const ratesMutation = useMutation({
        mutationFn: async (rates: Record<string, number>) => await api.patch("/settings/exchange-rates", { rates }),
        onSuccess: async () => {
            await fetchSettingsAndRates(); // Will refetch rates from backend
            toast.success("Exchange rates updated successfully!");
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to update exchange rates");
        }
    });

    const handleRateChange = (currency: string, value: string) => {
        setLocalRates(prev => ({ ...prev, [currency]: value }));
    };

    const executeSaveRates = () => {
        const payload: Record<string, number> = {};
        Object.entries(localRates).forEach(([k, v]) => {
            const num = parseFloat(v);
            if (!isNaN(num)) payload[k] = num;
        });
        ratesMutation.mutate(payload);
    };

    if (isLoading) return <div className="p-6 text-slate-500">Loading settings...</div>;

    return (
        <div className="p-6 mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 mb-6">Company Settings</h1>

            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 border border-slate-200 dark:border-slate-700 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Organization Profile</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company Name</label>
                        <input
                            type="text"
                            value={orgProfile.name}
                            onChange={(e) => setOrgProfile(prev => ({ ...prev, name: e.target.value }))}
                            className="block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company Slug</label>
                        <input
                            type="text"
                            value={orgProfile.slug}
                            onChange={(e) => setOrgProfile(prev => ({ ...prev, slug: e.target.value }))}
                            className="block w-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-500 rounded-md p-2"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Physical Address</label>
                        <input
                            type="text"
                            value={orgProfile.address}
                            onChange={(e) => setOrgProfile(prev => ({ ...prev, address: e.target.value }))}
                            className="block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tax ID</label>
                        <input
                            type="text"
                            value={orgProfile.tax_id}
                            onChange={(e) => setOrgProfile(prev => ({ ...prev, tax_id: e.target.value }))}
                            className="block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logo URL</label>
                        <input
                            type="text"
                            placeholder="https://example.com/logo.png"
                            value={orgProfile.logo_url}
                            onChange={(e) => setOrgProfile(prev => ({ ...prev, logo_url: e.target.value }))}
                            className="block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Primary Branding Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                value={orgProfile.primary_color}
                                onChange={(e) => setOrgProfile(prev => ({ ...prev, primary_color: e.target.value }))}
                                className="h-10 w-20 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md p-1 cursor-pointer"
                            />
                            <input
                                type="text"
                                value={orgProfile.primary_color}
                                onChange={(e) => setOrgProfile(prev => ({ ...prev, primary_color: e.target.value }))}
                                className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 font-mono uppercase"
                            />
                        </div>
                    </div>
                </div>

                <RoleGuard allowedRoles={['admin']}>
                    <div className="flex justify-end">
                        <button
                            onClick={() => updateOrgMutation.mutate(orgProfile)}
                            disabled={updateOrgMutation.isPending}
                            className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition disabled:bg-slate-400"
                        >
                            {updateOrgMutation.isPending ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </RoleGuard>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 border border-slate-200 dark:border-slate-700 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Currency Configuration</h2>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Base Company Currency</label>
                    <div className="flex items-center gap-4">
                        <select
                            value={selectedCurrency}
                            onChange={(e) => setSelectedCurrency(e.target.value)}
                            disabled={settings?.is_base_currency_locked}
                            className="block w-64 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 disabled:opacity-50"
                        >
                            <option value="NGN">NGN - Nigerian Naira</option>
                            <option value="USD">USD - US Dollar</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="EUR">EUR - Euro</option>
                        </select>
                        <RoleGuard allowedRoles={['admin']}>
                            <button
                                onClick={() => setIsConfirmCurrencyOpen(true)}
                                disabled={settings?.is_base_currency_locked || selectedCurrency === settings?.base_currency_code || updateMutation.isPending}
                                className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition disabled:bg-slate-400"
                            >
                                Save Currency
                            </button>
                        </RoleGuard>
                    </div>
                    {settings?.is_base_currency_locked && (
                        <p className="text-sm text-rose-500 mt-2">The base currency is locked and cannot be changed.</p>
                    )}
                </div>

                {!settings?.is_base_currency_locked && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-semibold text-rose-600 dark:text-rose-400 mb-2">Danger Zone</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Locking the base currency prevents any future changes to it. This is typically done after initial setup to ensure accounting consistency.
                        </p>
                        <RoleGuard allowedRoles={['admin']}>
                            <button
                                onClick={() => setIsConfirmLockedOpen(true)}
                                className="bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200 px-4 py-2 rounded font-medium transition dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900"
                            >
                                Lock Base Currency
                            </button>
                        </RoleGuard>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 border border-slate-200 dark:border-slate-700 mt-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-200 mb-4">Exchange Rates</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                    Configure the exchange rates relative to your base currency ({settings?.base_currency_code || "NGN"}).
                    These rates map 1 unit of the foreign currency to the base currency.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {Object.entries(localRates).map(([currency, rate]) => (
                        <div key={currency} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded border border-slate-200 dark:border-slate-700">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {currency} to {settings?.base_currency_code || "NGN"}
                            </label>
                            <input
                                type="number"
                                step="0.0001"
                                value={rate}
                                onChange={(e) => handleRateChange(currency, e.target.value)}
                                disabled={currency === settings?.base_currency_code}
                                className="block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md p-2 disabled:bg-slate-100 disabled:dark:bg-slate-900"
                            />
                        </div>
                    ))}
                </div>

                <RoleGuard allowedRoles={['admin', 'controller', 'accountant']}>
                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsConfirmRatesOpen(true)}
                            disabled={ratesMutation.isPending}
                            className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition disabled:bg-slate-400"
                        >
                            {ratesMutation.isPending ? "Saving..." : "Save Exchange Rates"}
                        </button>
                    </div>
                </RoleGuard>
            </div>

            <ConfirmDialog
                isOpen={isConfirmLockedOpen}
                title="Lock Base Currency"
                message="Are you absolutely sure you want to lock the base currency? This action is IRREVERSIBLE. You will not be able to change the company currency later."
                confirmText="Yes, Lock Currency Permanently"
                type="primary"
                onConfirm={() => lockMutation.mutate()}
                onCancel={() => setIsConfirmLockedOpen(false)}
            />

            <ConfirmDialog
                isOpen={isConfirmCurrencyOpen}
                title="Change Base Currency"
                message={`Are you sure you want to change the base currency to ${selectedCurrency}? This affects how all new reports and dashboard metrics are calculated.`}
                confirmText="Yes, Save Currency"
                type="primary"
                onConfirm={() => {
                    updateMutation.mutate(selectedCurrency);
                    setIsConfirmCurrencyOpen(false);
                }}
                onCancel={() => setIsConfirmCurrencyOpen(false)}
            />

            <ConfirmDialog
                isOpen={isConfirmRatesOpen}
                title="Update Exchange Rates"
                message="Are you sure you want to update the exchange rates? This will affect how new transactions are converted into the base currency."
                confirmText="Yes, Save Exchange Rates"
                type="primary"
                onConfirm={() => {
                    executeSaveRates();
                    setIsConfirmRatesOpen(false);
                }}
                onCancel={() => setIsConfirmRatesOpen(false)}
            />
        </div>
    );
}
