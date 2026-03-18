import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SuspendedCase, SuspendedCaseFormData } from '../../types';
import { useUserRole } from '../../hooks/useUserRole';
import { Button } from '../../components/ui/Button';
import { Plus, Edit, Trash, AlertTriangle, CheckCircle, Clock, X, Save } from 'lucide-react';
import { formatDate } from '../../utils';

interface SuspendedCasesDashboardProps {
    session: any;
}

export const SuspendedCasesDashboard: React.FC<SuspendedCasesDashboardProps> = ({ session }) => {
    const { checkPermission, teamOwnerId, isAdmin, unitId } = useUserRole(session);
    const hasEdit = checkPermission('criminal', 'edit');
    const [cases, setCases] = useState<SuspendedCase[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<SuspendedCaseFormData>({
        name: '', case_number: '', penal_type: '', suspension_date: '', prescription_date: '', obs: ''
    });

    const fetchCases = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('suspended_cases')
            .select('*')
            .is('deleted_at', null)
            .order('prescription_date', { ascending: true });
        
        if (error) {
            console.error(error);
            alert('Erro ao buscar casos suspensos.');
        } else {
            setCases(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchCases();
    }, [session, teamOwnerId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session?.user) return;
        
        try {
            if (editingId) {
                const { error } = await supabase.from('suspended_cases').update(formData).eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('suspended_cases').insert([{
                    ...formData,
                    user_id: teamOwnerId || session.user.id,
                    unit_id: unitId
                }]);
                if (error) throw error;
            }
            await fetchCases();
            setIsFormOpen(false);
            setEditingId(null);
            setFormData({ name: '', case_number: '', penal_type: '', suspension_date: '', prescription_date: '', obs: '' });
        } catch (error: any) {
            alert('Erro ao salvar: ' + error.message);
        }
    };

    const handleEdit = (c: SuspendedCase) => {
        setFormData({
            name: c.name, case_number: c.case_number, penal_type: c.penal_type, 
            suspension_date: c.suspension_date, prescription_date: c.prescription_date, obs: c.obs || ''
        });
        setEditingId(c.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja arquivar este processo?')) return;
        const { error } = await supabase.from('suspended_cases').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchCases();
    };

    const getPrescriptionStatus = (dateStr: string) => {
        if (!dateStr) return { text: 'Sem data', color: 'text-gray-500', icon: <Clock size={16} /> };
        const d = new Date(dateStr + 'T12:00:00Z');
        const today = new Date();
        const diffTime = d.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) return { text: 'Prescrito', color: 'text-red-600 bg-red-50', icon: <AlertTriangle size={16} /> };
        if (diffDays <= 180) return { text: `Alerta (${diffDays} dias)`, color: 'text-orange-600 bg-orange-50', icon: <AlertTriangle size={16} /> };
        return { text: `Em Prazo (${Math.floor(diffDays/365)}a)`, color: 'text-green-600 bg-green-50', icon: <CheckCircle size={16} /> };
    };

    return (
        <div className="p-4 md:p-6 fade-in h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Processos Suspensos (Art. 366 CPP)</h2>
                    <p className="text-sm text-gray-500">Controle de prescrição para réus não encontrados</p>
                </div>
                {hasEdit && (
                    <Button onClick={() => { setEditingId(null); setFormData({ name: '', case_number: '', penal_type: '', suspension_date: '', prescription_date: '', obs: '' }); setIsFormOpen(true); }} leftIcon={Plus}>
                        Novo Registro
                    </Button>
                )}
            </div>

            {isFormOpen && (
                <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-md mb-6 border border-gray-200">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-bold text-lg">{editingId ? 'Editar Processo Suspenso' : 'Novo Processo Suspenso'}</h3>
                        <button type="button" onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nome do Réu *</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Número do Processo</label>
                            <input type="text" value={formData.case_number} onChange={e => setFormData(p => ({...p, case_number: e.target.value}))} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo Penal / Artigo</label>
                            <input type="text" value={formData.penal_type} onChange={e => setFormData(p => ({...p, penal_type: e.target.value}))} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Data da Suspensão</label>
                            <input required type="date" value={formData.suspension_date} onChange={e => setFormData(p => ({...p, suspension_date: e.target.value}))} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-red-600 mb-1">Data que Prescreve (Calculada)</label>
                            <input required type="date" value={formData.prescription_date} onChange={e => setFormData(p => ({...p, prescription_date: e.target.value}))} className="w-full border rounded p-2 text-sm border-red-200 bg-red-50" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Novo Endereço / Observações</label>
                            <input type="text" value={formData.obs} onChange={e => setFormData(p => ({...p, obs: e.target.value}))} className="w-full border rounded p-2 text-sm" />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                        <Button variant="primary" type="submit" leftIcon={Save}>Salvar</Button>
                    </div>
                </form>
            )}

            <div className="bg-white rounded shadow overflow-x-auto flex-1">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Réu / Processo</th>
                            <th className="px-4 py-3">Suspensão (Art 366)</th>
                            <th className="px-4 py-3">Data Prescrição</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Obs/Endereços encontrados</th>
                            <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? <tr><td colSpan={6} className="p-4 text-center text-gray-500">Carregando...</td></tr> : 
                        cases.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-gray-500">Nenhum processo suspenso registrado. Use a Calculadora Prescricional para adicionar ou clique em Novo Registro.</td></tr> :
                        cases.map(c => {
                            const status = getPrescriptionStatus(c.prescription_date);
                            return (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-bold whitespace-nowrap">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.case_number}</div>
                                        <span className="text-[10px] bg-gray-100 px-1 rounded">{c.penal_type}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.suspension_date)}</td>
                                    <td className="px-4 py-3 font-bold whitespace-nowrap">{formatDate(c.prescription_date)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-transparent ${status.color}`}>
                                            {status.icon} {status.text}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{c.obs || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                        {(hasEdit || isAdmin) && (
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit size={16} className="text-blue-600"/></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash size={16} className="text-red-600"/></Button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
