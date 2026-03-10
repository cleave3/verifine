import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: React.ReactNode;
    containerClassName?: string;
    icon?: React.ReactNode;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ label, containerClassName = '', icon, className = '', ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);

        const toggleVisibility = () => {
            setShowPassword(!showPassword);
        };

        return (
            <div className={`space-y-1.5 ${containerClassName}`}>
                {label && (
                    <div className="flex items-center justify-between">
                        {typeof label === 'string' ? (
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {label}
                            </label>
                        ) : (
                            label
                        )}
                    </div>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            {icon}
                        </div>
                    )}
                    <input
                        {...props}
                        ref={ref}
                        type={showPassword ? 'text' : 'password'}
                        className={`
                            block w-full py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium
                            ${icon ? 'pl-11' : 'pl-4'}
                            ${className}
                        `}
                    />
                    <button
                        type="button"
                        onClick={toggleVisibility}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-indigo-500 transition-colors focus:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                        ) : (
                            <Eye className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        );
    }
);

PasswordInput.displayName = 'PasswordInput';
