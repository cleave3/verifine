import { create } from "zustand";
import api from "../lib/axios";

interface Organization {
    id: string;
    name: string;
    slug: string;
    base_currency_code: string;
    logo_url: string | null;
    primary_color: string | null;
    address: string | null;
    tax_id: string | null;
}

interface User {
    id: number;
    email: string;
    full_name: string | null;
    role: string;
    org_id: string;
    mfa_enabled: boolean;
}

interface AuthState {
    user: User | null;
    currentOrg: Organization | null;
    isLoading: boolean;
    login: (data: any) => Promise<any>;
    mfaLogin: (data: { email: string; code: string; mfa_token: string }) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    refreshOrg: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    currentOrg: null,
    isLoading: true,
    login: async (credentials) => {
        const res = await api.post("/auth/login", credentials);
        if (res.data.data.mfa_required) {
            return res.data.data; // Return mfa_token and mfa_required flag
        }
        const user = res.data.data;
        const orgRes = await api.get("/organizations/me");
        set({ user, currentOrg: orgRes.data.data });
    },
    mfaLogin: async (data: { email: string; code: string; mfa_token: string }) => {
        const res = await api.post("/auth/mfa/login", data);
        const user = res.data.data;
        const orgRes = await api.get("/organizations/me");
        set({ user, currentOrg: orgRes.data.data });
    },
    logout: async () => {
        await api.post("/auth/logout");
        set({ user: null, currentOrg: null });
    },
    checkAuth: async () => {
        try {
            set({ isLoading: true });
            const res = await api.get("/users/profile");
            const user = res.data.data;
            const orgRes = await api.get("/organizations/me");
            set({ user, currentOrg: orgRes.data.data, isLoading: false });
        } catch (err) {
            set({ user: null, currentOrg: null, isLoading: false });
        }
    },
    refreshOrg: async () => {
        try {
            const orgRes = await api.get("/organizations/me");
            set({ currentOrg: orgRes.data.data });
        } catch (err) {
            console.error("Failed to refresh organization", err);
        }
    }
}));

window.addEventListener('auth:unauthorized', () => {
    useAuthStore.setState({ user: null, currentOrg: null, isLoading: false });
});
