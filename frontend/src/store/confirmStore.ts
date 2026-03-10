import { create } from 'zustand';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'primary' | 'danger' | 'warning' | 'success';
}

interface ConfirmState {
    isOpen: boolean;
    options: ConfirmOptions;
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    resolve: (value: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
    isOpen: false,
    options: {
        title: '',
        message: '',
    },
    resolve: () => {},
    confirm: (options) => {
        return new Promise((resolve) => {
            set({
                isOpen: true,
                options: {
                    ...options,
                    confirmText: options.confirmText || 'Confirm',
                    cancelText: options.cancelText || 'Cancel',
                    type: options.type || 'primary',
                },
                resolve,
            });
        });
    },
    onCancel: () => {
        const { resolve } = get();
        set({ isOpen: false });
        resolve(false);
    },
    onConfirm: () => {
        const { resolve } = get();
        set({ isOpen: false });
        resolve(true);
    },
}));
