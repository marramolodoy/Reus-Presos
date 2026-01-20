
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash, Download, FileText, CalendarDays, CheckCircle, Clock, RefreshCw, Gavel, Stethoscope } from 'lucide-react';
import { PendingSchedule, PendingScheduleFormData } from '../../types';
import { ScheduleForm } from './ScheduleForm';
import { ScheduleTrashModal } from './ScheduleTrashModal';
import { supabase } from '../../lib/supabase';
import { formatDate, calculateDaysDiff } from '../../utils';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SchedulesDashboardProps {
    session: any;
}

export const SchedulesDashboard: React.FC<SchedulesDashboardProps> = ({ session }) => {
    const [schedules, setSchedules] = useState<PendingSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [sortBy, setSortBy] = useState('created_desc');

    const [activeTab, setActiveTab] = useState<'hearing' | 'expertise'>('hearing');
    const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'all'>('pending');

    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => void; }>({
        isOpen: false, title: '', description: '', onConfirm: () => { }
    });

    const fetchSchedules = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('pending_schedules')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar:', error);
        } else {
            setSchedules(data.map((d: any) => ({
                id: d.id,
                processNumber: d.process_number,
                lastMovementDate: d.last_movement_date,
                subject: d.subject,
                obs: d.obs,
                type: d.type,
                hearingType: d.hearing_type,
                competence: d.competence,
                expertiseType: d.expertise_type,
                status: d.status,
                user_id: d.user_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchSchedules();
    }, [session]);

    const handleSave = async (data: PendingScheduleFormData) => {
        if (!session) return;
        const payload = {
            process_number: data.processNumber,
            last_movement_date: data.lastMovementDate,
            subject: data.subject,
            obs: data.obs,
            type: data.type,
            hearing_type: data.hearingType || null,
            competence: data.competence,
            expertise_type: data.expertiseType || null,
            status: 'pending',
            user_id: session.user.id
        };

        if (editingId) {
            const { error } = await supabase.from('pending_schedules').update(payload).eq('id', editingId);
            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            const { error } = await supabase.from('pending_schedules').insert([payload]);
            if (error) alert('Erro ao criar: ' + error.message);
        }
        await fetchSchedules();
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleToggleStatus = async (item: PendingSchedule) => {
        const newStatus = item.status === 'pending' ? 'resolved' : 'pending';
        const { error } = await supabase
            .from('pending_schedules')
            .update({ status: newStatus })
            .eq('id', item.id);

        if (error) alert('Erro ao atualizar status: ' + error.message);
        else await fetchSchedules();
    };

    const handleDeleteClick = (id: string, processNumber: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Designação',
            description: `Tem certeza que deseja mover o processo "${processNumber}" para a lixeira?`,
            onConfirm: async () => {
                const { error } = await supabase
                    .from('pending_schedules')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) alert('Erro ao excluir: ' + error.message);
                else await fetchSchedules();

                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const filteredSchedules = schedules.filter(i => {
        const matchesSearch = i.processNumber.includes(searchTerm) ||
            i.subject.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = i.type === activeTab;
        const matchesStatus = statusFilter === 'all' ? true : i.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
    });

    // Apply Sorting
    filteredSchedules.sort((a, b) => {
        switch (sortBy) {
            case 'created_desc':
                return 0; // Default order
            case 'movement_asc':
                return new Date(a.lastMovementDate).getTime() - new Date(b.lastMovementDate).getTime();
            case 'movement_desc':
                return new Date(b.lastMovementDate).getTime() - new Date(a.lastMovementDate).getTime();
            case 'process_asc':
                return a.processNumber.localeCompare(b.processNumber);
            case 'competence_asc':
                return a.competence.localeCompare(b.competence);
            default:
                return 0;
        }
    });

    const generatePDF = () => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const title = activeTab === 'hearing' ? 'Relatório de Audiências Pendentes' : 'Relatório de Perícias Pendentes';
            doc.setFontSize(14); doc.setTextColor(40); doc.text(title, 14, 15);
            doc.setFontSize(9); doc.setTextColor(100); doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 21);

            const rows = filteredSchedules.map(i => [
                i.processNumber,
                i.competence,
                formatDate(i.lastMovementDate),
                i.type === 'hearing' ? i.hearingType : i.expertiseType,
                i.subject,
                i.obs || '-',
                i.status === 'resolved' ? 'Resolvido' : 'Pendente'
            ]);

            autoTable(doc, {
                head: [["Processo", "Competência", "Últ. Mov.", "Tipo", "Assunto", "Obs", "Status"]],
                body: rows,
                startY: 25,
                styles: { fontSize: 8 },
                headStyles: { fillColor: activeTab === 'hearing' ? [22, 78, 99] : [147, 51, 234] }
            });
            doc.save(`designacoes_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
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

            <ScheduleTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                onRestore={fetchSchedules}
            />

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <ScheduleForm
                        initialData={editingId ? schedules.find(i => i.id === editingId) : undefined}
                        initialType={activeTab} // Pass current tab to pre-select type
                        onSubmit={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex overflow-x-auto space-x-4">
                <button onClick={() => setActiveTab('hearing')} className={`pb-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'hearing' ? 'border-cyan-700 text-cyan-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Gavel size={18} /> Audiências
                </button>
                <button onClick={() => setActiveTab('expertise')} className={`pb-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'expertise' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Stethoscope size={18} /> Perícias
                </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        {activeTab === 'hearing' ? 'Controle de Audiências' : 'Controle de Perícias'}
                    </h2>

                    <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
                        {/* Status Toggles */}
                        <div className="flex bg-white rounded-lg border p-1 shadow-sm mr-2">
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${statusFilter === 'pending' ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
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
                        <Button variant="outline-danger" onClick={() => setIsTrashOpen(true)} title="Lixeira">
                            <Trash size={18} />
                        </Button>

                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Pesquisar..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-200 outline-none"
                                value={searchTerm}
                            />
                        </div>

                        <div className="w-full md:w-auto">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className={`w-full md:w-auto p-2 border rounded-lg bg-white text-sm focus:ring-2 ${activeTab === 'hearing' ? 'focus:ring-cyan-200' : 'focus:ring-purple-200'} outline-none shadow-sm cursor-pointer`}
                            >
                                <option value="created_desc">Criação (Recente)</option>
                                <option value="movement_asc">Movimentação (Mais Antiga)</option>
                                <option value="movement_desc">Movimentação (Mais Recente)</option>
                                <option value="process_asc">Processo (A-Z)</option>
                                <option value="competence_asc">Competência</option>
                            </select>
                        </div>

                        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className={`shadow ${activeTab === 'hearing' ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-purple-600 hover:bg-purple-700'} text-white border-transparent`}>
                            {activeTab === 'hearing' ? 'Nova Audiência' : 'Nova Perícia'}
                        </Button>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Processo</th>
                                <th className="px-6 py-4">Competência</th>
                                <th className="px-6 py-4">Última Mov.</th>
                                <th className="px-6 py-4">Tipo {activeTab === 'hearing' ? 'Audiência' : 'Perícia'}</th>
                                <th className="px-6 py-4">Assunto/Obs</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                            ) : filteredSchedules.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                            ) : filteredSchedules.map(i => (
                                <tr key={i.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div
                                            className={`p-1.5 rounded-full w-fit ${i.status === 'resolved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-500'}`}
                                            title={i.status === 'resolved' ? 'Resolvido' : 'Pendente'}
                                        >
                                            {i.status === 'resolved' ? <CheckCircle size={20} className="fill-current" /> : <Clock size={20} />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-800">
                                        {i.processNumber}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium border border-gray-200 uppercase tracking-wide">
                                            {i.competence}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {formatDate(i.lastMovementDate)}
                                        <span className="text-xs text-gray-400 block">{calculateDaysDiff(i.lastMovementDate)} dias atrás</span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700 font-medium">
                                        {i.type === 'hearing' ? i.hearingType : i.expertiseType}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="font-medium text-gray-800 truncate" title={i.subject}>{i.subject}</div>
                                        <div className="text-xs text-gray-500 truncate" title={i.obs}>{i.obs || '-'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleToggleStatus(i)}
                                                className={i.status === 'resolved' ? "text-gray-400 hover:text-gray-600" : "text-green-600 hover:bg-green-100"}
                                                title={i.status === 'resolved' ? 'Reativar' : 'Concluir'}
                                            >
                                                {i.status === 'resolved' ? <RefreshCw size={16} /> : <CheckCircle size={16} />}
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => { setEditingId(i.id); setIsFormOpen(true); }} className="text-blue-600 hover:bg-blue-100"><Edit size={16} /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(i.id, i.processNumber)} className="text-red-600 hover:bg-red-100"><Trash size={16} /></Button>
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
