import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type UserRole = 'super_admin' | 'admin' | 'restricted' | 'readonly' | 'server' | null;
export type PermissionLevel = 'none' | 'view' | 'edit' | 'admin';

export function useUserRole(session: any) {
    const [role, setRole] = useState<UserRole>(null);
    const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
    const [teamOwnerId, setTeamOwnerId] = useState<string | null>(null);
    const [unit, setUnit] = useState<string | null>(null);
    const [unitId, setUnitId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session) {
            setRole(null);
            setPermissions({});
            setTeamOwnerId(null);
            setUnit(null);
            setLoading(false);
            return;
        }

        const fetchRoleAndTeam = async () => {
            try {
                // 1. Fetch User Role
                const { data: roleData, error: roleError } = await supabase
                    .from('user_roles')
                    .select('role, permissions, unit, unit_id')
                    .eq('user_id', session.user.id)
                    .single();

                if (roleError || !roleData) {
                    console.log('Role not found, defaulting to readonly');
                    setRole('readonly');
                    setPermissions({
                        criminal: 'view',
                        civil: 'view',
                        lawyer_requests: 'view',
                        sticky_notes: 'view',
                        administrative: 'view',
                        rogatory: 'view',
                        critical_issues: 'view',
                        penhora: 'view',
                        schedules: 'view',
                        productivity: 'view'
                    });
                    setTeamOwnerId(session.user.id);
                    setUnit(null);
                } else {
                    setRole(roleData.role as UserRole);
                    setPermissions(roleData.permissions || {});
                    setUnit(roleData.unit);
                    setUnitId(roleData.unit_id);

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
                setRole('readonly');
                setTeamOwnerId(session.user.id);
            } finally {
                setLoading(false);
            }
        };

        fetchRoleAndTeam();
    }, [session]);

    const isSuperAdmin = role === 'super_admin';
    const isAdmin = role === 'admin' || isSuperAdmin;
    const canDelete = role === 'admin' || isSuperAdmin;
    const canEdit = role === 'admin' || isSuperAdmin;

    const checkPermission = (module: string, requiredLevel: PermissionLevel): boolean => {
        const userLevel = permissions[module] || 'none';
        const levels = ['none', 'view', 'edit', 'admin'];
        return levels.indexOf(userLevel) >= levels.indexOf(requiredLevel);
    };

    return { role, permissions, teamOwnerId, unit, unitId, isAdmin, isSuperAdmin, canDelete, canEdit, checkPermission, loading };
}
