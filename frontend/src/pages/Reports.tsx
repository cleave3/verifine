import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { exportToCsv } from "../lib/export";
import { fiscalPeriodService } from "../services/fiscalPeriodService";
import { trackingService } from "../services/trackingService";
import { reportingService } from "../services/reportingService";
import { Download } from "lucide-react";
import { useCurrencyStore } from "../store/currencyStore";

export default function Reports() {
    const { formatCurrency } = useCurrencyStore();

    const [selectedPeriod, setSelectedPeriod] = useState<number>(0);
    const [reportType, setReportType] = useState<"TB" | "PNL" | "BS" | "TAX">("TB");
    const [selectedTrackingOption, setSelectedTrackingOption] = useState<number>(0);

    const { data: perRes } = useQuery({ queryKey: ["periods"], queryFn: fiscalPeriodService.getPeriods });
    const periods = perRes?.data || [];

    const { data: trackingRes } = useQuery({ queryKey: ["tracking-categories"], queryFn: trackingService.getCategories });
    const trackingCategories = trackingRes?.data || trackingRes || [];

    const { data: reportData, isLoading } = useQuery({
        queryKey: ["report", reportType, selectedPeriod, selectedTrackingOption],
        queryFn: async () => {
            if (!selectedPeriod) return null;
            if (reportType === "TB") {
                const res = await reportingService.getTrialBalance(selectedPeriod);
                return res.data;
            } else if (reportType === "PNL") {
                const res = await reportingService.getProfitAndLoss(selectedPeriod, selectedTrackingOption > 0 ? selectedTrackingOption : undefined);
                return res.data;
            } else if (reportType === "TAX") {
                const res = await reportingService.getTaxLiability(selectedPeriod);
                return res.data;
            } else {
                const res = await reportingService.getBalanceSheet(selectedPeriod);
                return res.data;
            }
        },
        enabled: selectedPeriod > 0
    });

    const handleExport = () => {
        if (!reportData) return;
        const pName = periods.find((p: any) => p.id === selectedPeriod)?.name || "Report";

        let rows: any[][] = [];
        if (reportType === "TB") {
            rows.push(["Account Code", "Account Name", "Normal Balance", "Debit", "Credit"]);
            reportData.lines?.forEach((l: any) => rows.push([l.account_code, l.account_name, l.normal_balance, l.debit, l.credit]));
            rows.push(["", "TOTAL", "", reportData.total_debit, reportData.total_credit]);
        } else if (reportType === "PNL") {
            rows.push(["Category", "Account Code", "Account Name", "Amount"]);
            reportData.revenue_lines?.forEach((l: any) => rows.push(["Revenue", l.account_code, l.account_name, l.balance]));
            rows.push(["", "", "Total Revenue", reportData.total_revenue]);
            reportData.expense_lines?.forEach((l: any) => rows.push(["Expense", l.account_code, l.account_name, l.balance]));
            rows.push(["", "", "Total Expenses", reportData.total_expenses]);
            rows.push(["", "", "Net Income", reportData.net_income]);
        } else if (reportType === "BS") {
            rows.push(["Category", "Account Code", "Account Name", "Amount"]);
            reportData.assets_lines?.forEach((l: any) => rows.push(["Asset", l.account_code, l.account_name, l.balance]));
            rows.push(["", "", "Total Assets", reportData.total_assets]);
            reportData.liabilities_lines?.forEach((l: any) => rows.push(["Liability", l.account_code, l.account_name, l.balance]));
            rows.push(["", "", "Total Liabilities", reportData.total_liabilities]);
            reportData.equity_lines?.forEach((l: any) => rows.push(["Equity", l.account_code, l.account_name, l.balance]));
            rows.push(["", "", "Total Equity", reportData.total_equity]);
            rows.push(["", "", "Total Liabilities & Equity", reportData.total_liabilities_and_equity]);
        } else if (reportType === "TAX") {
            rows.push(["Tax Rate", "Rate %", "Output VAT (Collected)", "Input VAT (Paid)", "Net Liability"]);
            reportData.lines?.forEach((l: any) => rows.push([l.tax_rate_name, l.tax_rate_percentage, l.total_collected, l.total_paid, l.net_liability]));
            rows.push(["", "TOTAL", reportData.total_collected, reportData.total_paid, reportData.net_liability_total]);
        }
        exportToCsv(`${reportType}_${pName}.csv`, rows);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">Financial Reports</h1>

                <div className="flex gap-4 items-center">
                    <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value as "TB" | "PNL" | "BS" | "TAX")}
                        className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 shadow-sm"
                    >
                        <option value="TB">Trial Balance</option>
                        <option value="PNL">Profit & Loss</option>
                        <option value="BS">Balance Sheet</option>
                        <option value="TAX">Tax Liability</option>
                    </select>

                    <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                        className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 shadow-sm"
                    >
                        <option value={0}>Select Period...</option>
                        {periods.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    {reportType === "PNL" && (
                        <select
                            value={selectedTrackingOption}
                            onChange={(e) => setSelectedTrackingOption(Number(e.target.value))}
                            className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-md p-2 shadow-sm"
                        >
                            <option value={0}>All Tracking</option>
                            {trackingCategories.filter((c: any) => c.is_active).map((c: any) => (
                                <optgroup key={c.id} label={c.name}>
                                    {c.options.filter((o: any) => o.is_active).map((o: any) => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {!selectedPeriod ? (
                <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center text-slate-500">
                    Select a Fiscal Period to generate the report.
                </div>
            ) : isLoading ? (
                <div className="text-slate-500 animate-pulse text-center p-12">Compiling Ledger Data...</div>
            ) : reportData ? (
                <div className="bg-white dark:bg-slate-800 shadow rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 p-8">

                    {reportType === "TB" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-center flex-1 text-slate-900 dark:text-white underline">Trial Balance</h2>
                                <button onClick={handleExport} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition text-sm font-medium">
                                    <Download className="w-4 h-4" /> Export CSV
                                </button>
                            </div>
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead>
                                    <tr>
                                        <th className="text-left font-semibold text-slate-600 dark:text-slate-400 py-2">Account</th>
                                        <th className="text-right font-semibold text-slate-600 dark:text-slate-400 py-2 w-32">Debit</th>
                                        <th className="text-right font-semibold text-slate-600 dark:text-slate-400 py-2 w-32">Credit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {reportData.lines?.map((line: any, i: number) => (
                                        <tr key={i}>
                                            <td className="py-2 text-slate-800 dark:text-slate-200">{line.account_code} - {line.account_name}</td>
                                            <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-300">{line.debit > 0 ? line.debit.toFixed(2) : '-'}</td>
                                            <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-300">{line.credit > 0 ? line.credit.toFixed(2) : '-'}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-t-2 border-slate-300 dark:border-slate-600">
                                        <td className="py-3 text-slate-900 dark:text-white uppercase tracking-wider">Total</td>
                                        <td className="py-3 text-right font-mono text-slate-900 dark:text-white">{reportData.total_debit?.toFixed(2)}</td>
                                        <td className="py-3 text-right font-mono text-slate-900 dark:text-white">{reportData.total_credit?.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            {Math.abs(reportData.total_debit - reportData.total_credit) < 0.01 ? (
                                <p className="text-emerald-500 font-medium text-center mt-4">Balances are symmetrically cleared.</p>
                            ) : (
                                <p className="text-rose-500 font-medium text-center mt-4">Warning: Ledger is out of balance.</p>
                            )}
                        </div>
                    )}

                    {reportType === "PNL" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-center flex-1 text-slate-900 dark:text-white underline">Profit & Loss Statement</h2>
                                <button onClick={handleExport} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition text-sm font-medium">
                                    <Download className="w-4 h-4" /> Export CSV
                                </button>
                            </div>

                            <h3 className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 mt-4 rounded">Revenue</h3>
                            {reportData.revenue_lines?.length > 0 ? reportData.revenue_lines.map((r: any, i: number) => (
                                <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 px-4">
                                    <span className="text-slate-600 dark:text-slate-300">{r.account_name}</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-200">{r.balance.toFixed(2)}</span>
                                </div>
                            )) : <div className="px-4 py-2 text-slate-500 text-sm">No revenue recorded.</div>}
                            <div className="flex justify-between font-bold py-3 px-4 border-b-2 border-slate-200 dark:border-slate-700">
                                <span>Gross Revenue</span>
                                <span className="font-mono">{reportData.total_revenue?.toFixed(2)}</span>
                            </div>

                            <h3 className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 mt-6 rounded">Expenses</h3>
                            {reportData.expense_lines?.length > 0 ? reportData.expense_lines.map((e: any, i: number) => (
                                <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 px-4">
                                    <span className="text-slate-600 dark:text-slate-300">{e.account_name}</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-200">{e.balance.toFixed(2)}</span>
                                </div>
                            )) : <div className="px-4 py-2 text-slate-500 text-sm">No expenses recorded.</div>}
                            <div className="flex justify-between font-bold py-3 px-4 border-b-2 border-slate-200 dark:border-slate-700">
                                <span>Total Operating Expenses</span>
                                <span className="font-mono">{reportData.total_expenses?.toFixed(2)}</span>
                            </div>

                            <div className={`flex justify-between font-bold text-xl py-6 px-4 mt-6 rounded-lg ${reportData.net_income >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                                <span>Net Income</span>
                                <span className="font-mono">{formatCurrency(reportData.net_income || 0)}</span>
                            </div>
                        </div>
                    )}

                    {reportType === "BS" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-center flex-1 text-slate-900 dark:text-white underline">Balance Sheet</h2>
                                <button onClick={handleExport} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition text-sm font-medium">
                                    <Download className="w-4 h-4" /> Export CSV
                                </button>
                            </div>

                            <h3 className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 mt-4 rounded">Assets</h3>
                            {reportData.assets_lines?.length > 0 ? reportData.assets_lines.map((a: any, i: number) => (
                                <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 px-4">
                                    <span className="text-slate-600 dark:text-slate-300">{a.account_name}</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-200">{a.balance.toFixed(2)}</span>
                                </div>
                            )) : <div className="px-4 py-2 text-slate-500 text-sm">No assets recorded.</div>}
                            <div className="flex justify-between font-bold py-3 px-4 border-b-2 border-slate-200 dark:border-slate-700">
                                <span>Total Assets</span>
                                <span className="font-mono">{reportData.total_assets?.toFixed(2)}</span>
                            </div>

                            <h3 className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 mt-6 rounded">Liabilities</h3>
                            {reportData.liabilities_lines?.length > 0 ? reportData.liabilities_lines.map((l: any, i: number) => (
                                <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 px-4">
                                    <span className="text-slate-600 dark:text-slate-300">{l.account_name}</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-200">{l.balance.toFixed(2)}</span>
                                </div>
                            )) : <div className="px-4 py-2 text-slate-500 text-sm">No liabilities recorded.</div>}
                            <div className="flex justify-between font-bold py-3 px-4 border-b-2 border-slate-200 dark:border-slate-700">
                                <span>Total Liabilities</span>
                                <span className="font-mono">{reportData.total_liabilities?.toFixed(2)}</span>
                            </div>

                            <h3 className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 p-2 mt-6 rounded">Equity</h3>
                            {reportData.equity_lines?.length > 0 ? reportData.equity_lines.map((e: any, i: number) => (
                                <div key={i} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 px-4">
                                    <span className="text-slate-600 dark:text-slate-300">{e.account_name}</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-200">{e.balance.toFixed(2)}</span>
                                </div>
                            )) : <div className="px-4 py-2 text-slate-500 text-sm">No equity recorded.</div>}
                            <div className="flex justify-between font-bold py-3 px-4 border-b-2 border-slate-200 dark:border-slate-700">
                                <span>Total Equity</span>
                                <span className="font-mono">{reportData.total_equity?.toFixed(2)}</span>
                            </div>

                            <div className={`flex justify-between font-bold text-xl py-6 px-4 mt-6 rounded-lg ${reportData.is_balanced ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'}`}>
                                <span>Total Liabilities & Equity</span>
                                <span className="font-mono">{formatCurrency(reportData.total_liabilities_and_equity || 0)}</span>
                            </div>
                        </div>
                    )}

                    {reportType === "TAX" && (
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-center flex-1 text-slate-900 dark:text-white underline">Tax Liability Report</h2>
                                <button onClick={handleExport} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition text-sm font-medium">
                                    <Download className="w-4 h-4" /> Export CSV
                                </button>
                            </div>
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead>
                                    <tr>
                                        <th className="text-left font-semibold text-slate-600 dark:text-slate-400 py-2">Tax Rate</th>
                                        <th className="text-right font-semibold text-slate-600 dark:text-slate-400 py-2">Rate %</th>
                                        <th className="text-right font-semibold text-slate-600 dark:text-slate-400 py-2">Output (Collected)</th>
                                        <th className="text-right font-semibold text-slate-600 dark:text-slate-400 py-2">Input (Paid)</th>
                                        <th className="text-right font-semibold text-slate-600 dark:text-slate-400 py-2">Net Liability</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {reportData.lines?.map((line: any, i: number) => (
                                        <tr key={i}>
                                            <td className="py-2 text-slate-800 dark:text-slate-200">{line.tax_rate_name}</td>
                                            <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-300">{(line.tax_rate_percentage * 100).toFixed(2)}%</td>
                                            <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-300">{line.total_collected?.toFixed(2)}</td>
                                            <td className="py-2 text-right font-mono text-slate-600 dark:text-slate-300">{line.total_paid?.toFixed(2)}</td>
                                            <td className="py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{line.net_liability?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr className="font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                                        <td className="py-3 uppercase tracking-wider" colSpan={2}>Total</td>
                                        <td className="py-3 text-right font-mono">{reportData.total_collected?.toFixed(2)}</td>
                                        <td className="py-3 text-right font-mono">{reportData.total_paid?.toFixed(2)}</td>
                                        <td className="py-3 text-right font-mono text-lg">{reportData.net_liability_total?.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                            {reportData.lines?.length === 0 && <p className="text-center text-slate-500 py-6">No tax data found.</p>}
                            {reportData.net_liability_total > 0 ? (
                                <p className="text-rose-500 font-medium text-center mt-4">You owe {formatCurrency(reportData.net_liability_total)} to the tax authority.</p>
                            ) : reportData.net_liability_total < 0 ? (
                                <p className="text-emerald-500 font-medium text-center mt-4">You are owed a refund of {formatCurrency(Math.abs(reportData.net_liability_total))}.</p>
                            ) : (
                                <p className="text-slate-500 font-medium text-center mt-4">No net tax liability for this period.</p>
                            )}
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
