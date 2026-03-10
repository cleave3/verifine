import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { expenseService } from "../services/expenseService";
import { payrollService } from "../services/payrollService";
import { accountService } from "../services/accountService";
import { fiscalPeriodService } from "../services/fiscalPeriodService";
import { RoleGuard } from "../components/RoleGuard";
import { ReceiptText, Plus, CheckCircle, XCircle } from "lucide-react";
import { useCurrencyStore } from "../store/currencyStore";
import { ConfirmDialog } from "../components/ConfirmDialog";

const claimSchema = z.object({
    employee_id: z.coerce.number().min(1, "Employee is required"),
    date_incurred: z.string().min(1, "Date is required"),
    description: z.string().min(3, "Description is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    expense_account_id: z.coerce.number().min(1, "Expense account is required"),
});

const approveSchema = z.object({
    credit_account_id: z.coerce.number().min(1, "Credit account is required"),
    period_id: z.coerce.number().min(1, "Fiscal period is required"),
});

export default function ExpenseClaims() {
    const queryClient = useQueryClient();
    const { formatCurrency, baseCurrency } = useCurrencyStore();
    const [confirmReject, setConfirmReject] = useState({ claimId: 0, isOpen: false });
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [processingClaimId, setProcessingClaimId] = useState<number | null>(null);

    const { data: claimsRes, isLoading: isLoadingClaims } = useQuery({
        queryKey: ["expense-claims"],
        queryFn: () => expenseService.getClaims(),
    });
    const claims = claimsRes?.data || [];

    const { data: employeesRes } = useQuery({
        queryKey: ["employees"],
        queryFn: payrollService.getEmployees,
    });
    const employees = employeesRes?.data || [];

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

    const claimForm = useForm({
        resolver: zodResolver(claimSchema),
        defaultValues: {
            employee_id: "",
            date_incurred: new Date().toISOString().split("T")[0],
            description: "",
            amount: 0,
            expense_account_id: "",
        },
    });

    const approveForm = useForm({
        resolver: zodResolver(approveSchema),
        defaultValues: { credit_account_id: "", period_id: "" },
    });

    const createMutation = useMutation({
        mutationFn: expenseService.createClaim,
        onSuccess: () => {
            toast.success("Expense claim submitted successfully");
            queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
            setIsClaimModalOpen(false);
            claimForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to submit expense claim");
        },
    });

    const approveMutation = useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: any }) => expenseService.approveClaim(id, payload),
        onSuccess: () => {
            toast.success("Expense claim approved successfully");
            queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
            setIsApproveModalOpen(false);
            setProcessingClaimId(null);
            approveForm.reset();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to approve expense claim");
        },
    });

    const rejectMutation = useMutation({
        mutationFn: expenseService.rejectClaim,
        onSuccess: () => {
            toast.success("Expense claim rejected");
            queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || "Failed to reject expense claim");
        },
    });

    const onSubmitClaim = (data: any) => createMutation.mutate(data);

    const onSubmitApprove = (data: any) => {
        if (processingClaimId) {
            approveMutation.mutate({ id: processingClaimId, payload: data });
        }
    };

    const handleReject = (claimId: number) => {
        setProcessingClaimId(claimId);
        rejectMutation.mutate(claimId);
    };

    const openApproveModal = (claim: any) => {
        setProcessingClaimId(claim.id);
        setIsApproveModalOpen(true);
    };

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center justify-between mb-8">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <ReceiptText className="w-6 h-6 mr-2 text-indigo-500" />
                        Expense Claims
                    </h1>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-400">
                        Manage and approve employee reimbursement requests.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <RoleGuard allowedRoles={["admin", "controller", "employee", "clerk"]}>
                        <button
                            onClick={() => setIsClaimModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Submit Claim
                        </button>
                    </RoleGuard>
                </div>
            </div>

            {isLoadingClaims ? (
                <div className="text-slate-500 animate-pulse">Loading expense claims...</div>
            ) : claims.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-lg mb-8 p-8 flex items-center justify-center flex-col min-h-[400px]">
                    <ReceiptText className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No expense claims</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 text-center max-w-sm">
                        When employees submit expenses for reimbursement, they will appear here for approval.
                    </p>
                    <RoleGuard allowedRoles={["admin", "controller", "employee", "clerk"]}>
                        <button
                            onClick={() => setIsClaimModalOpen(true)}
                            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                            New Claim
                        </button>
                    </RoleGuard>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Ref</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {claims.map((claim: any) => {
                                const employee = employees.find((e: any) => e.id === claim.employee_id);
                                return (
                                    <tr key={claim.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            <div>{claim.date_incurred}</div>
                                            <div className="text-xs text-slate-500">#{claim.id}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            {employee ? `${employee.first_name} ${employee.last_name}` : `Emp #${claim.employee_id}`}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={claim.description}>
                                            {claim.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                                            {formatCurrency(claim.amount, baseCurrency)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${claim.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                claim.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                    claim.status === 'PAID' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>
                                                {claim.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {claim.status === 'SUBMITTED' && (
                                                <RoleGuard allowedRoles={["admin", "controller"]}>
                                                    <div className="flex justify-end space-x-3">
                                                        <button
                                                            onClick={() =>
                                                                setConfirmReject({ claimId: claim.id, isOpen: true })
                                                            }
                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 inline-flex items-center"
                                                            title="Reject Claim"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openApproveModal(claim)}
                                                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 inline-flex items-center"
                                                            title="Approve Claim"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
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

            {/* Submit Claim Modal */}
            {isClaimModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Submit Expense Claim</h2>
                        <form onSubmit={claimForm.handleSubmit(onSubmitClaim)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Employee <span className="text-red-500">*</span></label>
                                <select
                                    {...claimForm.register("employee_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select an employee...</option>
                                    {employees.map((e: any) => (
                                        <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                                    ))}
                                </select>
                                {claimForm.formState.errors.employee_id && (
                                    <p className="mt-1 text-sm text-red-600">{claimForm.formState.errors.employee_id.message}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date Incurred <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        {...claimForm.register("date_incurred")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {claimForm.formState.errors.date_incurred && (
                                        <p className="mt-1 text-sm text-red-600">{claimForm.formState.errors.date_incurred.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...claimForm.register("amount")}
                                        className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    />
                                    {claimForm.formState.errors.amount && (
                                        <p className="mt-1 text-sm text-red-600">{claimForm.formState.errors.amount.message}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description <span className="text-red-500">*</span></label>
                                <textarea
                                    {...claimForm.register("description")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    rows={3}
                                />
                                {claimForm.formState.errors.description && (
                                    <p className="mt-1 text-sm text-red-600">{claimForm.formState.errors.description.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Expense Account <span className="text-red-500">*</span></label>
                                <select
                                    {...claimForm.register("expense_account_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select Expense Account</option>
                                    {accounts.filter((a: any) => a.type === 'EXPENSE').map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                                {claimForm.formState.errors.expense_account_id && (
                                    <p className="mt-1 text-sm text-red-600">{claimForm.formState.errors.expense_account_id.message}</p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsClaimModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {createMutation.isPending ? "Submitting..." : "Submit Claim"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Approve Claim Modal */}
            {isApproveModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Approve Expense Claim</h2>
                        <form onSubmit={approveForm.handleSubmit(onSubmitApprove)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Liability/Payable Account <span className="text-red-500">*</span></label>
                                <select
                                    {...approveForm.register("credit_account_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select Liability/Asset Account</option>
                                    {accounts.filter((a: any) => a.type === 'LIABILITY' || a.type === 'ASSET' || a.type === 'BANK').map((a: any) => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                    ))}
                                </select>
                                {approveForm.formState.errors.credit_account_id && (
                                    <p className="mt-1 text-sm text-red-600">{approveForm.formState.errors.credit_account_id.message}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fiscal Period <span className="text-red-500">*</span></label>
                                <select
                                    {...approveForm.register("period_id")}
                                    className="mt-1 block w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                >
                                    <option value="">Select a period...</option>
                                    {periods.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.start_date} to {p.end_date})</option>
                                    ))}
                                </select>
                                {approveForm.formState.errors.period_id && (
                                    <p className="mt-1 text-sm text-red-600">{approveForm.formState.errors.period_id.message}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsApproveModalOpen(false)} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition">Cancel</button>
                                <button type="submit" disabled={approveMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition">
                                    {approveMutation.isPending ? "Approving..." : "Approve Claim"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {confirmReject.isOpen && (
                <ConfirmDialog
                    isOpen={confirmReject.isOpen}
                    title="Confirm Reject"
                    message="Are you sure you want to reject this claim?"
                    onConfirm={() => handleReject(confirmReject.claimId)}
                    onCancel={() => setConfirmReject({ claimId: 0, isOpen: false })}
                />
            )}
        </div>
    );
}
