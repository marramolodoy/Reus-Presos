import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'restricted' | 'readonly' | 'server' | null;
export type PermissionLevel = 'none' | 'view' | 'edit' | 'admin';

export function useUserRole(session: any) {
    const [role, setRole] = useState<UserRole>(null);
    const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) {
            setRole(null);
            setPermissions({});
            setLoading(false);
            return;
        }

        const fetchRole = async () => {
            try {
                const { data, error } = await supabase
                    .from('user_roles')
                    .select('role, permissions')
                    .eq('user_id', session.user.id)
                    .single();

                if (error || !data) {
                    console.log('Role not found, defaulting to restricted');
                    setRole('restricted');
                    setPermissions({});
                } else {
                    setRole(data.role as UserRole);
                    setPermissions(data.permissions || {});
                }
            } catch (err) {
                console.error('Error fetching role:', err);
                setRole('restricted');
                setPermissions({});
            } finally {
                setLoading(false);
            }
        };

        fetchRole();
    }, [session]);

    const isAdmin = role === 'admin';
    const canDelete = role === 'admin';
    const canEdit = role === 'admin';

    const checkPermission = (module: string, requiredLevel: PermissionLevel): boolean => {
        const userLevel = permissions[module] || 'none';
        const levels = ['none', 'view', 'edit', 'admin'];
        return levels.indexOf(userLevel) >= levels.indexOf(requiredLevel);
    };

    return { role, permissions, isAdmin, canDelete, canEdit, checkPermission, loading };
}
