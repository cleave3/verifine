import { useQuery } from '@tanstack/react-query';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, CreditCard, Activity, ArrowUpRight, Wallet, BarChart as BarChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/axios';
import { useAuthStore } from '../store/authStore';

interface ChartDataPoint {
    name: string;
    revenue: number;
    expenses: number;
    net_income: number;
}

interface RecentTransaction {
    id: number;
    date: string;
    description: string;
    amount: number;
    type: string;
}

interface AgingPoint {
    label: string;
    ar: number;
    ap: number;
}

interface DashboardRate {
    currency_code: string;
    rate: number;
}

interface DashboardStats {
    total_open_ar: number;
    total_open_ap: number;
    current_period_revenue: number;
    current_period_expenses: number;
    current_period_net_income: number;
    cash_position: number;
    period_status: string;
}

interface DashboardData {
    stats: DashboardStats;
    chart_data: ChartDataPoint[];
    recent_transactions: RecentTransaction[];
    aging_data: AgingPoint[];
    exchange_rates: DashboardRate[];
}

export default function Dashboard() {
    const { currentOrg } = useAuthStore();
    const primaryColor = currentOrg?.primary_color || '#4f46e5';

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: currentOrg?.base_currency_code || 'NGN',
            minimumFractionDigits: 0
        }).format(value);
    };

    const { data: dashboard, isLoading } = useQuery<DashboardData>({
        queryKey: ['dashboard-summary'],
        queryFn: async () => {
            const res = await api.get('/dashboard/summary');
            return res.data.data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-slate-400 animate-pulse">
                    <Activity className="h-12 w-12" />
                    <p className="font-medium tracking-widest text-sm uppercase">Loading Analytics Engine...</p>
                </div>
            </div>
        );
    }

    if (!dashboard) {
        return <div className="p-8 text-center text-slate-400">Unable to load dashboard data.</div>;
    }

    const stats = dashboard?.stats || {} as DashboardStats;
    const chart_data = dashboard?.chart_data || [];
    const recent_transactions = dashboard?.recent_transactions || [];
    const aging_data = dashboard?.aging_data || [];
    const exchange_rates = dashboard?.exchange_rates || [];
    const isProfitable = (stats?.current_period_net_income || 0) >= 0;

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-full space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financial Overview</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time pulse of your organizational health and liquidity.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-full border flex items-center gap-2 font-semibold text-sm shadow-sm
                        ${stats.period_status === 'OPEN'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                            : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                        }`}>
                        <div className={`h-2 w-2 rounded-full ${stats.period_status === 'OPEN' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                        Period: {stats.period_status}
                    </div>
                </div>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* Cash Position */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Wallet className="h-20 w-20 text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-indigo-500" />
                        Cash Position
                    </p>
                    <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(stats?.cash_position || 0)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">Total Liquid Assets (Local)</p>
                </div>

                {/* Net Income */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable ? <TrendingUp className="h-20 w-20" /> : <TrendingDown className="h-20 w-20" />}
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-500" />
                        Net Income
                    </p>
                    <p className={`mt-4 text-3xl font-bold tracking-tight font-mono ${isProfitable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(stats?.current_period_net_income || 0)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">Net Profit this period</p>
                </div>

                {/* Open AR */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                        Accounts Receivable
                    </p>
                    <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(stats?.total_open_ar || 0)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">Uncollected Revenue</p>
                </div>

                {/* Open AP */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-rose-500" />
                        Accounts Payable
                    </p>
                    <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white font-mono">
                        {formatCurrency(stats?.total_open_ap || 0)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">Upcoming Obligations</p>
                </div>

            </div>

            {/* Charts & Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* AR/AP Aging Chart */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aging Analysis</h3>
                            <p className="text-sm text-slate-500">Liquidity timeline: Overdue vs upcoming</p>
                        </div>
                        <BarChartIcon className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={aging_data} margin={{ left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                                <Bar name="Receivables (AR)" dataKey="ar" fill={primaryColor} radius={[6, 6, 0, 0]} />
                                <Bar name="Payables (AP)" dataKey="ap" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Currency Table & Rates */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 lg:p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Currency Pulse</h3>
                            <p className="text-sm text-slate-500">Live exchange rates (Relative to Local)</p>
                        </div>
                        <Activity className="h-6 w-6 text-fuchsia-500" />
                    </div>
                    <div className="flex-1 overflow-x-auto p-2">
                        <table className="min-w-full">
                            <thead>
                                <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="px-6 py-4">Currency</th>
                                    <th className="px-6 py-4">Exchange Rate</th>
                                    <th className="px-6 py-4 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {exchange_rates.map((rate) => (
                                    <tr key={rate.currency_code} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                                    {rate.currency_code.substring(0, 2)}
                                                </div>
                                                <span className="font-bold text-slate-900 dark:text-white">{rate.currency_code}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-200">
                                            1 {rate.currency_code} = {rate.rate.toFixed(2)} {currentOrg?.base_currency_code}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                                Active
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {exchange_rates.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                                            No foreign currencies configured.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Trailing Performance & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">

                {/* Performance Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 lg:p-8">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-8">Trailing Performance (6 Periods)</h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chart_data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                />
                                <Bar name="Revenue" dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar name="Expenses" dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity Feed */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Recent Ledger</h3>
                    <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {recent_transactions.map((tx) => (
                            <div key={tx.id} className="flex items-start gap-4">
                                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    <Activity className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{tx.description}</p>
                                    <p className="text-xs text-slate-500">{format(new Date(tx.date), 'MMM d, h:mm a')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold font-mono text-slate-900 dark:text-white">{formatCurrency(tx.amount)}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">JE #{tx.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
