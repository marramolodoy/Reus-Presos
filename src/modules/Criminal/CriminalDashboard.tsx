import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    AlertOctagon,
    Clock,
    Plus,
    Search,
    FileText,
    Calendar,
    Download,
    Link as LinkIcon,
    CalendarDays,
    Edit,
    Trash,
    MoreHorizontal
} from 'lucide-react';
import { Defendant, DefendantFormData, DashboardStats } from '../../types';
import { DefendantForm } from '../../components/DefendantForm';
import { DashboardCharts } from '../../components/DashboardCharts';
import { RecycleBinModal } from '../../components/RecycleBinModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { Button } from '../../components/ui/Button';
import { calculateDaysDiff, calculateDaysUntil, formatDate, getStatusColor, THRESHOLD_IMPRISONMENT, THRESHOLD_REVIEW } from '../../utils';

import { ExportModal, ExportConfig } from '../../components/ExportModal';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CriminalDashboardProps {
    session: any;
    courtName: string;
}

export const CriminalDashboard: React.FC<CriminalDashboardProps> = ({ session, courtName }) => {
    const { checkPermission, teamOwnerId, isAdmin } = useUserRole(session);
    const hasEdit = checkPermission('criminal', 'edit');
    const hasAdmin = checkPermission('criminal', 'admin');
    const [defendants, setDefendants] = useState<Defendant[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: () => void; }>({
        isOpen: false, title: '', description: '', onConfirm: () => { }
    });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState<'preventive' | 'home_arrest' | 'provisional_definitive' | 'civil' | 'dashboard'>('preventive');

    // Sorting
    type SortOption = 'no_review_asc' | 'imprisonment_asc' | 'no_movement_asc' | 'name_asc';
    const [sortBy, setSortBy] = useState<SortOption>('no_review_asc');

    // Data Fetching
    const fetchDefendants = async () => {
        if (!session) return;
        setLoadingData(true);
        const { data, error } = await supabase
            .from('defendants')
            .select('*')
            .is('deleted_at', null)

            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar:', error);
            alert('Erro ao carregar dados: ' + error.message);
        } else {
            setDefendants((data || []).map((d: any) => ({
                id: d.id, name: d.name, caseNumber: d.case_number, penalType: d.penal_type,
                prisonType: d.prison_type || 'Preventiva',
                arrestDate: d.arrest_date, lastReviewDate: d.last_review_date,
                movementType: d.movement_type, lastMovementDate: d.last_movement_date,
                deadline: d.deadline, obs: d.obs, rji: d.rji, bnmp: d.bnmp, infopen: d.infopen,
                prison: d.prison, user_id: d.user_id,
                hasHearing: d.has_hearing, hearingDate: d.hearing_date, linkedDefendantIds: d.linked_defendant_ids
            })));
        }
        setLoadingData(false);
    };

    useEffect(() => {
        if (session) fetchDefendants();
    }, [session, teamOwnerId]);

    const handleSave = async (data: DefendantFormData) => {
        if (!session || !session.user) return;
        const payload = {
            name: data.name, case_number: data.caseNumber, penal_type: data.penalType,
            prison_type: data.prisonType,
            arrest_date: data.arrestDate, last_review_date: data.lastReviewDate,
            movement_type: data.movementType, last_movement_date: data.lastMovementDate,
            deadline: data.deadline, obs: data.obs, rji: data.rji, bnmp: data.bnmp,
            infopen: data.infopen, prison: data.prison, user_id: teamOwnerId || session.user.id,
            has_hearing: data.hasHearing, hearing_date: data.hearingDate || null, linked_defendant_ids: data.linkedDefendantIds
        };

        if (editingId) {
            const { error } = await supabase.from('defendants').update(payload).eq('id', editingId);
            if (error) { alert('Erro ao atualizar: ' + error.message); return; }
        } else {
            const { error } = await supabase.from('defendants').insert([payload]);
            if (error) { alert('Erro ao criar: ' + error.message); return; }
        }
        await fetchDefendants();
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleEdit = (defendant: Defendant) => {
        setEditingId(defendant.id);
        setIsFormOpen(true);
    };

    const handleDeleteClick = (id: string, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Excluir Réu',
            description: `Tem certeza que deseja mover "${name}" para a lixeira?`,
            onConfirm: async () => {
                const { error } = await supabase
                    .from('defendants')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', id);

                if (error) alert('Erro ao excluir: ' + error.message);
                else await fetchDefendants();

                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // ... (rest of component) ...

    const filteredDefendants = defendants.filter(d => {
        const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.caseNumber.includes(searchTerm);
        let matchesTab = true;
        if (activeTab === 'preventive') {
            matchesTab = d.prisonType === 'Preventiva' || d.prisonType === 'Temporária' || !d.prisonType;
        } else if (activeTab === 'home_arrest') matchesTab = d.prisonType === 'Domiciliar';
        else if (activeTab === 'provisional_definitive') matchesTab = d.prisonType === 'Provisória' || d.prisonType === 'Definitiva';
        else if (activeTab === 'civil') matchesTab = d.prisonType === 'Cível';
        return matchesSearch && matchesTab;
    });

    const sortedDefendants = useMemo(() => {
        const sorted = [...filteredDefendants];
        return sorted.sort((a, b) => {
            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                // "Sem revisão (+ tempo)": Oldest review date first (longest time since review)
                case 'no_review_asc': return new Date(a.lastReviewDate).getTime() - new Date(b.lastReviewDate).getTime();
                // "Tempo Preso (+ tempo)": Oldest arrest date first (longest time in prison)
                case 'imprisonment_asc': return new Date(a.arrestDate).getTime() - new Date(b.arrestDate).getTime();
                // "sem movimentação (+ tempo)": Oldest movement date first (longest time stalled)
                case 'no_movement_asc': return new Date(a.lastMovementDate).getTime() - new Date(b.lastMovementDate).getTime();
                default: return 0;
            }
        });
    }, [filteredDefendants, sortBy]);

    const stats: DashboardStats = useMemo(() => {
        let expiredReviews = 0; let longImprisonment = 0; let stalledCases = 0;
        filteredDefendants.forEach(d => {
            if (calculateDaysDiff(d.lastReviewDate) > THRESHOLD_REVIEW) expiredReviews++;
            if (calculateDaysDiff(d.arrestDate) > THRESHOLD_IMPRISONMENT) longImprisonment++;
            if (calculateDaysDiff(d.lastMovementDate) > d.deadline) stalledCases++;
        });
        return { total: filteredDefendants.length, expiredReviews, longImprisonment, stalledCases };
    }, [filteredDefendants]);

    const exportToCSV = () => { /* Simplified for brevity, assume similar implementation */
        alert("Use o botão PDF Geral para relatórios completos."); // Keeping logic simple for now or copy fully? 
        // I will implement fully below to avoid user regression.
        try {
            const headers = ['Nome', 'Processo', 'Tipo Penal', 'Prisão', 'Tipo Prisão', 'Revisão', 'Movimentação', 'Data Mov.', 'Prazo', 'Presídio', 'Tem Audiência?', 'Data Audiência', 'OBS'];
            const rows = sortedDefendants.map(d => [d.name, d.caseNumber, d.penalType, formatDate(d.arrestDate), d.prisonType, formatDate(d.lastReviewDate), d.movementType, formatDate(d.lastMovementDate), d.deadline, d.prison, d.hasHearing ? 'Sim' : 'Não', d.hearingDate ? new Date(d.hearingDate).toLocaleString('pt-BR') : '-', d.obs || '']);
            const csvContent = [headers.join(';'), ...rows.map(row => row.map(f => String(f || '').includes(';') ? `"${f}"` : f).join(';'))].join('\n');
            const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }));
            link.download = `relatorio_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        } catch (e) { console.error(e); }
    };

    const generateFullPDF = (config: ExportConfig) => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFontSize(14); doc.setTextColor(40); doc.text(`Relatório Geral - ${courtName}`, 14, 15);
            doc.setFontSize(9); doc.setTextColor(100); doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 21);

            let list = defendants.filter(d => config.selectedTypes.includes(d.prisonType || 'Preventiva'));
            list.sort((a, b) => config.sortBy === 'name' ? a.name.localeCompare(b.name) : config.sortBy === 'prison_type' ? (a.prisonType || '').localeCompare(b.prisonType || '') : (a.prison || '').localeCompare(b.prison || ''));

            const rows = list.map(d => [d.name, d.caseNumber, `${d.penalType}\n(${d.prisonType})`, `${formatDate(d.arrestDate)}\n(${calculateDaysDiff(d.arrestDate)}d)`, `${formatDate(d.lastReviewDate)}\n(${calculateDaysDiff(d.lastReviewDate)}d)`, d.movementType, `${d.deadline}d`, `${d.prison}\n${d.rji ? `RJI:${d.rji}` : ''}`, d.obs]);
            autoTable(doc, { head: [["Nome", "Processo", "Tipo/Reg.", "Prisão", "Revisão", "Mov.", "Prz", "Local", "Obs"]], body: rows, startY: 25, styles: { fontSize: 7, overflow: 'linebreak' }, headStyles: { fillColor: [40, 40, 40] } });
            doc.save(`relatorio_geral_${new Date().toISOString().split('T')[0]}.pdf`);
            setIsExportModalOpen(false);
        } catch (e) { alert(e); }
    };

    const generatePDF = () => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFontSize(14); doc.setTextColor(40); doc.text(`Relatório - ${activeTab}`, 14, 15);
            const rows = filteredDefendants.map(d => [
                d.name,
                `${d.caseNumber}\n${d.rji ? `RJI: ${d.rji}` : ''}\n${d.infopen ? `INFOPEN: ${d.infopen}` : ''}`,
                `${d.penalType}\n(${d.prisonType})`,
                formatDate(d.arrestDate),
                formatDate(d.lastReviewDate),
                d.movementType,
                d.deadline,
                d.prison,
                d.obs
            ]);
            autoTable(doc, { head: [["Nome", "Processo", "Tipo", "Prisão", "Rev.", "Mov.", "Prz", "Local", "Obs"]], body: rows, startY: 25, styles: { fontSize: 7 } });
            doc.save(`relatorio_${activeTab}.pdf`);
        } catch (e) { console.error(e); }
    };

    return (
        <div className="h-full flex flex-col">
            {/* EXPORT MODAL */}
            <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={generateFullPDF} />

            {/* CONFIRMATION MODAL */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                description={confirmModal.description}
            />

            {/* HISTORY / RECYCLE BIN */}
            <RecycleBinModal isOpen={isRecycleBinOpen} onClose={() => setIsRecycleBinOpen(false)} onRestore={fetchDefendants} />

            {/* FORM MODAL (FIXED - Component handles its own modal structure) */}
            {isFormOpen && (
                <DefendantForm
                    initialData={editingId ? defendants.find(d => d.id === editingId) : undefined}
                    defendants={defendants}
                    onSubmit={handleSave}
                    onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                />
            )}

            {/* Internal Tabs (Sub-navigation for Criminal) */}
            <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-2 flex overflow-x-auto space-x-4">
                <button onClick={() => setActiveTab('preventive')} className={`pb-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'preventive' ? 'border-justice-600 text-justice-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Preventivos</button>
                <button onClick={() => setActiveTab('home_arrest')} className={`pb-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'home_arrest' ? 'border-justice-600 text-justice-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Domiciliar</button>
                <button onClick={() => setActiveTab('provisional_definitive')} className={`pb-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'provisional_definitive' ? 'border-justice-600 text-justice-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Prov./Definitivo</button>
                <button onClick={() => setActiveTab('civil')} className={`pb-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'civil' ? 'border-justice-600 text-justice-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Cíveis</button>
                <button onClick={() => setActiveTab('dashboard')} className={`pb-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'dashboard' ? 'border-justice-600 text-justice-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Painel Gráfico</button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 p-4 md:p-6">
                {activeTab === 'dashboard' ? (
                    <DashboardCharts defendants={defendants} />
                ) : (
                    <div className="fade-in">
                        {/* Header Stats & Tools */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Controle de Processos</h2>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                {hasAdmin && (
                                    <Button variant="outline-danger" onClick={() => setIsRecycleBinOpen(true)} title="Lixeira">
                                        <Trash size={18} />
                                    </Button>
                                )}
                                <Button variant="outline" onClick={exportToCSV} leftIcon={Download}>CSV</Button>
                                <Button variant="outline-primary" onClick={() => setIsExportModalOpen(true)} leftIcon={Download}>PDF Geral</Button>
                                <Button variant="outline" onClick={generatePDF} leftIcon={FileText}>PDF Atual</Button>
                                {hasEdit && (
                                    <Button variant="primary" onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className="w-full md:w-auto">Novo Réu</Button>
                                )}
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white p-4 rounded shadow border-l-4 border-justice-500">
                                <p className="text-xs font-bold text-gray-500 uppercase">Total</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                            <div className={`bg-white p-4 rounded shadow border-l-4 ${stats.expiredReviews > 0 ? 'border-red-500' : 'border-green-500'}`}>
                                <p className="text-xs font-bold text-gray-500 uppercase">Revisão Vencida</p>
                                <p className={`text-2xl font-bold ${stats.expiredReviews > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.expiredReviews}</p>
                            </div>
                            <div className="bg-white p-4 rounded shadow border-l-4 border-orange-400">
                                <p className="text-xs font-bold text-gray-500 uppercase">Prisão Longa</p>
                                <p className="text-2xl font-bold">{stats.longImprisonment}</p>
                            </div>
                            <div className="bg-white p-4 rounded shadow border-l-4 border-yellow-400">
                                <p className="text-xs font-bold text-gray-500 uppercase">Paralisados</p>
                                <p className="text-2xl font-bold">{stats.stalledCases}</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="bg-white p-2 rounded shadow mb-6 flex flex-col md:flex-row gap-2">
                            <div className="flex-1 flex items-center bg-gray-50 px-2 rounded">
                                <Search size={20} className="text-gray-400" />
                                <input type="text" placeholder="Pesquisar..." className="w-full bg-transparent p-2 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="p-2 border rounded bg-gray-50 text-sm">
                                <option value="no_review_asc">Sem revisão (+ tempo)</option>
                                <option value="imprisonment_asc">Tempo Preso (+ tempo)</option>
                                <option value="no_movement_asc">sem movimentação (+ tempo)</option>
                                <option value="name_asc">Nome (A-Z)</option>
                            </select>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded shadow overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3">Réu / Processo</th>
                                        <th className="px-4 py-3">Audiência</th>
                                        <th className="px-4 py-3">Prisão</th>
                                        <th className="px-4 py-3">Revisão</th>
                                        <th className="px-4 py-3">Movimentação</th>
                                        <th className="px-4 py-3">Local</th>
                                        <th className="px-4 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loadingData ? <tr><td colSpan={7} className="p-4 text-center">Carregando...</td></tr> : sortedDefendants.map(d => (
                                        <tr key={d.id} className="hover:bg-gray-50 group">
                                            <td className="px-4 py-3">
                                                <div className="font-bold flex items-center gap-1">{d.name} {d.linkedDefendantIds?.length ? <LinkIcon size={12} className="text-blue-500" /> : null}</div>
                                                <div className="text-xs text-gray-500">{d.caseNumber}</div>
                                                <span className="text-[10px] bg-gray-100 px-1 rounded">{d.penalType}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {d.hearingDate ? <div className={calculateDaysUntil(d.hearingDate) > 0 ? 'text-green-600' : 'text-red-500'}>{new Date(d.hearingDate).toLocaleDateString('pt-BR')}</div> : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{calculateDaysDiff(d.arrestDate)} dias</div>
                                                <div className="text-xs text-gray-400">{formatDate(d.arrestDate)}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={calculateDaysDiff(d.lastReviewDate) > THRESHOLD_REVIEW ? 'text-red-600 font-bold' : ''}>{calculateDaysDiff(d.lastReviewDate)} dias atrás</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{d.movementType}</div>
                                                <div className={`text-xs ${calculateDaysDiff(d.lastMovementDate) > d.deadline ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{formatDate(d.lastMovementDate)} ({calculateDaysDiff(d.lastMovementDate)} dias)</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div>{d.prison}</div>
                                                {d.rji && <div className="text-[10px] text-gray-400">RJI: {d.rji}</div>}
                                                {d.infopen && <div className="text-[10px] text-gray-400">INFOPEN: {d.infopen}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2 relative z-10">
                                                    {(hasAdmin || hasEdit) && (
                                                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(d); }} title="Editar">
                                                            <Edit size={16} className="text-blue-600" />
                                                        </Button>
                                                    )}

                                                    {(hasAdmin || hasEdit) && (
                                                        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(d.id, d.name); }} title="Excluir">
                                                            <Trash size={16} className="text-red-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
