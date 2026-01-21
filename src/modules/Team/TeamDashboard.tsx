import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { Button } from '../../components/ui/Button';
import { Plus, Trash, User, Search, UserPlus, AlertTriangle, Shield } from 'lucide-react';
import { PermissionModal } from './PermissionModal';

interface TeamMember {
    user_id: string;
    email: string;
    role: string;
    permissions: any;
    joined_at: string;
}

interface TeamDashboardProps {
    session: any;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({ session }) => {
    const { isAdmin, loading: loadingRole } = useUserRole(session);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [permissionModal, setPermissionModal] = useState<{ isOpen: boolean; user: any | null }>({ isOpen: false, user: null });

    const fetchTeam = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_my_team');

        if (error) {
            console.error('Error fetching team:', error);
            setError('Erro ao carregar equipe.');
        } else {
            setTeam(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchTeam();
    }, [session]);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
        setError(null);
        setSuccess(null);

        try {
            // First check if user exists in auth (simplified check, usually requires admin)
            // Here we'll just try to add to user_roles via RPC or direct insert if policy allows
            // Assuming we have a way to map email to ID, or we just invite?
            // Since this is a custom simplified system, let's assume we use an RPC 'add_team_member' if it exists,
            // OR we just assume the user is already signed up and we are just linking them.
            // For now, let's use the 'invite_user_by_email' flow if available, or just alert.

            // Reverting to the logic that was likely there:
            // "O sistema atual não suporta convites por email diretamente nesta versão simplificada."
            // But let's try to look up the user by email if possible.

            const { data: users, error: searchError } = await supabase
                .from('user_roles') // This only finds EXISTING users in roles table. 
            // We actually need to find 'auth.users'. Client can't query auth.users directly usually.
            // Using a hypothetical RPC or assuming manual entry for now?
            // Let's use a simple placeholder alert as this feature might not be fully implemented.
            // However, the prompt implies "Minha Equipe" manages roles.

            alert('Funcionalidade de convite será implementada em breve. Peça para o usuário criar uma conta primeiro.');

        } catch (err: any) {
            setError(err.message);
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
            if (!data.success) throw new Error(data.message);

            alert(data.message);
            fetchTeam();
        } catch (error: any) {
            alert('Erro ao atualizar função: ' + error.message);
        }
    };

    const handleRemoveMember = async (userId: string, email: string) => {
        if (!confirm(`Remover acessos de ${email}?`)) return;

        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

        if (error) {
            alert('Erro ao remover: ' + error.message);
        } else {
            fetchTeam();
        }
    };

    if (loadingRole) return <div className="p-8 text-center text-gray-500">Carregando permissões...</div>;
    if (!isAdmin) return <div className="p-8 text-center text-gray-500"><AlertTriangle className="mx-auto mb-2" />Apenas administradores podem gerenciar a equipe.</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <UserPlus className="text-justice-600" />
                Gerenciar Equipe
            </h1>

            {/* List */}
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="font-semibold text-gray-700">Membros da Equipe</h2>
                    <span className="text-xs text-gray-500">{team.length} membros</span>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-gray-500">Carregando equipe...</div>
                ) : team.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum membro encontrado.</div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {team.map(member => (
                            <li key={member.user_id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="bg-justice-100 p-2 rounded-full text-justice-600">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-800">{member.email}</div>
                                        <div className="text-xs flex gap-2 mt-0.5 items-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${member.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {member.role}
                                            </span>

                                            {/* Role Selector (Disabled for self) */}
                                            {member.user_id !== session.user.id && (
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                                                    className="text-[10px] border-gray-300 rounded focus:ring-1 focus:ring-justice-200"
                                                >
                                                    <option value="server">Servidor</option>
                                                    <option value="restricted">Restrito</option>
                                                    <option value="readonly">Leitura</option>
                                                    <option value="admin">Administrador</option>
                                                </select>
                                            )}

                                            <button
                                                onClick={() => setPermissionModal({ isOpen: true, user: { id: member.user_id, email: member.email, permissions: member.permissions } })}
                                                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1 ml-2 transition-colors border border-gray-200"
                                            >
                                                <Shield size={10} /> Permissões
                                            </button>

                                            <span className="text-gray-400 ml-2">Entrou em {new Date(member.joined_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {member.user_id !== session.user.id && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveMember(member.user_id, member.email)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-all"
                                        title="Remover acesso"
                                    >
                                        <Trash size={18} />
                                    </Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {permissionModal.isOpen && permissionModal.user && (
                <PermissionModal
                    isOpen={permissionModal.isOpen}
                    onClose={() => setPermissionModal({ isOpen: false, user: null })}
                    targetUser={permissionModal.user}
                    onSuccess={fetchTeam}
                />
            )}
        </div>
    );
};
