
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash, Download, FileText, User, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { CriticalIssue, CriticalIssueFormData } from '../../types';
import { CriticalIssueForm } from './CriticalIssueForm';
import { CriticalIssueTrashModal } from './CriticalIssueTrashModal';
import { supabase } from '../../lib/supabase';
import { formatDate, calculateDaysDiff } from '../../utils';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useUserRole } from '../../hooks/useUserRole';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CriticalIssuesDashboardProps {
    session: any;
}

export const CriticalIssuesDashboard: React.FC<CriticalIssuesDashboardProps> = ({ session }) => {
    const { checkPermission, teamOwnerId, isAdmin } = useUserRole(session);
    const hasEdit = checkPermission('critical_issues', 'edit');
    const hasAdmin = checkPermission('critical_issues', 'admin');
    const [issues, setIssues] = useState<CriticalIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [sortBy, setSortBy] = useState('created_desc');

    // Filters
    const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'all'>('pending');

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => void; }>({
        isOpen: false, title: '', description: '', onConfirm: () => { }
    });

    const fetchIssues = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('critical_issues')
            .select('*')
            .is('deleted_at', null)
            .eq('user_id', teamOwnerId || session.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar:', error);
            // alert('Erro ao carregar dados: ' + error.message);
        } else {
            setIssues(data.map((d: any) => ({
                id: d.id,
                processNumber: d.process_number,
                defendantName: d.defendant_name,
                lastMovementDate: d.last_movement_date,
                reason: d.reason,
                responsibleServer: d.responsible_server,
                status: d.status,
                user_id: d.user_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchIssues();
    }, [session]);

    const handleSave = async (data: CriticalIssueFormData) => {
        if (!session) return;
        const payload = {
            process_number: data.processNumber,
            defendant_name: data.defendantName,
            last_movement_date: data.lastMovementDate,
            reason: data.reason,
            responsible_server: data.responsibleServer,
            status: 'pending', // Default status
            user_id: teamOwnerId || session.user.id
        };

        if (editingId) {
            const { error } = await supabase.from('critical_issues').update(payload).eq('id', editingId);
            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            const { error } = await supabase.from('critical_issues').insert([payload]);
            if (error) alert('Erro ao criar: ' + error.message);
        }
        await fetchIssues();
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleToggleStatus = async (issue: CriticalIssue) => {
        const newStatus = issue.status === 'pending' ? 'resolved' : 'pending';
        const { error } = await supabase
            .from('critical_issues')
            .update({ status: newStatus })
            .eq('id', issue.id);

        if (error) alert('Erro ao atualizar status: ' + error.message);
        else await fetchIssues();
    };

    const handleDeleteClick = (id: string, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Pendência',
            description: `Tem certeza que deseja mover a pendência do processo "${name}" para a lixeira?`,
            onConfirm: async () => {
                const { error } = await supabase
                    .from('critical_issues')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) alert('Erro ao excluir: ' + error.message);
                else await fetchIssues();

                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const filteredIssues = issues.filter(i => {
        const matchesSearch = (i.defendantName?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
            i.processNumber.includes(searchTerm) ||
            i.responsibleServer.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' ? true : i.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Apply Sorting
    filteredIssues.sort((a, b) => {
        switch (sortBy) {
            case 'created_desc':
                // Assuming IDs are roughly chronological or we rely on default Order from DB. 
                // Ideally we'd valid created_at, but we don't have it in frontend type perfectly mapped sometimes.
                // Let's fallback to string comparison of ID or if we had date.
                // Actually supabase query was .order('created_at').
                // Let's rely on array order if "created_desc" (default).
                return 0;
            case 'movement_asc': // Antiga -> Recente
                return new Date(a.lastMovementDate).getTime() - new Date(b.lastMovementDate).getTime();
            case 'movement_desc': // Recente -> Antiga
                return new Date(b.lastMovementDate).getTime() - new Date(a.lastMovementDate).getTime();
            case 'process_asc':
                return a.processNumber.localeCompare(b.processNumber);
            case 'defendant_asc':
                return (a.defendantName || '').localeCompare(b.defendantName || '');
            default:
                return 0;
        }
    });

    const generatePDF = () => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFontSize(14); doc.setTextColor(40); doc.text(`Relatório de Pendências Críticas`, 14, 15);
            doc.setFontSize(9); doc.setTextColor(100); doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 21);

            const rows = filteredIssues.map(i => [
                i.processNumber,
                i.defendantName || '-',
                formatDate(i.lastMovementDate),
                i.reason,
                i.responsibleServer,
                i.status === 'resolved' ? 'Resolvido' : 'Pendente'
            ]);

            autoTable(doc, {
                head: [["Processo", "Réu", "Últ. Mov.", "Motivo", "Responsável", "Status"]],
                body: rows,
                startY: 25,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [220, 38, 38] } // Red header
            });
            doc.save(`pendencias_criticas_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) { alert(e); }
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

            <CriticalIssueTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                onRestore={fetchIssues}
            />

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <CriticalIssueForm
                        initialData={editingId ? issues.find(i => i.id === editingId) : undefined}
                        onSubmit={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                    />
                </div>
            )}

            <div className="flex-1 overflow-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="text-red-600" />
                        Pendências Críticas
                    </h2>

                    <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                        {/* Status Toggles */}
                        <div className="flex bg-white rounded-lg border p-1 shadow-sm mr-2">
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${statusFilter === 'pending' ? 'bg-red-100 text-red-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Clock size={16} /> Pendentes
                            </button>
                            <button
                                onClick={() => setStatusFilter('resolved')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${statusFilter === 'resolved' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <CheckCircle size={16} /> Resolvidos
                            </button>
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${statusFilter === 'all' ? 'bg-gray-200 text-gray-800 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                Todos
                            </button>
                        </div>

                        <Button variant="outline" onClick={generatePDF} leftIcon={Download}>PDF</Button>
                        {hasAdmin && (
                            <Button variant="outline-danger" onClick={() => setIsTrashOpen(true)} title="Lixeira">
                                <Trash size={18} />
                            </Button>
                        )}

                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Pesquisar..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-200 outline-none"
                                value={searchTerm}
                            />
                        </div>

                        <div className="w-full md:w-auto">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full md:w-auto p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-red-200 outline-none shadow-sm cursor-pointer"
                            >
                                <option value="created_desc">Criação (Recente)</option>
                                <option value="movement_asc">Movimentação (Mais Antiga)</option>
                                <option value="movement_desc">Movimentação (Mais Recente)</option>
                                <option value="process_asc">Processo (A-Z)</option>
                                <option value="defendant_asc">Réu (A-Z)</option>
                            </select>
                        </div>

                        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className="shadow bg-red-600 hover:bg-red-700 text-white border-transparent">
                            Nova Pendência
                        </Button>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Processo / Réu</th>
                                <th className="px-6 py-4">Última Mov.</th>
                                <th className="px-6 py-4">Motivo (Pendência)</th>
                                <th className="px-6 py-4">Responsável</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                            ) : filteredIssues.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma pendência encontrada.</td></tr>
                            ) : filteredIssues.map(i => (
                                <tr key={i.id} className="hover:bg-red-50/10 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div
                                            className={`p-1.5 rounded-full w-fit ${i.status === 'resolved' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}
                                            title={i.status === 'resolved' ? 'Resolvido' : 'Pendente'}
                                        >
                                            {i.status === 'resolved' ? <CheckCircle size={20} className="fill-current" /> : <AlertTriangle size={20} />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-800">{i.processNumber}</div>
                                        <div className="text-xs text-gray-500">{i.defendantName || 'Réu não informado'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {formatDate(i.lastMovementDate)}
                                        <span className="text-xs text-gray-400 block">{calculateDaysDiff(i.lastMovementDate)} dias atrás</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700 font-medium">
                                        {i.reason}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md w-fit font-medium text-xs">
                                            <User size={12} /> {i.responsibleServer}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleToggleStatus(i)}
                                                className={i.status === 'resolved' ? "text-gray-400 hover:text-gray-600" : "text-green-600 hover:bg-green-100"}
                                                title={i.status === 'resolved' ? 'Reativar Pendência' : 'Marcar como Resolvido'}
                                            >
                                                {i.status === 'resolved' ? <RefreshCw size={16} /> : <CheckCircle size={16} />}
                                            </Button>
                                            {hasEdit && (
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingId(i.id); setIsFormOpen(true); }} className="text-blue-600 hover:bg-blue-100"><Edit size={16} /></Button>
                                            )}
                                            {hasAdmin && (
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(i.id, i.processNumber)} className="text-red-600 hover:bg-red-100"><Trash size={16} /></Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
