import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash, Download, Calendar, User, FileText } from 'lucide-react';
import { ProductivityLog, ProductivityLogFormData } from '../../types';
import { ProductivityForm } from './ProductivityForm';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../utils';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useUserRole } from '../../hooks/useUserRole';

interface ProductivityDashboardProps {
    session: any;
}

export const ProductivityDashboard: React.FC<ProductivityDashboardProps> = ({ session }) => {
    const { checkPermission, teamOwnerId, unitId } = useUserRole(session);
    const hasEdit = checkPermission('productivity', 'edit');
    const hasAdmin = checkPermission('productivity', 'admin');

    const [logs, setLogs] = useState<ProductivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => void; }>({
        isOpen: false, title: '', description: '', onConfirm: () => { }
    });

    const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

    const fetchLogs = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('productivity_logs')
            .select('*')
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (error) {
            alert('Erro ao carregar dados: ' + error.message);
        } else {
            setLogs((data || []).map((d: any) => ({
                id: d.id,
                date: d.date,
                processNumbers: d.process_numbers,
                activities: d.activities,
                user_id: d.user_id,
                unit_id: d.unit_id,
                created_at: d.created_at,
                deleted_at: d.deleted_at
            })));
        }
        setLoading(false);
    };

    const fetchUserProfiles = async () => {
        const { data, error } = await supabase.from('user_profiles').select('user_id, name');
        if (!error && data) {
            const profiles: Record<string, string> = {};
            data.forEach((p: any) => {
                profiles[p.user_id] = p.name;
            });
            setUserProfiles(profiles);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchUserProfiles();
    }, [session, teamOwnerId]);

    const handleSave = async (data: ProductivityLogFormData) => {
        if (!session) return;
        const commonData = {
            date: data.date,
            process_numbers: data.processNumbers,
            activities: data.activities
        };

        if (editingId) {
            const { error } = await supabase.from('productivity_logs').update(commonData).eq('id', editingId);
            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            const { error } = await supabase.from('productivity_logs').insert([{
                ...commonData,
                user_id: session.user.id,
                unit_id: unitId
            }]);
            if (error) alert('Erro ao criar: ' + error.message);
        }
        await fetchLogs();
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleDeleteClick = (id: string, date: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Registro',
            description: `Tem certeza que deseja excluir o registro de produtividade do dia ${formatDate(date)}?`,
            onConfirm: async () => {
                const { error } = await supabase
                    .from('productivity_logs')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) alert('Erro: ' + error.message);
                else await fetchLogs();

                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = log.activities.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.processNumbers && log.processNumbers.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesDate = !dateFilter || log.date === dateFilter;
            return matchesSearch && matchesDate;
        });
    }, [logs, searchTerm, dateFilter]);

    const generatePDF = () => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const dateStr = new Date().toLocaleDateString('pt-BR');

            doc.setFontSize(14);
            doc.text('Relatório de Produtividade dos Servidores', 14, 15);
            doc.setFontSize(10);
            doc.text(`Gerado em: ${dateStr}`, 14, 22);

            const rows = filteredLogs.map(log => [
                formatDate(log.date),
                userProfiles[log.user_id] || '---',
                log.processNumbers || '-',
                log.activities
            ]);

            autoTable(doc, {
                head: [['Data', 'Servidor', 'Processos', 'Atividades']],
                body: rows,
                startY: 30,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [45, 55, 72] }
            });

            doc.save(`produtividade_${new Date().getTime()}.pdf`);
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            alert('Erro ao gerar PDF');
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                description={confirmModal.description}
            />

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <ProductivityForm
                        initialData={editingId ? logs.find(l => l.id === editingId) : undefined}
                        onSubmit={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                    />
                </div>
            )}

            <div className="flex-1 overflow-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <div className="w-2 h-8 bg-justice-600 rounded-full"></div>
                        Controle de Produtividade
                    </h2>
                    <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                        <div className="flex gap-2 mr-2">
                            <Button variant="secondary" onClick={generatePDF} leftIcon={Download}>
                                <span className="hidden md:inline">Exportar PDF</span>
                            </Button>
                        </div>

                        <div className="relative w-full md:w-48">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="date"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-justice-200 outline-none shadow-sm"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                            />
                        </div>

                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Pesquisar atividades ou processos..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-justice-200 outline-none shadow-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {hasEdit && (
                            <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className="shadow-lg">
                                Registrar Trabalho
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm">Carregando dados...</div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border-2 border-dashed">
                            <FileText size={48} className="mx-auto mb-4 text-gray-200" />
                            Nenhum registro de produtividade encontrado.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Servidor</th>
                                        <th className="px-6 py-4">Processos</th>
                                        <th className="px-6 py-4">Resumo das Atividades</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-900">{formatDate(log.date)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-justice-100 text-justice-700 flex items-center justify-center text-xs font-bold">
                                                        {(userProfiles[log.user_id] || '---').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-gray-700">{userProfiles[log.user_id] || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-blue-600 max-w-xs truncate" title={log.processNumbers}>
                                                {log.processNumbers || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 max-w-md truncate" title={log.activities}>
                                                {log.activities}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {(session.user.id === log.user_id || hasAdmin) && (
                                                        <>
                                                            <Button variant="ghost" size="icon" onClick={() => { setEditingId(log.id); setIsFormOpen(true); }} className="text-blue-600 hover:bg-blue-100" title="Editar">
                                                                <Edit size={16} />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(log.id, log.date)} className="text-red-600 hover:bg-red-100" title="Excluir">
                                                                <Trash size={16} />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
