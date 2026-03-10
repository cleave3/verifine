import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { Users as UsersIcon, UserPlus, Shield, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface User {
    id: number;
    email: string;
    full_name: string | null;
    role: string;
    is_active: boolean;
}

export default function Users() {
    const { currentOrg, user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [deactivatingUserId, setDeactivatingUserId] = useState<number | null>(null);
    const [reactivatingUserId, setReactivatingUserId] = useState<number | null>(null);

    const { data: users, isLoading } = useQuery({
        queryKey: ['users', currentOrg?.id],
        queryFn: async () => {
            const res = await userService.getUsers();
            return res.data as User[];
        },
        enabled: !!currentOrg,
    });

    const inviteMutation = useMutation({
        mutationFn: async (data: { email: string; full_name: string; role: string }) => {
            await userService.inviteUser(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Invitation sent');
            setIsInviteModalOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to send invite');
        },
    });

    const roleMutation = useMutation({
        mutationFn: async (data: { userId: number; role: string }) => {
            await userService.updateRole(data.userId, data.role);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Role updated');
            setIsRoleModalOpen(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to update role');
        },
    });

    const deactMutation = useMutation({
        mutationFn: async (userId: number) => {
            await userService.deactivateUser(userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('User deactivated');
            setDeactivatingUserId(null);
        },
    });

    const reactivateMutation = useMutation({
        mutationFn: async (userId: number) => {
            await userService.reactivateUser(userId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('User reactivated');
            setReactivatingUserId(null);
        },
    });

    const openRoleModal = (u: User) => {
        setSelectedUser(u);
        setIsRoleModalOpen(true);
    };

    const handleInviteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        inviteMutation.mutate({
            email: fd.get('email') as string,
            full_name: fd.get('full_name') as string,
            role: fd.get('role') as string,
        });
    };

    const handleRoleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedUser) return;
        const fd = new FormData(e.currentTarget);
        roleMutation.mutate({
            userId: selectedUser.id,
            role: fd.get('role') as string,
        });
    };

    if (isLoading) return <div className="p-8 flex items-center justify-center h-full"><RefreshCw className="w-8 h-8 animate-spin text-indigo-600" /></div>;

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <UsersIcon className="w-6 h-6 text-indigo-600" />
                        Team Management
                    </h1>
                    <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                        Manage your organization's members and access levels.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none sm:w-auto transition-colors"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                    </button>
                </div>
            </div>

            <div className="mt-8 flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Name</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Email</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Role</th>
                                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                                        <th className="relative py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap text-right">
                                            <span className="sr-only">Actions</span>
                                            <div className="text-xs font-medium text-slate-500 flex items-center justify-end">Actions</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {users?.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-gray-100 font-medium">{u.full_name || '—'}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{u.email}</td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold
                          ${u.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                                                        u.role === 'controller' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                                            u.role === 'accountant' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                u.role === 'clerk' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                    'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}>
                                                    <Shield className="w-3 h-3 mr-1" />
                                                    {u.role.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                {u.is_active ?
                                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</span>
                                                    :
                                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">Inactive</span>
                                                }
                                            </td>
                                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                {u.id !== currentUser?.id && u.is_active && (
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => openRoleModal(u)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">
                                                            Change Role
                                                        </button>
                                                        <button onClick={() => setDeactivatingUserId(u.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-4">
                                                            Deactivate
                                                        </button>
                                                    </div>
                                                )}
                                                {u.id !== currentUser?.id && !u.is_active && (
                                                    <div className="flex gap-2 justify-end">
                                                        <button onClick={() => setReactivatingUserId(u.id)} className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300">
                                                            Reactivate
                                                        </button>
                                                    </div>
                                                )}
                                                {u.id === currentUser?.id && <span className="text-slate-400 text-xs italic">You</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {users?.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                                                No users found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-gray-500/75 dark:bg-slate-900/80 transition-opacity z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">Invite New Member</h3>
                        <form onSubmit={handleInviteSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                <input required type="text" name="full_name" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white p-2 border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                                <input required type="email" name="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white p-2 border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                                <select name="role" defaultValue="viewer" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white p-2 border">
                                    <option value="viewer">Viewer (Read-only access)</option>
                                    <option value="clerk">Clerk (Data Entry, AR/AP)</option>
                                    <option value="accountant">Accountant (Journal Entries, Reports)</option>
                                    <option value="controller">Controller (Approvals, Period Mgmt)</option>
                                    <option value="admin">Admin (Full System Access)</option>
                                </select>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-slate-700 dark:text-gray-200 dark:border-slate-600 dark:hover:bg-slate-600">Cancel</button>
                                <button type="submit" disabled={inviteMutation.isPending} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                                    {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isRoleModalOpen && selectedUser && (
                <div className="fixed inset-0 bg-gray-500/75 dark:bg-slate-900/80 transition-opacity z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">Change Role: {selectedUser.full_name}</h3>
                        <form onSubmit={handleRoleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Role</label>
                                <select name="role" defaultValue={selectedUser.role} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white p-2 border">
                                    <option value="viewer">Viewer</option>
                                    <option value="clerk">Clerk</option>
                                    <option value="accountant">Accountant</option>
                                    <option value="controller">Controller</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsRoleModalOpen(false)} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:bg-slate-700 dark:text-gray-200 dark:border-slate-600 dark:hover:bg-slate-600">Cancel</button>
                                <button type="submit" disabled={roleMutation.isPending} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                                    {roleMutation.isPending ? 'Saving...' : 'Update Role'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deactivatingUserId !== null}
                title="Deactivate User"
                message="Are you sure you want to deactivate this member? They will no longer be able to log in or access organization data."
                confirmText="Yes, Deactivate"
                type="danger"
                onConfirm={() => deactivatingUserId && deactMutation.mutate(deactivatingUserId)}
                onCancel={() => setDeactivatingUserId(null)}
            />

            <ConfirmDialog
                isOpen={reactivatingUserId !== null}
                title="Reactivate User"
                message="Are you sure you want to reactivate this member? They will regain access to log in and organization data."
                confirmText="Yes, Reactivate"
                type="success"
                onConfirm={() => reactivatingUserId && reactivateMutation.mutate(reactivatingUserId)}
                onCancel={() => setReactivatingUserId(null)}
            />

        </div>
    );
}
