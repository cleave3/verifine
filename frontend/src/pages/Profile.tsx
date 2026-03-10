import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import { mfaService } from '../services/mfaService';
import toast from 'react-hot-toast';
import { User, KeyRound, ShieldCheck, CheckCircle, XCircle, Mail, Briefcase, ChevronRight, Smartphone, Lock } from 'lucide-react';
import { useConfirmStore } from '../store/confirmStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PasswordInput } from '../components/ui/PasswordInput';

type Section = 'general' | 'security' | 'mfa';

export default function Profile() {
    const queryClient = useQueryClient();
    const { confirm } = useConfirmStore();

    // Queries
    const { data: profile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: userService.getProfile
    });

    const { data: mfaStatus, isLoading: isMfaStatusLoading } = useQuery({
        queryKey: ['mfaStatus'],
        queryFn: mfaService.getStatus
    });

    // Mutations
    const updateProfileMutation = useMutation({
        mutationFn: userService.updateProfile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            toast.success('Profile updated successfully');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to update profile');
        }
    });

    const changePasswordMutation = useMutation({
        mutationFn: userService.changePassword,
        onSuccess: () => {
            toast.success('Password changed successfully');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to change password');
        }
    });

    const initiateMfaSetupMutation = useMutation({
        mutationFn: mfaService.setup,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mfaStatus'] });
            setShowSetup(true);
        },
        onError: () => {
            toast.error('Failed to initiate MFA setup');
        }
    });

    const verifyMfaMutation = useMutation({
        mutationFn: mfaService.verify,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mfaStatus'] });
            setShowSetup(false);
            setMfaCode('');
            toast.success('MFA enabled successfully');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Invalid verification code');
        }
    });

    const disableMfaMutation = useMutation({
        mutationFn: mfaService.disable,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mfaStatus'] });
            toast.success('MFA disabled successfully');
        },
        onError: () => {
            toast.error('Failed to disable MFA');
        }
    });

    // Local UI States
    const [mfaCode, setMfaCode] = useState('');
    const [showSetup, setShowSetup] = useState(false);
    const [activeSection, setActiveSection] = useState<Section>('general');

    useEffect(() => {
        // Automatically show setup if secret is present but MFA is not yet enabled
        if (mfaStatus && mfaStatus.secret && !mfaStatus.mfa_enabled) {
            setShowSetup(true);
            setActiveSection('mfa');
        }
    }, [mfaStatus]);

    const handleProfileUpdate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const fullName = fd.get('full_name')?.toString() || '';
        updateProfileMutation.mutate({
            full_name: fullName
        } as any);
    };

    const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const current_password = fd.get('current_password') as string;
        const new_password = fd.get('new_password') as string;
        const confirm_password = fd.get('confirm_password') as string;

        if (new_password !== confirm_password) {
            toast.error('Passwords do not match');
            return;
        }

        changePasswordMutation.mutate({
            current_password,
            new_password,
        });
        (e.target as HTMLFormElement).reset();
    };

    const disableMfa = async () => {
        const confirmed = await confirm({
            title: "Disable MFA Protection",
            message: "Are you sure you want to disable Multi-Factor Authentication? Your account will be less secure.",
            confirmText: "Yes, Disable MFA",
            type: "danger"
        });

        if (confirmed) {
            disableMfaMutation.mutate();
        }
    };

    if (isProfileLoading || isMfaStatusLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const navigationItems = [
        { id: 'general' as Section, label: 'General Info', icon: User, description: 'Profile details and personal data' },
        { id: 'security' as Section, label: 'Password', icon: KeyRound, description: 'Manage your account password' },
        { id: 'mfa' as Section, label: 'Two-Factor Auth', icon: ShieldCheck, description: 'Additional security layer' },
    ];

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="mb-8 font-sans">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Account Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account preferences and security settings.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 font-sans">
                {/* Navigation Sidebar */}
                <aside className="w-full lg:w-72 shrink-0">
                    <nav className="flex flex-col gap-1">
                        {navigationItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeSection === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`
                                        flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200
                                        ${isActive
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/10'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
                                    `}
                                >
                                    <div className={`p-2 rounded-lg ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="block font-semibold text-sm">{item.label}</span>
                                        <span className={`block text-[11px] leading-tight mt-0.5 ${isActive ? 'text-indigo-600/70 dark:text-indigo-400/70' : 'text-slate-500'}`}>
                                            {item.description}
                                        </span>
                                    </div>
                                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content Area */}
                <main className="flex-1 min-w-0">
                    {activeSection === 'general' && (
                        <div
                            key="general"
                            className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-8"
                        >
                            <div className="flex items-center gap-2 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <User className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Personal Information</h2>
                            </div>

                            <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                        <Mail className="w-3.5 h-3.5" /> Email Address
                                    </label>
                                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-slate-500 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium">
                                        {profile?.email}
                                        <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 rounded uppercase">Read Only</span>
                                    </div>
                                </div>

                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                        <Briefcase className="w-3.5 h-3.5" /> Account Role
                                    </label>
                                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-slate-500 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium capitalize">
                                        {profile?.role}
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                                        Full Name
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        name="full_name"
                                        defaultValue={profile?.full_name || ''}
                                        className="w-full px-4 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div className="col-span-2 pt-4">
                                    <button
                                        type="submit"
                                        disabled={updateProfileMutation.isPending}
                                        className="inline-flex items-center justify-center px-6 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-opacity-90 rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                                    >
                                        {updateProfileMutation.isPending ? 'Saving Changes...' : 'Update Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeSection === 'security' && (
                        <div
                            key="security"
                            className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-8"
                        >
                            <div className="flex items-center gap-2 mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <Lock className="w-5 h-5 text-indigo-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security Settings</h2>
                            </div>

                            <form onSubmit={handlePasswordUpdate} className="space-y-6 max-w-xl">
                                <div className="space-y-4 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <PasswordInput
                                        label="Current Password"
                                        name="current_password"
                                        required
                                        minLength={6}
                                        icon={<Lock className="w-5 h-5" />}
                                    />
                                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-2" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <PasswordInput
                                            label="New Password"
                                            name="new_password"
                                            required
                                            minLength={6}
                                        />
                                        <PasswordInput
                                            label="Confirm New Password"
                                            name="confirm_password"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={changePasswordMutation.isPending}
                                        className="px-6 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-indigo-600 hover:opacity-90 rounded-xl transition-all shadow-lg shadow-slate-200 dark:shadow-indigo-900/20 disabled:opacity-50"
                                    >
                                        {changePasswordMutation.isPending ? 'Updating...' : 'Change Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeSection === 'mfa' && (
                        <div
                            key="mfa"
                            className="bg-white dark:bg-slate-900 shadow-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-8"
                        >
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Multi-Factor Authentication</h2>
                                </div>
                                {mfaStatus?.mfa_enabled ? (
                                    <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> PROTECTED
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-800">
                                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> INACTIVE
                                    </span>
                                )}
                            </div>

                            {!mfaStatus?.mfa_enabled && !showSetup && (
                                <div className="max-w-2xl">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 mb-8">
                                        <h3 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-2">
                                            <Smartphone className="w-5 h-5" /> Secure your account
                                        </h3>
                                        <p className="text-sm text-indigo-700 dark:text-indigo-400/80 leading-relaxed font-medium">
                                            Add an extra layer of security to your account. In addition to your password, you'll need to provide a code from your authenticator app.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => initiateMfaSetupMutation.mutate()}
                                        disabled={initiateMfaSetupMutation.isPending}
                                        className="inline-flex items-center px-6 py-4 border border-transparent text-sm font-bold rounded-xl shadow-xl shadow-indigo-500/10 text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50"
                                    >
                                        {initiateMfaSetupMutation.isPending ? 'Preparing Setup...' : 'Enable Two-Factor Authentication'}
                                    </button>
                                </div>
                            )}

                            {/* <AnimatePresence> */}
                            {showSetup && mfaStatus?.secret && (
                                <div
                                    // initial={{ height: 0, opacity: 0 }}
                                    // animate={{ height: 'auto', opacity: 1 }}
                                    // exit={{ height: 0, opacity: 0 }}
                                    className="space-y-8"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 dark:bg-slate-800/20 p-8 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                                                <img
                                                    src={mfaStatus.qr_code}
                                                    alt="MFA QR Code"
                                                    className="w-40 h-40"
                                                />
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scan this code</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex items-start gap-4">
                                                <div className="shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                                    Open your authenticator app (e.g. Google Authenticator, Authy, or Microsoft Authenticator).
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                                                <div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-3">
                                                        Scan the QR code or enter the secret key manually:
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                            {mfaStatus.secret}
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 max-w-md">
                                        <label className="text-sm font-bold text-slate-900 dark:text-white block">
                                            Enter Verification Code
                                        </label>
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                maxLength={6}
                                                placeholder="000 000"
                                                value={mfaCode}
                                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                                                className="flex-1 px-4 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-2xl border-2 border-slate-100 dark:border-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono tracking-[0.3em] text-center text-xl font-bold"
                                            />
                                            <button
                                                onClick={() => verifyMfaMutation.mutate(mfaCode)}
                                                disabled={verifyMfaMutation.isPending || mfaCode.length !== 6}
                                                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition-all font-sans"
                                            >
                                                {verifyMfaMutation.isPending ? '...' : 'Verify'}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowSetup(false)}
                                            className="w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                        >
                                            Cancel Setup
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* </AnimatePresence> */}

                            {mfaStatus?.mfa_enabled && (
                                <div className="space-y-8">
                                    <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 flex items-start gap-4">
                                        <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
                                            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-bold text-emerald-900 dark:text-emerald-300">Account Protected</h4>
                                            <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed font-medium">
                                                Multi-Factor Authentication is currently enabled. You'll be asked for a security code each time you sign in to your Verifine account.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <button
                                            onClick={disableMfa}
                                            disabled={disableMfaMutation.isPending}
                                            className="text-sm font-bold text-rose-600 hover:text-rose-500 flex items-center gap-2 transition-colors disabled:opacity-50 group"
                                        >
                                            <XCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                            {disableMfaMutation.isPending ? 'Disabling Protection...' : 'Disable Multi-Factor Authentication'}
                                        </button>
                                        <p className="mt-2 text-xs text-slate-400 font-medium italic">Disabling MFA is not recommended and will make your account more vulnerable.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
