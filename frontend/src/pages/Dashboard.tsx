import { useQuery } from '@tanstack/react-query';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Activity, ArrowUpRight, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import api from '../lib/axios';

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

interface DashboardStats {
    total_open_ar: number;
    total_open_ap: number;
    current_period_revenue: number;
    current_period_expenses: number;
    current_period_net_income: number;
}

interface DashboardData {
    stats: DashboardStats;
    chart_data: ChartDataPoint[];
    recent_transactions: RecentTransaction[];
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export default function Dashboard() {
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
    const isProfitable = (stats?.current_period_net_income || 0) >= 0;

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financial Overview</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Real-time pulse of your organizational health and liquidity.</p>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

                {/* Net Income */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xl relative overflow-hidden group">
                    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfitable ? <TrendingUp className="h-24 w-24" /> : <TrendingDown className="h-24 w-24" />}
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        Period Net Income
                    </p>
                    <p className={`mt-4 text-3xl font-bold tracking-tight ${isProfitable ? 'text-slate-900 dark:text-white' : 'text-rose-500 dark:text-rose-400'}`}>
                        {formatCurrency(stats?.current_period_net_income || 0)}
                    </p>
                    <div className="mt-4 flex items-center text-xs">
                        {isProfitable ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center font-medium bg-emerald-100 dark:bg-emerald-400/10 px-2 py-1 rounded-full">
                                <TrendingUp className="h-3 w-3 mr-1" /> Profitable
                            </span>
                        ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center font-medium bg-rose-100 dark:bg-rose-400/10 px-2 py-1 rounded-full">
                                <TrendingDown className="h-3 w-3 mr-1" /> Operating Loss
                            </span>
                        )}
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                        Period Revenue
                    </p>
                    <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(stats?.current_period_revenue || 0)}
                    </p>
                </div>

                {/* Open AR */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                        Awaiting Payment (AR)
                    </p>
                    <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(stats?.total_open_ar || 0)}
                    </p>
                    <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 font-medium">Invoices sent, uncollected</p>
                </div>

                {/* Open AP */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xl">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                        Pending Debt (AP)
                    </p>
                    <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(stats?.total_open_ap || 0)}
                    </p>
                    <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 font-medium">Bills approved, unpaid</p>
                </div>

            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
                        <BarChart className="h-5 w-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                        Trailing Performance (6 Periods)
                    </h3>
                    <div className="flex-1 w-full min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chart_data}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    stroke="#64748b"
                                    tick={{ fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(226, 232, 240, 0.5)' }}
                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#0f172a' }}
                                    formatter={(value: any) => formatCurrency(Number(value))}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-between">
                        <span className="flex items-center">
                            <Activity className="h-5 w-5 mr-2 text-fuchsia-500 dark:text-fuchsia-400" />
                            Recent Ledger Activity
                        </span>
                    </h3>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        {recent_transactions.length > 0 ? (
                            <ul className="space-y-4">
                                {recent_transactions.map((tx) => (
                                    <li key={tx.id} className="group flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                                        <div className="shrink-0 mt-1">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                                                <DollarSign className="h-4 w-4" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                {tx.description}
                                            </p>
                                            <div className="flex items-center mt-1 text-xs text-slate-500 dark:text-slate-400 gap-2">
                                                <span>{format(new Date(tx.date), 'MMM d, yyyy h:mm a')}</span>
                                                <span>•</span>
                                                <span className="uppercase tracking-wider font-mono text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                                                    JE #{tx.id}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                                                {formatCurrency(tx.amount || 0)}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                <p>No recent ledger activity detected.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
