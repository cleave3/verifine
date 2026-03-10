import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { accountService } from "../services/accountService";
import { bankReconciliationService } from "../services/bankReconciliationService";
import { Check, Upload } from "lucide-react";

export default function BankReconciliation() {
    const queryClient = useQueryClient();
    const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null);
    const [expandedLineId, setExpandedLineId] = useState<number | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form states for upload
    const [uploadAccountId, setUploadAccountId] = useState(0);
    const [uploadDate, setUploadDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [uploadStart, setUploadStart] = useState("0");
    const [uploadEnd, setUploadEnd] = useState("0");

    const { data: statementsRes, isLoading: isLoadingStatements } = useQuery({
        queryKey: ["bank-statements"],
        queryFn: bankReconciliationService.getStatements,
    });

    const { data: statementDetail } = useQuery({
        queryKey: ["bank-statements", selectedStatementId],
        queryFn: () => bankReconciliationService.getStatementDetail(selectedStatementId!),
        enabled: !!selectedStatementId
    });

    const { data: accountsRes } = useQuery({
        queryKey: ["accounts"],
        queryFn: accountService.getAccounts,
    });

    const { data: suggestions, isLoading: isLoadingSuggestions } = useQuery({
        queryKey: ["bank-matches", selectedStatementId],
        queryFn: () => bankReconciliationService.getSuggestions(selectedStatementId!),
        enabled: !!selectedStatementId
    });

    const uploadMutation = useMutation({
        mutationFn: bankReconciliationService.uploadStatement,
        onSuccess: () => {
            toast.success("Statement uploaded successfully");
            queryClient.invalidateQueries({ queryKey: ["bank-statements"] });
            setIsUploadOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to upload statement");
        }
    });

    const matchMutation = useMutation({
        mutationFn: ({ bank_line_id, ledger_line_id }: { bank_line_id: number, ledger_line_id: number }) =>
            bankReconciliationService.matchTransaction(selectedStatementId!, { bank_line_id, ledger_line_id }),
        onSuccess: () => {
            toast.success("Transaction matched successfully");
            queryClient.invalidateQueries({ queryKey: ["bank-statements", selectedStatementId] });
            queryClient.invalidateQueries({ queryKey: ["bank-matches", selectedStatementId] });
            setExpandedLineId(null);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || "Failed to match transaction");
        }
    });

    const statements = statementsRes || [];
    const accounts = accountsRes?.data?.filter((a: any) => a.type === 'ASSET') || [];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            // Basic CSV parser
            const rows = text.split('\n').map(r => r.split(','));
            const lines = [];

            // Assume format: Date, Description, Amount, Reference
            for (let i = 1; i < rows.length; i++) {
                const parts = rows[i];
                if (parts.length >= 3) {
                    const date_str = parts[0].trim();
                    const desc = parts[1].trim();
                    const amount = parseFloat(parts[2].replace(/['"]/g, '').trim());
                    if (!isNaN(amount) && date_str) {
                        // format date (assume YYYY-MM-DD for now or let Date parse it)
                        const dt = new Date(date_str);
                        if (!isNaN(dt.getTime())) {
                            lines.push({
                                date: format(dt, "yyyy-MM-dd"),
                                description: desc,
                                amount: amount,
                                reference: parts[3] ? parts[3].trim() : ""
                            });
                        }
                    }
                }
            }

            if (lines.length > 0) {
                uploadMutation.mutate({
                    account_id: uploadAccountId,
                    statement_date: uploadDate,
                    start_balance: parseFloat(uploadStart),
                    end_balance: parseFloat(uploadEnd),
                    lines
                });
            } else {
                toast.error("Could not parse lines from CSV");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bank Reconciliation</h1>
                <button onClick={() => setIsUploadOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition">
                    <Upload className="w-4 h-4" /> Import Statement
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* Statement List Sidebar */}
                <div className="md:col-span-1 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 overflow-y-auto flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Statements</h2>
                    </div>
                    {isLoadingStatements ? (
                        <div className="p-4 text-slate-500 animate-pulse text-sm">Loading statements...</div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-2">
                            {statements.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 text-sm">No statements found.</div>
                            ) : (
                                statements.map((st: any) => (
                                    <button
                                        key={st.id}
                                        onClick={() => { setSelectedStatementId(st.id); setExpandedLineId(null); }}
                                        className={`w-full text-left p-3 rounded-md mb-2 transition-colors border ${selectedStatementId === st.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                                            {accounts.find((a: any) => a.id === st.account_id)?.name || "Account"}
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <span>{format(new Date(st.statement_date), "MMM d, yyyy")}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${st.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{st.status}</span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Main Matching Area */}
                <div className="md:col-span-3 bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 flex flex-col min-h-0">
                    {!statementDetail ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-6 text-center">
                            Select a statement from the left to begin reconciliation, or import a new statement.
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0 flex justify-between items-center">
                                <div>
                                    <h2 className="font-bold text-lg text-slate-900 dark:text-white">
                                        Reconciling: {accounts.find((a: any) => a.id === statementDetail.account_id)?.name}
                                    </h2>
                                    <p className="text-sm text-slate-500">Statement Ending {format(new Date(statementDetail?.statement_date), "MMM d, yyyy")} • Balance: {statementDetail.end_balance}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {statementDetail?.lines?.filter((l: any) => l.is_reconciled).length} of {statementDetail?.lines?.length} Reconciled
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {statementDetail?.lines?.map((bline: any) => (
                                    <div key={bline.id} className="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">

                                        {/* Bank Line Header Row */}
                                        <div
                                            className={`flex flex-col sm:flex-row p-4 items-start sm:items-center justify-between cursor-pointer transition-colors ${bline.is_reconciled ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"}`}
                                            onClick={() => !bline.is_reconciled && setExpandedLineId(expandedLineId === bline.id ? null : bline.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {bline.is_reconciled ? (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                                        <Check className="w-4 h-4" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                                                        <span className="w-2 h-2 rounded-full bg-transparent"></span>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{bline.description}</div>
                                                    <div className="text-xs text-slate-500">{format(new Date(bline.date), "MMM d, yyyy")} {bline.reference && `• Ref: ${bline.reference}`}</div>
                                                </div>
                                            </div>
                                            <div className="mt-2 sm:mt-0 font-bold text-slate-900 dark:text-white sm:text-right">
                                                <div className={Number(bline.amount) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}>
                                                    {Number(bline.amount) > 0 ? "+" : ""}{Number(bline.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Matching Panel (Expanded) */}
                                        {expandedLineId === bline.id && !bline.is_reconciled && (
                                            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Suggested Matches in Ledger</h4>
                                                {isLoadingSuggestions ? (
                                                    <div className="text-sm text-slate-500">Finding matches...</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {suggestions?.filter((s: any) => s.bank_line_id === bline.id).length === 0 ? (
                                                            <div className="text-sm text-slate-500 italic">No exact matches found. Manual match required.</div>
                                                        ) : (
                                                            suggestions?.filter((s: any) => s.bank_line_id === bline.id).map((s: any) => (
                                                                <div key={s.ledger_line_id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded border border-indigo-100 dark:border-indigo-900 shadow-sm">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">Ledger Entry Matching Amount</div>
                                                                        <div className="text-xs text-slate-500">Confidence: <span className={s.confidence === 'HIGH' ? 'text-emerald-600' : 'text-orange-500'}>{s.confidence}</span></div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => matchMutation.mutate({ bank_line_id: bline.id, ledger_line_id: s.ledger_line_id })}
                                                                        className="text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1.5 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 transition"
                                                                        disabled={matchMutation.isPending}
                                                                    >
                                                                        OK
                                                                    </button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            {isUploadOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Import Bank Statement</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bank Account</label>
                                <select
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    value={uploadAccountId}
                                    onChange={(e) => setUploadAccountId(Number(e.target.value))}
                                >
                                    <option value={0}>Select account...</option>
                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statement Date</label>
                                <input
                                    type="date"
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                    value={uploadDate}
                                    onChange={(e) => setUploadDate(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Balance</label>
                                    <input
                                        type="number" step="0.01"
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                        value={uploadStart}
                                        onChange={(e) => setUploadStart(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Balance</label>
                                    <input
                                        type="number" step="0.01"
                                        className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                        value={uploadEnd}
                                        onChange={(e) => setUploadEnd(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CSV File</label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    ref={fileInputRef}
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsUploadOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">Cancel</button>
                            <button
                                onClick={() => {
                                    if (!uploadAccountId) return toast.error("Please select a bank account");
                                    if (fileInputRef.current) handleFileUpload({ target: fileInputRef.current } as any);
                                }}
                                disabled={uploadMutation.isPending}
                                className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {uploadMutation.isPending ? "Importing..." : "Import"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
