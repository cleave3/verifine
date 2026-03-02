import React from 'react';
import { useAuthStore } from '../store/authStore';

interface GuardProps {
    allowedRoles: string[];
    children: React.ReactNode;
}

export const RoleGuard: React.FC<GuardProps> = ({ allowedRoles, children }) => {
    const { user } = useAuthStore();

    if (!user || !allowedRoles.includes(user.role)) {
        return null;
    }

    return <>{children}</>;
};
