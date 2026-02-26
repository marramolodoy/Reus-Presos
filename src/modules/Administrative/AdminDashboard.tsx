import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AdministrativeDocument, SeiRequest } from '../../types';

import { useUserRole } from '../../hooks/useUserRole';
import { Plus, Search, FileText, Download, Trash2, Filter, Edit, ArchiveRestore, Clock, Copy, AlertTriangle } from 'lucide-react';
import { AdminForm } from './AdminForm';
import { AdminExportModal } from './AdminExportModal';
import { AdminTrashModal } from './AdminTrashModal';
import { AdminDeleteModal } from './AdminDeleteModal';
import { SeiRequestForm } from './SeiRequestForm';
import { SeiReminderModal } from './SeiReminderModal';
import { SeiExportModal } from './SeiExportModal';

export const AdminDashboard: React.FC<{ session: any }> = ({ session }) => {
    // Shared State
    const [activeTab, setActiveTab] = useState<'docs' | 'sei'>('docs');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const { checkPermission, teamOwnerId, isAdmin } = useUserRole(session);
    const hasEdit = checkPermission('administrative', 'edit');
    const hasAdmin = checkPermission('administrative', 'admin');
    // Docs State
    const [docs, setDocs] = useState<AdministrativeDocument[]>([]);
    const [isDocFormOpen, setIsDocFormOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'All' | 'Secretaria' | 'Gabinete'>('All');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [editingDoc, setEditingDoc] = useState<AdministrativeDocument | undefined>(undefined);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [deleteData, setDeleteData] = useState<{ isOpen: boolean, doc: AdministrativeDocument | null }>({ isOpen: false, doc: null });

    // SEI State
    const [seiRequests, setSeiRequests] = useState<SeiRequest[]>([]);
    const [isSeiFormOpen, setIsSeiFormOpen] = useState(false);
    const [editingSei, setEditingSei] = useState<SeiRequest | undefined>(undefined);
    const [reminderData, setReminderData] = useState<{ isOpen: boolean, sei: SeiRequest | null }>({ isOpen: false, sei: null });
    const [isSeiExportOpen, setIsSeiExportOpen] = useState(false);

    const fetchData = async () => {
        if (!session) return;
        setLoading(true);

        // Fetch Docs
        const { data: docsData, error: docsError } = await supabase
            .from('administrative_documents')
            .select('*')
            .is('deleted_at', null)

            .order('created_at', { ascending: false });

        if (docsError) console.error('Error fetching docs:', docsError);
        else setDocs((docsData || []).map((d: any) => ({
            id: d.id,
            number: d.number,
            subject: d.subject,
            date: d.date,
            issuer: d.issuer,
            documentType: d.document_type || 'Documento',
            filePath: d.file_path,
            user_id: d.user_id,
            unit_id: d.unit_id
        })));

        // Fetch SEI
        const { data: seiData, error: seiError } = await supabase
            .from('sei_requests')
            .select('*')
            .is('deleted_at', null)

            .order('last_movement_date', { ascending: true }); // Oldest movement first (stalled)

        if (seiError) console.error('Error fetching SEI:', seiError);
        else setSeiRequests((seiData || []).map((d: any) => ({
            id: d.id,
            processNumber: d.process_number,
            subject: d.subject,
            creationDate: d.creation_date,
            lastMovementDate: d.last_movement_date,
            currentSector: d.current_sector,
            responsibleServer: d.responsible_server,
            status: d.status,
            user_id: d.user_id,
            unit_id: d.unit_id
        })));

        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchData();
    }, [session, teamOwnerId]);

    // --- Docs Logic ---
    const confirmDeleteDoc = (doc: AdministrativeDocument) => {
        setDeleteData({ isOpen: true, doc });
    };

    const executeDeleteDoc = async (action: 'gap' | 'recalculate') => {
        const doc = deleteData.doc;
        if (!doc) return;

        try {
            const { error: deleteError } = await supabase
                .from('administrative_documents')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', doc.id);

            if (deleteError) throw deleteError;

            if (action === 'recalculate') {
                const { data: subsequentDocs } = await supabase
                    .from('administrative_documents')
                    .select('id, number')
                    .eq('issuer', doc.issuer)
                    .eq('document_type', doc.documentType)
                    .is('deleted_at', null)
                    .gt('number', doc.number);

                for (const d of subsequentDocs || []) {
                    const oldNum = parseInt(d.number);
                    const newNum = (oldNum - 1).toString().padStart(2, '0');
                    await supabase
                        .from('administrative_documents')
                        .update({ number: newNum })
                        .eq('id', d.id);
                }
            }

            setDeleteData({ isOpen: false, doc: null });
            fetchData();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        }
    };

    const handleDownload = async (filePath: string) => {
        try {
            const { data, error } = await supabase.storage.from('documents').download(filePath);
            if (error) throw error;
            const url = URL.createObjectURL(data);
            window.open(url, '_blank');
        } catch (error: any) {
            alert('Erro ao baixar: ' + error.message);
        }
    };

    const filteredDocs = docs.filter(d => {
        const matchesSearch = d.number.includes(searchTerm) || d.subject.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'All' || d.issuer === activeFilter;
        return matchesSearch && matchesFilter;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        const numA = parseInt(a.number);
        const numB = parseInt(b.number);
        return sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    // --- SEI Logic ---
    const handleDeleteSei = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este pedido?")) return;
        const { error } = await supabase.from('sei_requests').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) alert("Erro ao excluir: " + error.message);
        else fetchData();
    };

    const filteredSei = seiRequests.filter(s =>
        s.processNumber.includes(searchTerm) ||
        s.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.responsibleServer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openReminderModal = (sei: SeiRequest) => {
        setReminderData({ isOpen: true, sei });
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-8 bg-blue-600 rounded-full block"></span>
                        Administrativo
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Gerencie ofícios, portarias e pedidos SEI.</p>
                </div>

                <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                    <button
                        onClick={() => setActiveTab('docs')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'docs' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Documentos
                    </button>
                    <button
                        onClick={() => setActiveTab('sei')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'sei' ? 'bg-amber-100 text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Pedidos SEI
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-6 sticky top-20 z-10">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder={activeTab === 'docs' ? "Pesquisar por número ou assunto..." : "Pesquisar por processo, assunto ou servidor..."}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-gray-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {activeTab === 'docs' ? (
                    <>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {(['All', 'Secretaria', 'Gabinete'] as const).map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeFilter === filter ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {filter === 'All' ? 'Todos' : filter}
                                </button>
                            ))}
                        </div>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                            className="p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-200 outline-none shadow-sm cursor-pointer"
                        >
                            <option value="asc">Mais Antigos</option>
                            <option value="desc">Mais Recentes</option>
                        </select>
                        <button onClick={() => setIsExportOpen(true)} className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm"><Download size={20} /></button>
                        <button onClick={() => setIsTrashOpen(true)} className="bg-white text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 flex items-center gap-2 shadow-sm"><ArchiveRestore size={20} /></button>
                        <button onClick={() => { setEditingDoc(undefined); setIsDocFormOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm font-medium"><Plus size={20} /> Novo</button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setIsSeiExportOpen(true)} className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm"><Download size={20} /></button>
                        <button onClick={() => { setEditingSei(undefined); setIsSeiFormOpen(true); }} className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 flex items-center gap-2 shadow-sm font-medium"><Plus size={20} /> Novo Pedido</button>
                    </>
                )}
            </div>

            {/* Content */}
            {activeTab === 'docs' ? (
                <div className="grid gap-4">
                    {loading ? <div className="p-8 text-center text-gray-500">Carregando...</div> : filteredDocs.length === 0 ? (
                        <div className="p-12 bg-white rounded-xl border border-dashed border-gray-300 text-center text-gray-500">Nenhum documento encontrado.</div>
                    ) : (
                        filteredDocs.map(doc => (
                            <div key={doc.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className={`p-3 rounded-lg flex-shrink-0 ${doc.issuer === 'Gabinete' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        <FileText size={20} />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-800">#{doc.number}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${doc.issuer === 'Gabinete' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{doc.issuer}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider bg-gray-100 text-gray-600">{doc.documentType}</span>
                                        </div>
                                        <h4 className="font-medium text-gray-900">{doc.subject}</h4>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">📅 {new Date(doc.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setEditingDoc(doc); setIsDocFormOpen(true); }} className="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50"><Edit size={18} /></button>
                                    {doc.filePath && <button onClick={() => handleDownload(doc.filePath!)} className="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50"><Download size={18} /></button>}
                                    <button onClick={() => confirmDeleteDoc(doc)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="grid gap-4">
                    {loading ? <div className="p-8 text-center text-gray-500">Carregando...</div> : filteredSei.length === 0 ? (
                        <div className="p-12 bg-white rounded-xl border border-dashed border-gray-300 text-center text-gray-500">Nenhum pedido SEI encontrado.</div>
                    ) : (
                        filteredSei.map(sei => {
                            // Calculate days stalled
                            const daysStalled = Math.floor((new Date().getTime() - new Date(sei.lastMovementDate).getTime()) / (1000 * 3600 * 24));
                            const isStalled = daysStalled > 30;

                            return (
                                <div key={sei.id} className={`bg-white p-5 rounded-xl shadow-sm border transition-shadow flex flex-col md:flex-row gap-4 justify-between relative overflow-hidden ${isStalled ? 'border-red-200 bg-red-50/30' : 'border-gray-100 hover:shadow-md'}`}>
                                    {isStalled && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}

                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-sm">{sei.processNumber}</span>
                                            {isStalled && (
                                                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={12} /> {daysStalled} dias sem mover
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-gray-800">{sei.subject}</h4>
                                        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                                            <span className="flex items-center gap-1" title="Setor Atual"><div className="w-2 h-2 rounded-full bg-amber-400" /> {sei.currentSector}</span>
                                            <span className="flex items-center gap-1" title="Responsável"><div className="w-2 h-2 rounded-full bg-blue-400" /> {sei.responsibleServer}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Clock size={12} /> Última Movimentação: {new Date(sei.lastMovementDate).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <div className="flex flex-row md:flex-col items-end gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                                        {isStalled && (
                                            <button
                                                onClick={() => openReminderModal(sei)}
                                                className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-200 transition-colors mb-auto md:mb-0"
                                            >
                                                <Copy size={12} /> Gerar Cobrança
                                            </button>
                                        )}
                                        <div className="flex gap-1 ml-auto">
                                            {hasEdit && <button onClick={() => { setEditingSei(sei); setIsSeiFormOpen(true); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={18} /></button>}
                                            {hasAdmin && <button onClick={() => handleDeleteSei(sei.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modals */}
            {isDocFormOpen && <AdminForm session={session} initialData={editingDoc} onClose={() => setIsDocFormOpen(false)} onSuccess={fetchData} />}
            {isSeiFormOpen && <SeiRequestForm session={session} initialData={editingSei} onClose={() => setIsSeiFormOpen(false)} onSuccess={fetchData} />}

            <SeiReminderModal
                isOpen={reminderData.isOpen}
                onClose={() => setReminderData({ isOpen: false, sei: null })}
                seiRequest={reminderData.sei}
            />

            <SeiExportModal
                isOpen={isSeiExportOpen}
                onClose={() => setIsSeiExportOpen(false)}
                requests={filteredSei}
            />

            <AdminExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} documents={filteredDocs} />
            <AdminTrashModal isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} session={session} onRestore={fetchData} />
            <AdminDeleteModal isOpen={deleteData.isOpen} onClose={() => setDeleteData({ isOpen: false, doc: null })} onConfirm={executeDeleteDoc} document={deleteData.doc} />
        </div>
    );
};
