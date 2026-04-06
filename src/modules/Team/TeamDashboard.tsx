// ... imports remain the same, but let's ensure we have everything
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { Button } from '../../components/ui/Button';
import { Plus, Trash, User, Search, UserPlus, AlertTriangle, Shield, Building2, Users } from 'lucide-react';
import { PermissionModal } from './PermissionModal';

interface TeamMember {
    user_id: string;
    email: string;
    role: string;
    permissions: any;
    joined_at: string;
    name?: string;
}

interface TeamDashboardProps {
    session: any;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ session }) => {
    const { isAdmin, isSuperAdmin, loading: loadingRole, unitId: myUnitId } = useUserRole(session);

    // Tabs: 'my_team' | 'manage_units'
    const [activeTab, setActiveTab] = useState<'my_team' | 'manage_units'>('my_team');

    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Super Admin: Unit Selection
    const [availableUnits, setAvailableUnits] = useState<{ id: string, name: string }[]>([]);
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

    const [permissionModal, setPermissionModal] = useState<{ isOpen: boolean; user: any | null }>({ isOpen: false, user: null });
    const [profileModal, setProfileModal] = useState<{ isOpen: boolean; user: any | null }>({ isOpen: false, user: null });
    const [profilingName, setProfilingName] = useState('');

    const fetchTeam = async () => {
        setLoading(true);
        setError(null);

        try {
            let data: any[] = [];
            let fetchError: any = null;

            // Scenario 1: Super Admin managing a specific unit
            if (activeTab === 'manage_units' && selectedUnitId) {
                // Fetch members of selected unit directly from user_roles
                // Join with auth.users is tricky without RPC if we don't have direct access to auth schema in client
                // BUT we have get_my_team RPC. Let's try to query user_roles View/Table if we have permission.
                // Actually, `get_my_team` only returns MY unit.
                // We need a way to get members of another unit.
                // Since Super Admin has access to user_roles, we can select from it.
                // However, we can't join auth.users easily from client (security).
                // WORKAROUND: We will fetch user_roles and then fetch profiles. Email might be missing if we can't access auth.users.
                // For now, let's use a new RPC or try to reuse get_my_team by "impersonating"? No.
                // Best bet: Fetch user_roles (which has permissions) and user_profiles (names).
                // Email is in auth.users. 
                // Let's assume for now we can read public.user_roles.
                // Does user_roles have email? No.
                // We might need a new RPC `get_unit_members(unit_id)`.
                // For now, let's use `get_my_team` if selecting own unit, otherwise we might see restricted info.
                // IMPROVEMENT: Let's create `get_unit_team` RPC quickly? 
                // Or just use `user_roles` and accept we might not see emails if not in `user_profiles`.
                // Wait, `add_team_member` adds to `user_roles`.
                // Let's rely on a direct query to `user_roles` and `user_profiles`.
                // If we can't get emails, we display User ID or fetched name.

                const { data: roles, error: rolesError } = await supabase
                    .from('user_roles')
                    .select('*')
                    .eq('unit_id', selectedUnitId);

                if (rolesError) throw rolesError;

                // We need emails. This is a problem without RPC.
                // Let's assume we implement a quick RPC or use V2 if exists.
                // Actually, let's look at `get_my_team`. It joins `auth.users`.
                // We should probably modify `get_my_team` to accept `unit_id` override for Super Admins.
                // BUT since I can't edit RPC easily from here (I can), let's just do that in valid SQL step.
                // For this rendering, let's assume `get_unit_team` exists or we use `user_roles`.
                // Revert to basics: Use `user_roles` and join what we can.
                // If we miss emails, it's bad.
                // OK, I will add `get_unit_team` RPC in a separate step.
                // For now, I will write the frontend code assuming `get_unit_members` RPC exists.

                const { data: unitMembers, error: rpcError } = await supabase.rpc('get_unit_members', { target_unit_id: selectedUnitId });
                if (rpcError) throw rpcError;
                data = unitMembers;

            } else {
                // Scenario 2: Standard "My Team" view
                const { data: myTeam, error: myTeamError } = await supabase.rpc('get_my_team');
                if (myTeamError) throw myTeamError;
                data = myTeam || [];
            }

            // Fetch profiles for names
            const userIds = data.map((m: any) => m.user_id);
            if (userIds.length > 0) {
                const { data: profilesData } = await supabase.from('user_profiles').select('user_id, name').in('user_id', userIds);

                const merged = data.map((member: any) => {
                    const profile = profilesData?.find((p: any) => p.user_id === member.user_id);
                    return { ...member, name: profile?.name || '' };
                });
                setTeam(merged);
            } else {
                setTeam([]);
            }

        } catch (err: any) {
            console.error('Error fetching team:', err);
            setError('Erro ao carregar equipe: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnits = async () => {
        if (!isSuperAdmin) return;
        const { data, error } = await supabase.from('units').select('id, name').order('name');
        if (!error && data) {
            setAvailableUnits(data);
        }
    };

    useEffect(() => {
        if (session) {
            if (activeTab === 'my_team') {
                fetchTeam();
            } else if (activeTab === 'manage_units') {
                fetchUnits();
                if (selectedUnitId) {
                    fetchTeam();
                } else {
                    setTeam([]);
                }
            }
        }
    }, [session, isSuperAdmin, activeTab, selectedUnitId]);


    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);
        setSuccess(null);

        try {
            // Determine target unit
            let targetUnit = myUnitId;
            if (activeTab === 'manage_units') {
                if (!selectedUnitId) throw new Error("Selecione uma unidade primeiro.");
                targetUnit = selectedUnitId;
            }

            const { data, error } = await supabase.rpc('add_team_member_v2', {
                target_email: email,
                target_unit_id: targetUnit
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            setSuccess(data.message);
            setEmail('');
            fetchTeam();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Erro ao adicionar membro.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleUpdateRole = async (userId: string, newRole: string) => {
        try {
            const { data, error } = await supabase.rpc('update_user_role', {
                target_user_id: userId,
                new_role: newRole
            });

            if (error) throw error;
            
            if (data && typeof data === 'object' && data.success === false) {
                throw new Error(data.message || 'Falha na validação do servidor.');
            }

            fetchTeam();
        } catch (error: any) {
            console.error('Update Role Error:', error);
            alert('Erro ao atualizar função: ' + (error.message || 'Erro desconhecido.'));
            fetchTeam(); // Reset dropdown visually if it failed
        }
    };

    const handleRemoveMember = async (userId: string, email: string) => {
        if (!confirm(`Remover acessos de ${email}?`)) return;

        const { error } = await supabase.rpc('remove_team_member', {
            target_id: userId
        });

        if (error) {
            alert('Erro ao remover: ' + error.message);
        } else {
            fetchTeam();
        }
    };

    // ... Profile update Logic (same as before)
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase.rpc('update_user_profile', {
                target_user_id: profileModal.user.user_id,
                new_name: profilingName
            });
            if (error) throw error;
            setProfileModal({ isOpen: false, user: null });
            fetchTeam();
        } catch (err: any) { alert('Erro: ' + err.message); }
    };


    if (loadingRole) return <div className="p-8 text-center text-gray-500">Carregando permissões...</div>;
    if (!isAdmin) return <div className="p-8 text-center text-gray-500"><AlertTriangle className="mx-auto mb-2" />Apenas administradores podem gerenciar a equipe.</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Users className="text-justice-600" />
                Equipe e Permissões
            </h1>

            {/* TABS for Super Admin */}
            {isSuperAdmin && (
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab('my_team')}
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'my_team' ? 'border-justice-600 text-justice-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <User size={16} /> Minha Equipe Local
                    </button>
                    <button
                        onClick={() => setActiveTab('manage_units')}
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'manage_units' ? 'border-justice-600 text-justice-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Building2 size={16} /> Gerenciar Unidades (Super Admin)
                    </button>
                </div>
            )}

            {/* Unit Selector (Only in Manage Units Tab) */}
            {activeTab === 'manage_units' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                    <label className="block text-sm font-medium text-blue-900 mb-2">Selecione a Unidade para Gerenciar:</label>
                    <select
                        value={selectedUnitId || ''}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full md:w-1/2 rounded-md border-blue-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 border"
                    >
                        <option value="" disabled>-- Escolha uma Unidade --</option>
                        {availableUnits.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Main Content Area */}
            <div className="space-y-6">

                {/* Add Member Form - Context Aware */}
                <form onSubmit={handleAddMember} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <UserPlus size={20} className="text-justice-600" />
                        {activeTab === 'manage_units' ? 'Adicionar Membro à Unidade Selecionada' : 'Adicionar Novo Membro'}
                    </h2>

                    <div className="flex gap-4 items-end flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email do Usuário</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@exemplo.com"
                                    className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-justice-500 focus:ring-justice-500 py-2 border"
                                    disabled={activeTab === 'manage_units' && !selectedUnitId}
                                />
                            </div>
                        </div>
                        <Button type="submit" isLoading={isAdding} disabled={!email || (activeTab === 'manage_units' && !selectedUnitId)}>
                            <Plus size={18} className="mr-2" />
                            Adicionar
                        </Button>
                    </div>
                    {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-center gap-2"><AlertTriangle size={16} />{error}</div>}
                    {success && <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{success}</div>}
                </form>

                {/* Team List */}
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-semibold text-gray-700">Membros {activeTab === 'manage_units' && selectedUnitId ? 'da Unidade' : ''}</h2>
                        <span className="text-xs text-gray-500">{team.length} membros</span>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Carregando...</div>
                    ) : team.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {activeTab === 'manage_units' && !selectedUnitId
                                ? 'Selecione uma unidade acima para ver a equipe.'
                                : 'Nenhum membro encontrado.'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {team.map(member => (
                                <li key={member.user_id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-justice-100 p-2 rounded-full text-justice-600"><User size={20} /></div>
                                        <div>
                                            <div className="font-medium text-gray-800">{member.email}</div>
                                            <div className="text-xs flex gap-2 mt-0.5 items-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${member.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{member.role}</span>
                                                {/* Role Selector Logic (Simplified) */}
                                                {member.user_id !== session.user.id && (
                                                    <select value={member.role} onChange={(e) => handleUpdateRole(member.user_id, e.target.value)} className="text-[10px] border-gray-300 rounded focus:ring-1 focus:ring-justice-200">
                                                        <option value="server">Servidor</option>
                                                        <option value="restricted">Restrito</option>
                                                        <option value="readonly">Leitura</option>
                                                        <option value="admin">Administrador</option>
                                                    </select>
                                                )}
                                                <button onClick={() => setPermissionModal({ isOpen: true, user: member })} className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 border border-gray-200">Permissões</button>
                                                <button onClick={() => { setProfileModal({ isOpen: true, user: member }); setProfilingName(member.name || ''); }} className="ml-2 text-[10px] text-blue-600 hover:underline">{member.name ? `Alias: ${member.name}` : '+ Definir Nome'}</button>
                                            </div>
                                        </div>
                                    </div>
                                    {member.user_id !== session.user.id && (
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(member.user_id, member.email)} className="text-gray-400 hover:text-red-600"><Trash size={18} /></Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Modals */}
            {permissionModal.isOpen && permissionModal.user && (
                <PermissionModal isOpen={permissionModal.isOpen} onClose={() => setPermissionModal({ isOpen: false, user: null })} targetUser={permissionModal.user} onSuccess={fetchTeam} />
            )}
            {profileModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4">Definir Nome</h3>
                        <form onSubmit={handleUpdateProfile}>
                            <input type="text" className="w-full border rounded p-2 mb-4" placeholder="Ex: Nome" value={profilingName} onChange={e => setProfilingName(e.target.value)} autoFocus />
                            <div className="flex justify-end gap-2"><button type="button" onClick={() => setProfileModal({ isOpen: false, user: null })} className="px-4 py-2 hover:bg-gray-100 rounded">Cancelar</button><button type="submit" className="px-4 py-2 bg-justice-600 text-white rounded">Salvar</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
