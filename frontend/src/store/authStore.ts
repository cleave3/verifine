import { create } from "zustand";
import api from "../lib/axios";

interface User {
    id: number;
    email: string;
    full_name: string | null;
}

interface AuthState {
    user: User | null;
    isLoading: boolean;
    login: (data: any) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isLoading: true,
    login: async (credentials) => {
        const res = await api.post("/auth/login", credentials);
        set({ user: res.data.data }); // Standard API wrapper structure expects {data: user}
    },
    logout: async () => {
        await api.post("/auth/logout");
        set({ user: null });
    },
    checkAuth: async () => {
        try {
            set({ isLoading: true });
            const res = await api.get("/auth/me");
            set({ user: res.data.data, isLoading: false });
        } catch (err) {
            set({ user: null, isLoading: false });
        }
    },
}));

window.addEventListener('auth:unauthorized', () => {
    useAuthStore.setState({ user: null, isLoading: false });
});
