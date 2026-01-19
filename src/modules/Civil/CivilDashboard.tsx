import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Edit, Trash, Download, FileText, ArchiveRestore, CheckCircle, Clock, User } from 'lucide-react';
import { CivilCase, CivilCaseFormData } from '../../types';
import { CivilForm } from './CivilForm';
import { supabase } from '../../lib/supabase';
import { formatDate, calculateDaysDiff, calculateDaysUntil } from '../../utils';
import { CivilExportModal, CivilExportConfig } from '../../components/CivilExportModal';
import { CivilTrashModal } from './CivilTrashModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CivilDashboardProps {
    session: any;
}

import { CIVIL_CATEGORIES } from '../../constants';

const CATEGORIES = CIVIL_CATEGORIES;

export const CivilDashboard: React.FC<CivilDashboardProps> = ({ session }) => {
    const [cases, setCases] = useState<CivilCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>('Urgentes');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [sortBy, setSortBy] = useState('entry_desc');
    const [showConcluded, setShowConcluded] = useState(false);

    const fetchCases = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('civil_cases')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            alert('Erro ao carregar dados: ' + error.message);
        } else {
            setCases(data.map((d: any) => ({
                id: d.id,
                name: d.name,
                caseNumber: d.case_number,
                category: d.category,
                entryDate: d.entry_date,
                lastMovementDate: d.last_movement_date,
                lastReevaluationDate: d.last_reevaluation_date,
                deadlineDate: d.deadline_date,
                obs: d.obs,
                isDelegated: d.is_delegated,
                expeditionStatus: d.expedition_status,
                isConcluded: d.is_concluded,
                concludedAt: d.concluded_at,
                responsibleServer: d.responsible_server,
                user_id: d.user_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchCases();
    }, [session]);

    const handleSave = async (data: CivilCaseFormData) => {
        if (!session) return;
        const payload = {
            name: data.name,
            case_number: data.caseNumber,
            category: data.category,
            entry_date: data.entryDate || null,
            last_movement_date: data.lastMovementDate || null,
            last_reevaluation_date: data.lastReevaluationDate || null,
            deadline_date: data.deadlineDate || null,
            obs: data.obs,
            is_delegated: data.isDelegated,
            expedition_status: data.expeditionStatus,
            is_concluded: data.isConcluded,
            concluded_at: data.concludedAt,
            responsible_server: data.responsibleServer,
            user_id: session.user.id
        };

        if (editingId) {
            const { error } = await supabase.from('civil_cases').update(payload).eq('id', editingId);
            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            const { error } = await supabase.from('civil_cases').insert([payload]);
            if (error) alert('Erro ao criar: ' + error.message);
        }
        await fetchCases();
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Mover para lixeira?')) {
            const { error } = await supabase
                .from('civil_cases')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);

            if (error) alert('Erro: ' + error.message);
            else await fetchCases();
        }
    };

    const handleToggleConclusion = async (c: CivilCase) => {
        const newStatus = !c.isConcluded;
        const { error } = await supabase
            .from('civil_cases')
            .update({
                is_concluded: newStatus,
                concluded_at: newStatus ? new Date().toISOString() : null
            })
            .eq('id', c.id);

        if (error) alert('Erro ao atualizar status: ' + error.message);
        else await fetchCases();
    };

    const stats = useMemo(() => {
        const categoryCases = cases.filter(c => c.category === activeCategory);
        const total = categoryCases.length;
        const concluded = categoryCases.filter(c => c.isConcluded).length;
        const pending = total - concluded;
        return { total, concluded, pending };
    }, [cases, activeCategory]);

    const filteredCases = useMemo(() => {
        const filtered = cases.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.caseNumber.includes(searchTerm);
            const matchesCategory = c.category === activeCategory;

            // Filter by showConcluded logic
            // If showConcluded is true -> show ONLY concluded? Or show ALL? 
            // In Lawyer tab, I made it filter either pending OR concluded. 
            // "permitir filtrar a quantidade de pedidos concluídos"
            if (showConcluded) {
                return matchesSearch && matchesCategory && c.isConcluded;
            } else {
                return matchesSearch && matchesCategory && !c.isConcluded;
            }
        });

        return filtered.sort((a, b) => {
            const dateA = a.entryDate ? new Date(a.entryDate).getTime() : 0;
            const dateB = b.entryDate ? new Date(b.entryDate).getTime() : 0;

            switch (sortBy) {
                case 'entry_desc':
                    return dateB - dateA;
                case 'entry_asc':
                    return dateA - dateB;
                case 'deadline_asc':
                    // Put valid deadlines first, then nulls
                    const deadlineA = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Number.MAX_VALUE;
                    const deadlineB = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Number.MAX_VALUE;
                    return deadlineA - deadlineB;
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'case_number_asc':
                    return a.caseNumber.localeCompare(b.caseNumber);
                default:
                    return 0;
            }
        });
    }, [cases, activeCategory, searchTerm, sortBy, showConcluded]);

    const generatePDF = (dataToExport: CivilCase[], title: string) => {
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const dateStr = new Date().toLocaleDateString('pt-BR');

            doc.setFontSize(10);
            doc.text(title, 14, 15);
            doc.text(dateStr, 185, 15);

            const rows = dataToExport.map(c => [
                c.name,
                c.caseNumber || '',
                c.category === 'Advogados' ? 'Req. Adv' : c.category,
                formatDate(c.entryDate),
                c.deadlineDate ? `${formatDate(c.deadlineDate)}` : '-',
                c.obs || ''
            ]);

            autoTable(doc, {
                head: [['Nome / Parte', 'Processo', 'Categoria', 'Entrada', 'Prazo', 'Obs']],
                body: rows,
                startY: 20,
                styles: { fontSize: 8 },
                headStyles: { fillColor: [66, 66, 66] }
            });

            doc.save(`relatorio_civil_${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            alert('Erro ao gerar PDF');
        }
    };

    const handleGeneralPDF = () => setIsExportModalOpen(true);

    const generateFullPDF = (config: CivilExportConfig) => {
        let sortedCases = [...cases].filter(c => config.selectedCategories.includes(c.category));

        if (config.sortBy === 'name') {
            sortedCases.sort((a, b) => a.name.localeCompare(b.name));
        } else if (config.sortBy === 'category') {
            sortedCases.sort((a, b) => a.category.localeCompare(b.category));
        } else if (config.sortBy === 'date') {
            sortedCases.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
        }

        generatePDF(sortedCases, 'Relatório Geral - Controle Cível');
        setIsExportModalOpen(false);
    };

    const getCategoryDisplay = (cat: string) => {
        switch (cat) {
            case 'Advogados': return 'Requerimentos Advogados';
            case 'Acolhidos': return 'Menores Acolhidos';
            case 'Apreendidos': return 'Menores Apreendidos';
            case 'Infracionais': return 'Atos Infracionais';
            default: return cat;
        }
    };

    const handleCurrentPDF = () => generatePDF(filteredCases, `Relatório - ${getCategoryDisplay(activeCategory)}`);

    return (
        <div className="h-full flex flex-col bg-gray-50">
            <CivilExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onExport={generateFullPDF}
            />

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <CivilForm
                        initialData={editingId ? cases.find(c => c.id === editingId) : undefined}
                        defaultCategory={activeCategory}
                        onSubmit={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex overflow-x-auto space-x-2 shadow-sm">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`text-sm px-3 py-2 rounded-full whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-justice-700 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {cat === 'Advogados' ? 'Req. Adv' : cat}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-justice-500 rounded-full"></span>
                        Controle: {getCategoryDisplay(activeCategory)}
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

                        <div className="flex gap-2 mr-2">
                            <button onClick={handleGeneralPDF} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2 border border-gray-300 transition-colors" title="PDF Geral (Todos)">
                                <FileText size={18} /> <span className="hidden md:inline">PDF Geral</span>
                            </button>
                            <button onClick={handleCurrentPDF} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 flex items-center gap-2 border border-gray-300 transition-colors" title="PDF Atual (Filtrado)">
                                <Download size={18} /> <span className="hidden md:inline">PDF Atual</span>
                            </button>
                            <button onClick={() => setIsTrashOpen(true)} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 flex items-center gap-2 border border-red-200 transition-colors" title="Lixeira">
                                <ArchiveRestore size={18} />
                            </button>
                        </div>
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Pesquisar..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-justice-200 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="w-full md:w-auto">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full md:w-auto p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-justice-200 outline-none shadow-sm cursor-pointer"
                            >
                                <option value="entry_desc">Entrada (Mais Recente)</option>
                                <option value="entry_asc">Entrada (Mais Antiga)</option>
                                <option value="deadline_asc">Prazo (Mais Próximo)</option>
                                <option value="name_asc">Nome (A-Z)</option>
                                <option value="case_number_asc">Processo</option>
                            </select>
                        </div>
                        <button onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="bg-justice-600 text-white px-4 py-2 rounded-lg hover:bg-justice-700 flex items-center gap-2 shadow">
                            <Plus size={18} /> Novo
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Nome / Parte</th>
                                <th className="px-6 py-4">Processo / Servidor</th>
                                <th className="px-6 py-4">Entrada</th>
                                <th className="px-6 py-4">Última Mov.</th>
                                <th className="px-6 py-4">Prazo / Limite</th>
                                <th className="px-6 py-4">Obs</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Carregando processos...</td></tr>
                            ) : filteredCases.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhum processo encontrado nesta categoria.</td></tr>
                            ) : filteredCases.map(c => {
                                const daysLeft = c.deadlineDate ? calculateDaysUntil(c.deadlineDate) : null;
                                const isExpired = daysLeft !== null && daysLeft < 0;
                                const isNear = daysLeft !== null && daysLeft >= 0 && daysLeft <= 15;

                                return (
                                    <tr key={c.id} className={`hover:bg-blue-50/30 transition-colors group ${c.isConcluded ? 'bg-gray-50/80' : ''}`}>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleToggleConclusion(c)}
                                                className={`p-1.5 rounded-full transition-colors ${c.isConcluded ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                title={c.isConcluded ? 'Reabrir Processo' : 'Concluir Processo'}
                                            >
                                                <CheckCircle size={20} className={c.isConcluded ? 'fill-current' : ''} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="font-mono text-sm">{c.caseNumber}</div>
                                            {c.responsibleServer && (
                                                <div className="text-xs text-indigo-600 flex items-center gap-1 mt-1 font-medium bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                                                    <User size={10} /> {c.responsibleServer}
                                                </div>
                                            )}
                                            {c.isDelegated && <span className="ml-2 px-1.5 py-0.5 text-[0.65rem] bg-indigo-100 text-indigo-700 rounded border border-indigo-200 uppercase font-bold tracking-wider">E-Prec</span>}
                                            {(c.category === 'RPV' || c.category === 'Precatório') && (
                                                <span className={`block w-fit mt-1 px-1.5 py-0.5 text-[0.65rem] rounded border uppercase font-bold tracking-wider ${c.expeditionStatus === 'dispatched' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                                                    {c.expeditionStatus === 'dispatched' ? 'Expedido' : 'Pendente'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {formatDate(c.entryDate)}
                                            <span className="text-xs text-gray-400 block">{calculateDaysDiff(c.entryDate)} dias atrás</span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {c.lastMovementDate ? (
                                                <>
                                                    {formatDate(c.lastMovementDate)}
                                                    <span className="text-xs text-gray-400 block">{calculateDaysDiff(c.lastMovementDate)} dias atrás</span>
                                                </>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.category === 'Acolhidos' && c.lastReevaluationDate ? (
                                                (() => {
                                                    const daysSince = calculateDaysDiff(c.lastReevaluationDate);
                                                    const isOverdue = daysSince > 90;
                                                    return (
                                                        <div className={`flex flex-col ${isOverdue ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                            <span>{formatDate(c.lastReevaluationDate)}</span>
                                                            <span className="text-xs">{isOverdue ? `Venceu há ${daysSince - 90} dias` : `Em dia (${daysSince} dias)`}</span>
                                                        </div>
                                                    );
                                                })()
                                            ) : c.deadlineDate ? (
                                                <div className={`flex flex-col ${isExpired ? 'text-red-600 font-bold' : isNear ? 'text-orange-500 font-bold' : 'text-green-600'}`}>
                                                    <span>{formatDate(c.deadlineDate)}</span>
                                                    <span className="text-xs">{isExpired ? `Venceu há ${Math.abs(daysLeft!)} dias` : `Vence em ${daysLeft} dias`}</span>
                                                </div>
                                            ) : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={c.obs}>{c.obs || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => { setEditingId(c.id); setIsFormOpen(true); }} className="p-1 text-blue-600 hover:bg-blue-100 rounded"><Edit size={16} /></button>
                                                <button onClick={() => handleDelete(c.id)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <CivilTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                session={session}
                onRestore={fetchCases}
            />
        </div>
    );
};
