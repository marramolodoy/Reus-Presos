import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash, Download, FileText, CalendarDays, CheckCircle, Clock, RefreshCw, Gavel, Stethoscope, Calendar as CalendarIcon, List as ListIcon, Users, TrendingUp } from 'lucide-react';
import { PendingSchedule, PendingScheduleFormData } from '../../types';
import { ScheduleForm } from './ScheduleForm';
import { ScheduleTrashModal } from './ScheduleTrashModal';
import { ScheduleCalendar } from './ScheduleCalendar';
import { supabase } from '../../lib/supabase';
import { formatDate, calculateDaysDiff } from '../../utils';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useUserRole } from '../../hooks/useUserRole';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SchedulesDashboardProps {
    session: any;
}

export const SchedulesDashboard: React.FC<SchedulesDashboardProps> = ({ session }) => {
    const { checkPermission, teamOwnerId, isAdmin, unitId } = useUserRole(session);
    const hasEdit = checkPermission('schedules', 'edit');
    const hasAdmin = checkPermission('schedules', 'admin');
    const [schedules, setSchedules] = useState<PendingSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list'); // Restored viewMode

    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [sortBy, setSortBy] = useState('created_desc');

    const [activeTab, setActiveTab] = useState<'hearing' | 'expertise' | 'experts'>('hearing');
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
            setSchedules((data || []).map((d: any) => ({
                id: d.id,
                processNumber: d.process_number,
                lastMovementDate: d.last_movement_date,
                scheduledDate: d.scheduled_date,
                schedulingStatus: d.scheduling_status,
                completionStatus: d.completion_status,
                subject: d.subject,
                obs: d.obs,
                type: d.type,
                hearingType: d.hearing_type,
                competence: d.competence,
                expertiseType: d.expertise_type,
                expertName: d.expert_name,
                status: d.status,
                tags: d.tags,
                user_id: d.user_id,
                unit_id: d.unit_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchSchedules();
    }, [session, teamOwnerId]);

    const handleSave = async (data: PendingScheduleFormData) => {
        if (!session) return;
        setLoading(true);

        try {
            if (editingId) {
                // Ao atualizar, editamos apenas os campos necessários.
                // Evitamos sobrescrever unit_id/user_id para prevenir erros de RLS.
                const updatePayload = {
                    process_number: data.processNumber,
                    last_movement_date: data.lastMovementDate || null,
                    scheduled_date: data.scheduledDate || null,
                    scheduling_status: data.schedulingStatus || 'scheduled',
                    subject: data.subject,
                    obs: data.obs,
                    type: data.type,
                    hearing_type: data.hearingType || null,
                    competence: data.competence,
                    expertise_type: data.expertiseType || null,
                    expert_name: (data as any).expertName || null,
                    completion_status: data.completionStatus || 'pending',
                    tags: data.tags || []
                };

                const { error } = await supabase
                    .from('pending_schedules')
                    .update(updatePayload)
                    .eq('id', editingId);

                if (error) throw error;
            } else {
                // Ao inserir, definimos o unit_id e o user_id
                const insertPayload = {
                    process_number: data.processNumber,
                    last_movement_date: data.lastMovementDate || null,
                    scheduled_date: data.scheduledDate || null,
                    scheduling_status: data.schedulingStatus || 'scheduled',
                    subject: data.subject,
                    obs: data.obs,
                    type: data.type,
                    hearing_type: data.hearingType || null,
                    competence: data.competence,
                    expertise_type: data.expertiseType || null,
                    expert_name: (data as any).expertName || null,
                    status: 'pending',
                    completion_status: data.completionStatus || 'pending',
                    tags: data.tags || [],
                    user_id: teamOwnerId || session.user.id,
                    unit_id: unitId
                };

                const { error } = await supabase
                    .from('pending_schedules')
                    .insert([insertPayload]);

                if (error) throw error;
            }

            await fetchSchedules();
            setIsFormOpen(false);
            setEditingId(null);
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
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

    // Build expert rotation data from existing expertise entries
    const getExpertRotationData = () => {
        const expertises = schedules.filter(s => s.type === 'expertise' && s.expertName && s.expertName.trim() !== '');
        const expertMap = new Map<string, { name: string; specialty: string; total: number; active: number; resolved: number; lastDate: string | null; processes: string[] }>();

        expertises.forEach(exp => {
            const name = exp.expertName!.trim();
            const existing = expertMap.get(name);
            const isActive = ['pending'].includes(exp.status) && exp.completionStatus !== 'completed';
            const isResolved = exp.status === 'resolved' || exp.completionStatus === 'completed';

            if (existing) {
                existing.total += 1;
                if (isActive) existing.active += 1;
                if (isResolved) existing.resolved += 1;
                if (exp.scheduledDate && (!existing.lastDate || new Date(exp.scheduledDate) > new Date(existing.lastDate))) {
                    existing.lastDate = exp.scheduledDate;
                }
                if (!existing.specialty && exp.expertiseType) existing.specialty = exp.expertiseType;
                existing.processes.push(exp.processNumber);
            } else {
                expertMap.set(name, {
                    name,
                    specialty: exp.expertiseType || 'Não informada',
                    total: 1,
                    active: isActive ? 1 : 0,
                    resolved: isResolved ? 1 : 0,
                    lastDate: exp.scheduledDate || null,
                    processes: [exp.processNumber]
                });
            }
        });

        return Array.from(expertMap.values()).sort((a, b) => {
            // Sort: those without recent appointments go first (fair rotation)
            if (!a.lastDate && !b.lastDate) return 0;
            if (!a.lastDate) return -1;
            if (!b.lastDate) return 1;
            return new Date(a.lastDate).getTime() - new Date(b.lastDate).getTime();
        });
    };

    const filteredSchedules = schedules.filter(i => {
        const matchesSearch = i.processNumber.includes(searchTerm) ||
            i.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (i.expertName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = activeTab === 'experts' ? i.type === 'expertise' : i.type === activeTab;
        const matchesStatus = statusFilter === 'all' ? true : i.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
    });

    // Apply Sorting
    filteredSchedules.sort((a, b) => {
        switch (sortBy) {
            case 'created_desc':
                return 0; // Default order
            case 'movement_asc':
                return new Date(a.lastMovementDate || 0).getTime() - new Date(b.lastMovementDate || 0).getTime();
            case 'movement_desc':
                return new Date(b.lastMovementDate || 0).getTime() - new Date(a.lastMovementDate || 0).getTime();
            case 'scheduled_asc':
                return new Date(a.scheduledDate || 0).getTime() - new Date(b.scheduledDate || 0).getTime();
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
                i.scheduledDate ? new Date(i.scheduledDate).toLocaleString('pt-BR') : '-',
                formatDate(i.lastMovementDate || ''),
                i.type === 'hearing' ? i.hearingType : i.expertiseType,
                i.subject,
                i.obs || '-',
                i.status === 'resolved' ? 'Resolvido' : 'Pendente'
            ]);

            autoTable(doc, {
                head: [["Processo", "Competência", "Data Agend.", "Últ. Mov.", "Tipo", "Assunto", "Obs", "Status"]],
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
                <button onClick={() => setActiveTab('experts')} className={`pb-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'experts' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Users size={18} /> Peritos Nomeados
                </button>
            </div>

            <div className="flex-1 overflow-auto p-6">

                {activeTab !== 'experts' && (
                <>
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
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>


                        {/* View Mode Toggles */}
                        <div className="flex bg-gray-100 p-1 rounded-lg mr-2">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-gray-800' : 'text-gray-400 hover:text-gray-600'}`} title="Lista">
                                <ListIcon size={18} />
                            </button>
                            <button onClick={() => setViewMode('calendar')} className={`p-1.5 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="Calendário">
                                <CalendarIcon size={18} />
                            </button>
                        </div>

                        {viewMode === 'list' && (
                            <div className="w-full md:w-auto">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className={`w-full md:w-auto p-2 border rounded-lg bg-white text-sm focus:ring-2 ${activeTab === 'hearing' ? 'focus:ring-cyan-200' : 'focus:ring-purple-200'} outline-none shadow-sm cursor-pointer`}
                                >
                                    <option value="created_desc">Criação (Recente)</option>
                                    <option value="scheduled_asc">Data Agendada (Próximas)</option>
                                    <option value="movement_asc">Movimentação (Mais Antiga)</option>
                                    <option value="movement_desc">Movimentação (Mais Recente)</option>
                                    <option value="process_asc">Processo (A-Z)</option>
                                    <option value="competence_asc">Competência</option>
                                </select>
                            </div>
                        )}

                        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className={`shadow ${activeTab === 'hearing' ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-purple-600 hover:bg-purple-700'} text-white border-transparent`}>
                            {activeTab === 'hearing' ? 'Nova Audiência' : 'Nova Perícia'}
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {viewMode === 'list' ? (
                        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden flex-1 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                                    <tr>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Processo</th>
                                        <th className="px-6 py-4">Competência</th>
                                        <th className="px-6 py-4">Data Agendada</th>
                                        <th className="px-6 py-4">Última Mov.</th>
                                        <th className="px-6 py-4">Tipo {activeTab === 'hearing' ? 'Audiência' : 'Perícia'}</th>
                                        <th className="px-6 py-4">Assunto/Obs</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={8} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                                    ) : filteredSchedules.length === 0 ? (
                                        <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                                    ) : filteredSchedules.map(i => (
                                        <tr key={i.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2">
                                                    <div
                                                        className={`p-1.5 rounded-full w-fit ${i.status === 'resolved' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                                                        title={i.status === 'resolved' ? 'Arquivado/Resolvido' : 'Ativo'}
                                                    >
                                                        {i.status === 'resolved' ? <CheckCircle size={20} className="fill-current" /> : <Clock size={20} />}
                                                    </div>
                                                    <div
                                                        className={`w-3 h-8 rounded-full ${i.completionStatus === 'completed' ? 'bg-green-500' :
                                                            i.completionStatus === 'partial' ? 'bg-orange-400' :
                                                                'bg-red-500'
                                                            }`}
                                                        title={i.completionStatus === 'completed' ? 'Cumprida' : i.completionStatus === 'partial' ? 'Parcialmente Cumprida' : 'Não Cumprida'}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-gray-800">{i.processNumber}</div>
                                                {i.tags && i.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {i.tags.map(tag => (
                                                            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-600 border border-red-200">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded-md bg-gray-100 text-xs font-medium border border-gray-200 uppercase tracking-wide">
                                                    {i.competence}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {i.schedulingStatus === 'to_be_scheduled' ? (
                                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-full">A Designar</span>
                                                ) : i.scheduledDate ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-800">{new Date(i.scheduledDate).toLocaleDateString('pt-BR')}</span>
                                                        <span className="text-xs text-gray-500">{new Date(i.scheduledDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {i.lastMovementDate ? (
                                                    <>
                                                        {formatDate(i.lastMovementDate)}
                                                        <span className="text-xs text-gray-400 block">{calculateDaysDiff(i.lastMovementDate)} dias atrás</span>
                                                    </>
                                                ) : '-'}
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
                                                        title={i.status === 'resolved' ? 'Reativar' : 'Arquivar'}
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
                    ) : (
                        <div className="flex-1 overflow-hidden">
                            <ScheduleCalendar
                                schedules={filteredSchedules}
                                onItemClick={(item) => { setEditingId(item.id); setIsFormOpen(true); }}
                                currentTab={activeTab as 'hearing' | 'expertise'}
                                session={session}
                            />
                        </div>
                    )}
                </div>
                </>
                )}

                {/* EXPERTS TAB - Rotation & Report */}
                {activeTab === 'experts' && (
                    <div className="flex flex-col gap-6">
                        {/* Expert Tab Header */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <TrendingUp size={20} /> Painel de Rotatividade de Peritos
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">Dados extraídos automaticamente das perícias cadastradas. Preencha o campo "Nome do Perito" ao cadastrar uma perícia para alimentar este painel.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        try {
                                            const rotData = getExpertRotationData();
                                            const doc = new jsPDF('p', 'mm', 'a4');
                                            doc.setFontSize(14); doc.setTextColor(40);
                                            doc.text('Relatório de Peritos Nomeados - Corregedoria', 14, 15);
                                            doc.setFontSize(9); doc.setTextColor(100);
                                            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 21);
                                            doc.text(`Total de peritos: ${rotData.length}`, 14, 26);

                                            const rows = rotData.map(e => [
                                                e.name,
                                                e.specialty,
                                                String(e.total),
                                                String(e.active),
                                                String(e.resolved),
                                                e.lastDate ? new Date(e.lastDate).toLocaleDateString('pt-BR') : 'Sem data',
                                                e.processes.join(', ')
                                            ]);

                                            autoTable(doc, {
                                                head: [['Perito', 'Especialidade', 'Total', 'Ativas', 'Concluídas', 'Última Nomeação', 'Processos']],
                                                body: rows,
                                                startY: 30,
                                                styles: { fontSize: 8 },
                                                headStyles: { fillColor: [180, 83, 9] },
                                                columnStyles: { 6: { cellWidth: 50 } }
                                            });
                                            doc.save(`relatorio_peritos_corregedoria_${new Date().toISOString().split('T')[0]}.pdf`);
                                        } catch (e) { alert(e); }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition shadow-sm text-sm"
                                >
                                    <Download size={16} /> PDF
                                </button>
                                <button
                                    onClick={() => {
                                        const rotData = getExpertRotationData();
                                        let csv = "data:text/csv;charset=utf-8,";
                                        csv += "Perito,Especialidade,Total Nomeações,Ativas,Concluídas,Última Nomeação,Processos\n";
                                        rotData.forEach(e => {
                                            csv += `"${e.name}","${e.specialty}",${e.total},${e.active},${e.resolved},"${e.lastDate ? new Date(e.lastDate).toLocaleDateString('pt-BR') : 'Nunca'}","${e.processes.join('; ')}"\n`;
                                        });
                                        const link = document.createElement("a");
                                        link.setAttribute("href", encodeURI(csv));
                                        link.setAttribute("download", `relatorio_peritos_corregedoria_${new Date().toLocaleDateString('pt-BR')}.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 font-medium rounded-lg hover:bg-amber-50 transition shadow-sm text-sm border border-amber-300"
                                >
                                    <Download size={16} /> CSV
                                </button>
                            </div>
                        </div>

                        {/* Rotation Cards */}
                        {loading ? (
                            <div className="flex justify-center items-center h-48">
                                <div className="h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                {getExpertRotationData().length === 0 ? (
                                    <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                                        <Stethoscope size={48} className="mx-auto mb-4 text-gray-300" />
                                        <h3 className="font-bold text-gray-600 text-lg">Nenhum perito encontrado</h3>
                                        <p className="text-gray-400 mt-2 max-w-md mx-auto">
                                            Para alimentar este painel, preencha o campo <strong>"Nome do Perito Nomeado"</strong> ao registrar uma nova perícia na aba <strong>"Perícias"</strong>. Os dados aparecerão aqui automaticamente.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {getExpertRotationData().map((expert, idx) => (
                                            <div key={expert.name} className="bg-white rounded-xl p-5 border shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                                                {/* Rotation Badge */}
                                                {idx === 0 && expert.active === 0 && (
                                                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                                                        Vez na Rotação
                                                    </div>
                                                )}

                                                <div className="mb-3">
                                                    <h3 className="font-bold text-gray-800 text-lg">{expert.name}</h3>
                                                    <p className="text-sm text-purple-600 font-medium">{expert.specialty}</p>
                                                </div>

                                                <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Última Nomeação:</span>
                                                        <span className="font-semibold text-gray-800">{expert.lastDate ? new Date(expert.lastDate).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Perícias Ativas:</span>
                                                        <span className="font-semibold">
                                                            {expert.active > 0 ? (
                                                                <span className="text-orange-600">{expert.active} pendente{expert.active > 1 ? 's' : ''}</span>
                                                            ) : (
                                                                <span className="text-green-600">Livre</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">Concluídas:</span>
                                                        <span className="font-semibold text-green-700">{expert.resolved}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t">
                                                        <span className="text-gray-500">Total Histórico:</span>
                                                        <span className="font-bold text-gray-800">{expert.total}</span>
                                                    </div>
                                                </div>

                                                {/* Process list */}
                                                <div className="mt-3">
                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Processos:</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {expert.processes.slice(0, 3).map(p => (
                                                            <span key={p} className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{p}</span>
                                                        ))}
                                                        {expert.processes.length > 3 && (
                                                            <span className="text-[10px] text-gray-400 font-medium">+{expert.processes.length - 3} mais</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>

    );
};
