import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'primary' | 'danger' | 'warning' | 'success';
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    type = 'primary'
}: ConfirmDialogProps) {
    if (!isOpen) return null;

    const buttonStyles = {
        primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        danger: 'bg-rose-600 hover:bg-rose-700 text-white',
        warning: 'bg-amber-500 hover:bg-amber-600 text-white',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    };

    const iconColors = {
        primary: 'text-indigo-600 dark:text-indigo-400',
        danger: 'text-rose-600 dark:text-rose-400',
        warning: 'text-amber-500 dark:text-amber-400',
        success: 'text-emerald-600 dark:text-emerald-400',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full bg-slate-100 dark:bg-slate-700 ${iconColors[type]}`}>
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                {title}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onCancel(); // auto-close on confirm
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${buttonStyles[type]}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
