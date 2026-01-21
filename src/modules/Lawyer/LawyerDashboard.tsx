import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash, Download, FileText, ArchiveRestore, CheckCircle, Clock } from 'lucide-react';
import { LawyerRequest, LawyerRequestFormData } from '../../types';
import { LawyerForm } from './LawyerForm';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../utils';
import { LawyerTrashModal } from './LawyerTrashModal';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LawyerDashboardProps {
    session: any;
}

export const LawyerDashboard: React.FC<LawyerDashboardProps> = ({ session }) => {
    const [requests, setRequests] = useState<LawyerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [showConcluded, setShowConcluded] = useState(false); // Toggle to show concluded items
    const [sortBy, setSortBy] = useState('date_desc');

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => void; }>({
        isOpen: false, title: '', description: '', onConfirm: () => { }
    });

    // Fetch Requests
    const fetchRequests = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('lawyer_requests')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar dados:', error);
            // Fallback empty if table doesn't exist yet
            setRequests([]);
        } else {
            setRequests(data.map((d: any) => ({
                id: d.id,
                name: d.name,
                caseNumber: d.case_number,
                contactMethod: d.contact_method,
                matter: d.matter,
                requestDate: d.request_date,
                isConcluded: d.is_concluded,
                concludedAt: d.concluded_at,
                obs: d.obs,
                user_id: d.user_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, [session]);

    // Create / Update
    const handleSave = async (data: LawyerRequestFormData) => {
        if (!session) return;

        // Map frontend camelCase to DB snake_case
        const payload = {
            name: data.name,
            case_number: data.caseNumber,
            contact_method: data.contactMethod,
            matter: data.matter,
            request_date: data.requestDate,
            is_concluded: data.isConcluded,
            concluded_at: data.isConcluded && !data.concludedAt ? new Date().toISOString() : (data.isConcluded ? data.concludedAt : null),
            obs: data.obs,
            user_id: session.user.id
        };

        if (editingId) {
            const { error } = await supabase.from('lawyer_requests').update(payload).eq('id', editingId);
            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            const { error } = await supabase.from('lawyer_requests').insert([payload]);
            if (error) alert('Erro ao criar: ' + error.message);
        }
        await fetchRequests();
        setIsFormOpen(false);
        setEditingId(null);
    };

    // Soft Delete
    const handleDeleteClick = (id: string, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Requerimento',
            description: `Tem certeza que deseja processar a exclusão de "${name}"?`,
            onConfirm: async () => {
                const { error } = await supabase
                    .from('lawyer_requests')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) alert('Erro: ' + error.message);
                else await fetchRequests();

                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // Toggle Conclusion
    const handleToggleConclusion = async (req: LawyerRequest) => {
        const newStatus = !req.isConcluded;
        const { error } = await supabase
            .from('lawyer_requests')
            .update({
                is_concluded: newStatus,
                concluded_at: newStatus ? new Date().toISOString() : null
            })
            .eq('id', req.id);

        if (error) alert('Erro ao atualizar status: ' + error.message);
        else await fetchRequests();
    };

    // Filters
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesSearch = req.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (req.caseNumber && req.caseNumber.includes(searchTerm));

            // If showConcluded is false, show ONLY pending.
            // If showConcluded is true, show ALL (pending + concluded) or maybe just concluded?
            // Usually "Archived" toggle implies showing them.
            // Requirement: "Acrescente também a funcionalidade de marcar que o pedido foi concluído (e crie um contabilizador que permita filtrar a quantidade de pedidos concluídos)"
            // I'll interpret this as a filter.

            if (showConcluded) return matchesSearch && req.isConcluded;
            return matchesSearch && !req.isConcluded;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'date_desc') return new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
            if (sortBy === 'date_asc') return new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime();
            if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
            if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
            return 0;
        });
    }, [requests, searchTerm, showConcluded, sortBy]);

    const stats = useMemo(() => {
        const total = requests.length;
        const concluded = requests.filter(r => r.isConcluded).length;
        const pending = total - concluded;
        return { total, concluded, pending };
    }, [requests]);

    // PDF Generation
    const generatePDF = () => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const dateStr = new Date().toLocaleDateString('pt-BR');
            const title = `Relatório de Requerimentos - ${showConcluded ? 'Concluídos' : 'Pendentes'}`;

            doc.setFontSize(14);
            doc.text(title, 14, 15);
            doc.setFontSize(10);
            doc.text(`Gerado em: ${dateStr}`, 14, 22);

            const rows = filteredRequests.map(req => [
                req.name,
                req.caseNumber || '-',
                formatDate(req.requestDate),
                req.contactMethod,
                req.matter,
                req.obs || ''
            ]);

            autoTable(doc, {
                head: [['Nome / Advogado', 'Processo', 'Data', 'Contato', 'Matéria', 'Obs']],
                body: rows,
                startY: 25,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [41, 128, 185] }
            });

            doc.save(`requerimentos_${showConcluded ? 'concluidos' : 'pendentes'}.pdf`);
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            alert('Erro ao gerar PDF');
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <LawyerForm
                        initialData={editingId ? requests.find(r => r.id === editingId) : undefined}
                        onSubmit={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                    />
                </div>
            )}

            <LawyerTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                session={session}
                onRestore={fetchRequests}
            />

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                description={confirmModal.description}
            />

            <div className="flex-1 overflow-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                        Requerimentos de Advogados
                    </h2>

                    <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                        {/* Status Filter / Counter */}
                        <div className="flex bg-white rounded-lg border p-1 shadow-sm mr-2">
                            <button
                                onClick={() => setShowConcluded(false)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${!showConcluded ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <Clock size={16} /> Pendentes ({stats.pending})
                            </button>
                            <button
                                onClick={() => setShowConcluded(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${showConcluded ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                <CheckCircle size={16} /> Concluídos ({stats.concluded})
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={generatePDF} leftIcon={Download} title="Gerar PDF">
                                <span className="hidden md:inline">PDF</span>
                            </Button>
                            <Button variant="outline-danger" onClick={() => setIsTrashOpen(true)} title="Lixeira">
                                <ArchiveRestore size={18} />
                            </Button>
                        </div>

                        <div className="relative md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Pesquisar..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none shadow-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="md:w-auto">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full md:w-auto p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm cursor-pointer"
                            >
                                <option value="date_desc">Data (Mais Recente)</option>
                                <option value="date_asc">Data (Mais Antiga)</option>
                                <option value="name_asc">Nome (A-Z)</option>
                                <option value="name_desc">Nome (Z-A)</option>
                            </select>
                        </div>

                        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className="shadow-sm">
                            Novo
                        </Button>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Advogado / Parte / Processo</th>
                                <th className="px-6 py-4">Data Pedido</th>
                                <th className="px-6 py-4">Canal / Matéria</th>
                                <th className="px-6 py-4">Obs</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Carregando dados...</td></tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum requerimento encontrado.</td></tr>
                            ) : filteredRequests.map(req => (
                                <tr key={req.id} className={`hover:bg-gray-50 transition-colors group ${req.isConcluded ? 'bg-gray-50/50' : ''}`}>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleToggleConclusion(req)}
                                            className={`p-1.5 rounded-full transition-colors ${req.isConcluded ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            title={req.isConcluded ? 'Reabrir Pedido' : 'Concluir Pedido'}
                                        >
                                            <CheckCircle size={20} className={req.isConcluded ? 'fill-current' : ''} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{req.name}</div>
                                        {req.caseNumber && <div className="text-xs text-gray-500 font-mono mt-0.5">{req.caseNumber}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {formatDate(req.requestDate)}
                                        {req.isConcluded && req.concludedAt && (
                                            <div className="text-[10px] text-green-600 mt-1">Concluído em: {formatDate(req.concludedAt)}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100">{req.contactMethod}</span>
                                            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs border border-purple-100">{req.matter}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 max-w-[250px] truncate" title={req.obs}>{req.obs || '-'}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleToggleConclusion(req)}
                                                className={`p-1 rounded ${req.isConcluded ? 'text-yellow-600 hover:bg-yellow-100' : 'text-green-600 hover:bg-green-100'}`}
                                                title={req.isConcluded ? 'Reabrir' : 'Concluir'}
                                            >
                                                {req.isConcluded ? <Clock size={16} /> : <CheckCircle size={16} />}
                                            </button>
                                            <button onClick={() => { setEditingId(req.id); setIsFormOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Editar"><Edit size={16} /></button>
                                            <button onClick={() => handleDeleteClick(req.id, req.name)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir"><Trash size={16} /></button>
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
