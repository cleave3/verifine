import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import { User, KeyRound } from 'lucide-react';

export default function Profile() {
    const { user, checkAuth } = useAuthStore();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);

    const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsUpdating(true);
        const fd = new FormData(e.currentTarget);
        try {
            await api.patch('/users/profile', {
                full_name: fd.get('full_name'),
            });
            await checkAuth();
            toast.success('Profile updated successfully');
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to update profile');
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsPasswordUpdating(true);
        const fd = new FormData(e.currentTarget);
        const current_password = fd.get('current_password') as string;
        const new_password = fd.get('new_password') as string;
        const confirm_password = fd.get('confirm_password') as string;

        if (new_password !== confirm_password) {
            toast.error('Passwords do not match');
            setIsPasswordUpdating(false);
            return;
        }

        try {
            await api.patch('/users/password', {
                current_password,
                new_password,
            });
            toast.success('Password changed successfully');
            (e.target as HTMLFormElement).reset();
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to change password');
        } finally {
            setIsPasswordUpdating(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="w-6 h-6 text-indigo-600" />
                    My Profile
                </h1>
            </div>

            <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Personal Information</h2>
                <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                        <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-md border border-slate-200 dark:border-slate-700 text-sm">
                            {user?.email} (Cannot be changed)
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                        <input required type="text" name="full_name" defaultValue={user?.full_name || ''} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                        <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-md border border-slate-200 dark:border-slate-700 text-sm capitalize">
                            {user?.role}
                        </div>
                    </div>
                    <div className="pt-2">
                        <button type="submit" disabled={isUpdating} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">
                            {isUpdating ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white dark:bg-slate-900 shadow rounded-lg p-6 border border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-slate-400" />
                    Security
                </h2>
                <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-xl">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
                        <input required type="password" name="current_password" minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                        <input required type="password" name="new_password" minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white p-2 border" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                        <input required type="password" name="confirm_password" minLength={6} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white p-2 border" />
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={isPasswordUpdating} className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 focus:outline-none disabled:opacity-50">
                            {isPasswordUpdating ? 'Updating...' : 'Change Password'}
                        </button>
                    </div>
                </form>
            </div>

        </div>
    );
}
