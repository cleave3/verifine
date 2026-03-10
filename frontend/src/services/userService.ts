import api from "../lib/axios";

interface CreateUserPayload {
    email: string;
    role: string;
    first_name?: string;
    last_name?: string;
}

export const userService = {
    getUsers: async () => {
        const response = await api.get("/users/");
        return response.data;
    },

    inviteUser: async (payload: CreateUserPayload) => {
        const response = await api.post("/users/invite", payload);
        return response.data;
    },

    updateRole: async (userId: number, role: string) => {
        const response = await api.patch(`/users/${userId}/role`, { role });
        return response.data;
    },

    deactivateUser: async (userId: number) => {
        const response = await api.patch(`/users/${userId}/deactivate`);
        return response.data;
    },

    reactivateUser: async (userId: number) => {
        const response = await api.patch(`/users/${userId}/reactivate`);
        return response.data;
    },

    updateProfile: async (payload: { first_name?: string; last_name?: string }) => {
        const response = await api.patch("/users/profile", payload);
        return response.data;
    },

    changePassword: async (payload: any) => {
        const response = await api.patch("/users/password", payload);
        return response.data;
    }
};
