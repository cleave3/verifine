import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { format } from "date-fns";
import { userService } from "../services/userService";
import { auditService } from "../services/auditService";
import { ChevronLeft, ChevronRight, Activity, Server, ArrowRight } from "lucide-react";
import { RoleGuard } from "../components/RoleGuard";

export default function AuditLog() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState("");
    const [userFilter, setUserFilter] = useState("");

    const { data: usersRes } = useQuery({
        queryKey: ["users"],
        queryFn: userService.getUsers
    });

    const { data: actionTypesRes } = useQuery({
        queryKey: ["audit-action-types"],
        queryFn: auditService.getActionTypes
    });

    const { data: auditRes, isLoading } = useQuery({
        queryKey: ["audit", page, actionFilter, userFilter],
        queryFn: () => auditService.getLogs({
            page,
            page_size: 15,
            action: actionFilter || undefined,
            user_id: userFilter || undefined
        })
    });

    const logs = (auditRes as any)?.data?.results || [];
    const pageInfo = (auditRes as any)?.data?.meta || { current_page: 1, page_count: 1, total_count: 0, is_first_page: true, is_last_page: true };
    const users = usersRes?.data || [];
    const actionTypes = (actionTypesRes as any)?.data || [];

    // Group action types by their specified 'group' field
    const groupedActions = actionTypes.reduce((acc: Record<string, any[]>, curr: any) => {
        if (!acc[curr.group]) {
            acc[curr.group] = [];
        }
        acc[curr.group].push(curr);
        return acc;
    }, {});

    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedLogId(prev => prev === id ? null : id);
    };

    return (
        <RoleGuard allowedRoles={['admin', 'controller']}>
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-indigo-500" />
                            Audit Log
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">Immutable record of critical system actions.</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Action Type</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow min-w-[200px]"
                        >
                            <option value="">All Actions</option>
                            {Object.entries(groupedActions).map(([groupName, actions]: [string, any]) => (
                                <optgroup key={groupName} label={groupName}>
                                    {actions.map((action: any) => (
                                        <option key={action.name} value={action.name}>{action.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">User</label>
                        <select
                            value={userFilter}
                            onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow min-w-[200px]"
                        >
                            <option value="">All Users</option>
                            {users.map((u: any) => (
                                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => {
                            setActionFilter("");
                            setUserFilter("");
                            setPage(1);
                        }}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-medium pb-2 hover:underline transition-colors ml-auto sm:ml-0"
                    >
                        Clear Filters
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center p-12 text-slate-500">
                        <div className="animate-pulse flex items-center gap-2">
                            <Server className="w-5 h-5" />
                            <span>Fetching immutable logs...</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 shadow-sm rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 transition-colors">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actor</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Entity Type</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">IP Address</th>
                                        <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {logs.map((log: any) => (
                                        <React.Fragment key={log.id}>
                                            <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                                                            {log.user.full_name || 'System User'}
                                                        </span>
                                                        <span className="text-xs text-slate-500 truncate max-w-[150px]">
                                                            {log.user.email}
                                                        </span>
                                                        <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 w-fit uppercase">
                                                            {log.user.role}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                                                            {log.entity_type}
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-mono truncate max-w-[100px]" title={log.entity_id}>
                                                            ID: {log.entity_id.substring(0, 8)}...
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                                    {log.ip_address || 'unknown'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => toggleExpand(log.id)}
                                                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                                                    >
                                                        {expandedLogId === log.id ? 'Hide Diff' : 'View Diff'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedLogId === log.id && (
                                                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                                    <td colSpan={6} className="px-8 py-6">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                                            <div>
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                    Previous State
                                                                </h4>
                                                                <pre className="text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-lg overflow-x-auto text-slate-700 dark:text-slate-300 custom-scrollbar max-h-[300px]">
                                                                    {log.previous_state ? JSON.stringify(log.previous_state, null, 2) : 'null'}
                                                                </pre>
                                                            </div>
                                                            <div className="relative">
                                                                <div className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white dark:bg-slate-950 rounded-full p-1 border border-slate-200 dark:border-slate-800 text-slate-400 z-10 shadow-sm">
                                                                    <ArrowRight className="w-4 h-4" />
                                                                </div>
                                                                <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                                    New State
                                                                </h4>
                                                                <pre className="text-[11px] bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-lg overflow-x-auto text-slate-800 dark:text-slate-200 custom-scrollbar max-h-[300px]">
                                                                    {log.new_state ? JSON.stringify(log.new_state, null, 2) : 'null'}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                                    <p className="font-medium text-slate-600 dark:text-slate-400">No audit logs found matching your criteria.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                Showing <span className="font-medium text-slate-900 dark:text-white">{logs.length}</span> of <span className="font-medium text-slate-900 dark:text-white">{pageInfo.total_count}</span> logs
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={pageInfo.is_first_page}
                                    className="p-2 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:hover:bg-transparent"
                                >
                                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                </button>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-2 border-x border-slate-300 dark:border-slate-700">
                                    Page {pageInfo.current_page} of {Math.max(1, pageInfo.page_count)}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(pageInfo.page_count, p + 1))}
                                    disabled={pageInfo.is_last_page}
                                    className="p-2 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:hover:bg-transparent"
                                >
                                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </RoleGuard>
    );
}
