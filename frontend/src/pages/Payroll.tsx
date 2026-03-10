import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { payrollService } from "../services/payrollService";
import { fiscalPeriodService } from "../services/fiscalPeriodService";
import { accountService } from "../services/accountService";
import { RoleGuard } from "../components/RoleGuard";
import { Banknote, Plus, CalendarCheck, CheckCircle, FileText, Settings, Download } from "lucide-react";
import { useCurrencyStore } from "../store/currencyStore";

const runSchema = z.object({
    period_id: z.coerce.number().min(1, "Fiscal period is required"),
    pay_date: z.string().min(1, "Pay date is required"),
});

const confirmSchema = z.object({
    wages_expense_account_id: z.coerce.number().min(1, "Wages account is required"),
    payroll_liabilities_account_id: z.coerce.number().min(1, "Liabilities account is required"),
    cash_account_id: z.coerce.number().min(1, "Cash account is required"),
});

const settingsSchema = z.object({
    tax_percentage: z.coerce.number().min(0, "Cannot be less than 0").max(100, "Cannot be more than 100"),
    benefits_percentage: z.coerce.number().min(0, "Cannot be less than 0").max(100, "Cannot be more than 100"),
});

export default function Payroll() {
    const queryClient = useQueryClient();
    const { formatCurrency } = useCurrencyStore();
    const [isRunModalOpen, setIsRunModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [confirmingRunId, setConfirmingRunId] = useState<number | null>(null);
    const [viewingRunId, setViewingRunId] = useState<number | null>(null);

    const { data: runsRes, isLoading: isLoadingRuns } = useQuery({
        queryKey: ["payroll-runs"],
        queryFn: payrollService.getPayrollRuns,
    });
    const runs = runsRes?.data || [];

    const { data: periodsRes } = useQuery({
        queryKey: ["fiscal-periods"],
        queryFn: fiscalPeriodService.getPeriods,
    });
    const periods = periodsRes?.data || [];

    const { data: accountsRes } = useQuery({
        queryKey: ["accounts"],
        queryFn: accountService.getAccounts,
    });
    const accounts = accountsRes?.data || [];

    const { data: payslipsRes, isLoading: isLoadingPayslips } = useQuery({
        queryKey: ["payslips", viewingRunId],
        queryFn: () => payrollService.getPayslips(viewingRunId!),
        enabled: !!viewingRunId,
    });
    const payslips = payslipsRes?.data || [];

    const { data: settingsRes, isLoading: isLoadingSettings } = useQuery({
        queryKey: ["payroll-settings"],
        queryFn: payrollService.getSettings,
    });

    const runForm = useForm({
        resolver: zodResolver(runSchema),
        defaultValues: { period_id: "", pay_date: new Date().toISOString().split('T')[0] },
    });

    const settingsForm = useForm({
        resolver: zodResolver(settingsSchema),
        defaultValues: { tax_percentage: 15, benefits_percentage: 5 },
    });

    useEffect(() => {
        if (settingsRes?.data) {
            settingsForm.reset(settingsRes.data);
        }
    }, [settingsRes?.data, settingsForm]);

    const confirmForm = useForm({
        resolver: zodResolver(confirmSchema),
        defaultValues: { wages_expense_account_id: "", payroll_liabilities_account_id: "", cash_account_id: "" },
    });

    const createRunMutation = useMutation({
        mutationFn: payrollService.initiatePayrollRun,
        onSuccess: () => {
            toast.success("Payroll run initiated successfully");
            queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
            setIsRunModalOpen(false);
            runForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to initiate payroll run");
        },
    });

    const confirmRunMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: any }) => payrollService.confirmPayrollRun(id, payload),
        onSuccess: () => {
            toast.success("Payroll run confirmed successfully");
            queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
            setIsConfirmModalOpen(false);
            setConfirmingRunId(null);
            confirmForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to confirm payroll run");
        },
    });

    const updateSettingsMutation = useMutation({
        mutationFn: payrollService.updateSettings,
        onSuccess: () => {
            toast.success("Payroll settings updated successfully");
            queryClient.invalidateQueries({ queryKey: ["payroll-settings"] });
            setIsSettingsModalOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to update payroll settings");
        },
    });

    const onRunSubmit = (data: any) => createRunMutation.mutate(data);

    const downloadPayslipMutation = useMutation({
        mutationFn: (id: number) => payrollService.downloadPayslip(id),
        onSuccess: (data, id) => {
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payslip_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Payslip downloaded successfully");
        },
        onError: () => {
            toast.error("Failed to download payslip");
        },
    });

    const onConfirmSubmit = (data: any) => {
        if (confirmingRunId) {
            confirmRunMutation.mutate({ id: confirmingRunId, payload: data });
        }
    };

    const onSettingsSubmit = (data: any) => updateSettingsMutation.mutate(data);

    const openConfirmModal = (run: any) => {
        setConfirmingRunId(run.id);
        setIsConfirmModalOpen(true);
    };

    const openPayslipModal = (run: any) => {
        setViewingRunId(run.id);
        setIsPayslipModalOpen(true);
    };

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center justify-between mb-8">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <Banknote className="w-6 h-6 mr-2 text-indigo-500" />
                        Payroll Runs
                    </h1>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
                        Process and track employee compensation periods.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center space-x-3">
                    <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto transition-colors"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </button>
                        <button
                            onClick={() => setIsRunModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Run Payroll
                        </button>
                    </RoleGuard>
                </div>
            </div>

            {isLoadingRuns ? (
                <div className="text-slate-500 animate-pulse">Loading payroll runs...</div>
            ) : runs.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-lg mb-8 p-8 flex items-center justify-center flex-col min-h-[400px]">
                    <CalendarCheck className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No payroll runs yet</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
                        Initiate a payroll run to generate payslips and record salary expenses.
                    </p>
                    <RoleGuard allowedRoles={["admin", "controller", "clerk"]}>
                        <button
                            onClick={() => setIsRunModalOpen(true)}
                            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            New Run
                        </button>
                    </RoleGuard>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Period / Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gross Pay</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Net Pay</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {runs.map((run: any) => {
                                const period = periods.find((p: any) => p.id === run.period_id);
                                return (
                                    <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            <div>{period?.name || `Period ${run.period_id}`}</div>
                                            <div className="text-xs text-slate-500">{run.pay_date}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            {formatCurrency(run.total_gross_pay)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            {formatCurrency(run.total_net_pay)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${run.status === 'CONFIRMED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                run.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                {run.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => openPayslipModal(run)}
                                                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300 mr-4 inline-flex items-center"
                                                title="View Payslips"
                                            >
                                                <FileText className="w-4 h-4 mr-1" /> Slips
                                            </button>
                                            {run.status === 'DRAFT' && (
                                                <RoleGuard allowedRoles={["admin", "controller"]}>
                                                    <button
                                                        onClick={() => openConfirmModal(run)}
                                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center"
                                                        title="Confirm Run"
                                                    >
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                                                    </button>
                                                </RoleGuard>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Initiate Run Modal */}
            {isRunModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Initiate Payroll Run</h2>
                        <form onSubmit={runForm.handleSubmit(onRunSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fiscal Period <span className="text-red-500">*</span></label>
                                <select
                                    {...runForm.register("period_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select a period...</option>
                                    {periods.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.start_date} to {p.end_date})</option>
                                    ))}
                                </select>
                                {runForm.formState.errors.period_id && (
                                    <p className="mt-1 text-sm text-red-600">{runForm.formState.errors.period_id.message}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pay Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    {...runForm.register("pay_date")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                />
                                {runForm.formState.errors.pay_date && (
                                    <p className="mt-1 text-sm text-red-600">{runForm.formState.errors.pay_date.message}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsRunModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createRunMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {createRunMutation.isPending ? "Starting..." : "Run Payroll"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Run Modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Confirm Payroll Run</h2>
                        <form onSubmit={confirmForm.handleSubmit(onConfirmSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Wages Expense Account <span className="text-red-500">*</span></label>
                                <select
                                    {...confirmForm.register("wages_expense_account_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select Expense Account</option>
                                    {accounts.filter((a: any) => a.type === 'EXPENSE').map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Payroll Liabilities Account <span className="text-red-500">*</span></label>
                                <select
                                    {...confirmForm.register("payroll_liabilities_account_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select Liability Account</option>
                                    {accounts.filter((a: any) => a.type === 'LIABILITY').map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cash/Bank Account <span className="text-red-500">*</span></label>
                                <select
                                    {...confirmForm.register("cash_account_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select Asset Account</option>
                                    {accounts.filter((a: any) => a.type === 'ASSET' || a.type === 'BANK').map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={confirmRunMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {confirmRunMutation.isPending ? "Confirming..." : "Confirm Payroll"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payslips Modal */}
            {isPayslipModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Payslips</h2>
                            <button onClick={() => setIsPayslipModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                                Close
                            </button>
                        </div>

                        {isLoadingPayslips ? (
                            <div className="text-slate-500 animate-pulse py-8 text-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">Loading payslips...</div>
                        ) : payslips.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg">No payslips available for this run.</div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 shadow rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-900">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee ID</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gross Pay</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Taxes</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net Pay</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {payslips.map((slip: any) => (
                                            <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">Emp #{slip.employee_id}</td>
                                                <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-300">
                                                    {formatCurrency(slip.gross_pay)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right text-red-500 dark:text-red-400">
                                                    -{formatCurrency(slip.tax_deduction)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right font-medium text-slate-900 dark:text-white">
                                                    {formatCurrency(slip.net_pay)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-right">
                                                    <button
                                                        onClick={() => downloadPayslipMutation.mutate(slip.id)}
                                                        disabled={downloadPayslipMutation.isPending}
                                                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                                                        title="Download PDF"
                                                    >
                                                        <Download className="w-4 h-4 ml-auto" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white flex items-center">
                            <Settings className="w-6 h-6 mr-2 text-indigo-500" />
                            Payroll Settings
                        </h2>
                        {isLoadingSettings ? (
                            <div className="py-4 text-center text-slate-500 animate-pulse">Loading settings...</div>
                        ) : (
                            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tax Deduction (%) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...settingsForm.register("tax_percentage")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {settingsForm.formState.errors.tax_percentage && (
                                        <p className="mt-1 text-sm text-red-600">{settingsForm.formState.errors.tax_percentage.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Benefits Deduction (%) <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...settingsForm.register("benefits_percentage")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {settingsForm.formState.errors.benefits_percentage && (
                                        <p className="mt-1 text-sm text-red-600">{settingsForm.formState.errors.benefits_percentage.message}</p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                    <button type="submit" disabled={updateSettingsMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                        {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
