import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'restricted' | 'readonly' | 'server' | null;
export type PermissionLevel = 'none' | 'view' | 'edit' | 'admin';

export function useUserRole(session: any) {
    const [role, setRole] = useState<UserRole>(null);
    const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
    const [teamOwnerId, setTeamOwnerId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) {
            setRole(null);
            setPermissions({});
            setTeamOwnerId(null);
            setLoading(false);
            return;
        }

        const fetchRoleAndTeam = async () => {
            try {
                // 1. Fetch User Role
                const { data: roleData, error: roleError } = await supabase
                    .from('user_roles')
                    .select('role, permissions')
                    .eq('user_id', session.user.id)
                    .single();

                if (roleError || !roleData) {
                    console.log('Role not found, defaulting to independent admin');
                    setRole('admin');
                    setPermissions({
                        criminal: 'admin',
                        civil: 'admin',
                        lawyer_requests: 'admin',
                        sticky_notes: 'admin',
                        administrative: 'admin',
                        rogatory: 'admin',
                        critical_issues: 'admin',
                        penhora: 'admin',
                        schedules: 'admin'
                    });
                    setTeamOwnerId(session.user.id);
                } else {
                    setRole(roleData.role as UserRole);
                    setPermissions(roleData.permissions || {});

                    // 2. Fetch Team to find Owner (Admin)
                    const { data: teamData, error: teamError } = await supabase.rpc('get_my_team');
                    if (!teamError && teamData && teamData.length > 0) {
                        const admin = teamData.find((m: any) => m.role === 'admin');
                        setTeamOwnerId(admin ? admin.user_id : session.user.id);
                    } else {
                        setTeamOwnerId(session.user.id);
                    }
                }
            } catch (err) {
                console.error('Error fetching role/team:', err);
                setRole('admin');
                setTeamOwnerId(session.user.id);
            } finally {
                setLoading(false);
            }
        };

        fetchRoleAndTeam();
    }, [session]);

    const isAdmin = role === 'admin';
    const canDelete = role === 'admin';
    const canEdit = role === 'admin';

    const checkPermission = (module: string, requiredLevel: PermissionLevel): boolean => {
        const userLevel = permissions[module] || 'none';
        const levels = ['none', 'view', 'edit', 'admin'];
        return levels.indexOf(userLevel) >= levels.indexOf(requiredLevel);
    };

    return { role, permissions, teamOwnerId, isAdmin, canDelete, canEdit, checkPermission, loading };
}
