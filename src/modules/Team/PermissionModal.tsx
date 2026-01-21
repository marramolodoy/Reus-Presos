import React, { useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUser: { id: string; email: string; permissions: any };
    onSuccess: () => void;
}

const MODULES = [
    { key: 'criminal', label: 'Criminal' },
    { key: 'civil', label: 'Cível & Menores' },
    { key: 'lawyer_requests', label: 'Req. Advogados' },
    { key: 'sticky_notes', label: 'Mural de Avisos' },
    { key: 'administrative', label: 'Administrativo' },
    { key: 'rogatory', label: 'Cartas Precatórias' },
    { key: 'schedules', label: 'Audiências & Perícias' },
    { key: 'critical_issues', label: 'Pendências Críticas' },
];

const LEVELS = [
    { value: 'none', label: '🔴 Sem Acesso' },
    { value: 'view', label: '👁️ Apenas Visualizar' },
    { value: 'edit', label: '✏️ Visualizar e Editar' },
    { value: 'admin', label: '🛡️ Administrador' },
];

export const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose, targetUser, onSuccess }) => {
    const [permissions, setPermissions] = useState<Record<string, string>>(targetUser.permissions || {});
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleChange = (moduleKey: string, value: string) => {
        setPermissions(prev => ({ ...prev, [moduleKey]: value }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('update_user_permissions', {
                target_user_id: targetUser.id,
                new_permissions: permissions
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            alert('Permissões atualizadas com sucesso!');
            onSuccess();
            onClose();
        } catch (error: any) {
            alert('Erro ao salvar permissões: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Gerenciar Permissões</h2>
                        <p className="text-sm text-gray-500">{targetUser.email}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        {MODULES.map((module) => (
                            <div key={module.key} className="bg-gray-50 p-4 rounded-lg flex flex-col gap-2">
                                <label className="font-medium text-gray-700">{module.label}</label>
                                <select
                                    value={permissions[module.key] || 'none'}
                                    onChange={(e) => handleChange(module.key, e.target.value)}
                                    className="p-2 bg-white border rounded-md text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                >
                                    {LEVELS.map(level => (
                                        <option key={level.value} value={level.value}>{level.label}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loading ? 'Salvando...' : 'Salvar Permissões'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
