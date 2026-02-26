import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash, DollarSign, Calendar, ArchiveRestore, RefreshCw, AlertTriangle, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PenhoraOrder, PenhoraOrderFormData } from '../../types';
import { Button } from '../../components/ui/Button';
import { PenhoraForm } from './PenhoraForm';
import { PenhoraTrashModal } from './PenhoraTrashModal';
import { useUserRole } from '../../hooks/useUserRole';
import { formatDate } from '../../utils';

interface PenhoraDashboardProps {
    session: any;
}

const TABS = ['Sisbajud', 'Renajud', 'Infojud', 'Siel', 'Serasajud', 'CNIB', 'SNIPER'] as const;

export const PenhoraDashboard: React.FC<PenhoraDashboardProps> = ({ session }) => {
    const { checkPermission, teamOwnerId, isAdmin, unitId } = useUserRole(session);
    const hasEdit = checkPermission('penhora', 'edit');
    const hasAdmin = checkPermission('penhora', 'admin');

    const [orders, setOrders] = useState<PenhoraOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Sisbajud');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [sortBy, setSortBy] = useState('created_desc');
    const [showConcluded, setShowConcluded] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('penhora_orders')
            .select('*')
            .is('deleted_at', null)

            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
        } else {
            setOrders((data || []).map((d: any) => ({
                id: d.id,
                name: d.name,
                caseNumber: d.case_number,
                type: d.type,
                value: d.value,
                lastUpdateDate: d.last_update_date,
                status: d.status,
                isTeimosinha: d.is_teimosinha,
                protocolDate: d.protocol_date,
                deadlineDate: d.deadline_date,
                restrictionType: d.restriction_type,
                obs: d.obs,
                user_id: d.user_id,
                createdAt: d.created_at,
                deletedAt: d.deleted_at,
                isConcluded: d.is_concluded,
                concludedAt: d.concluded_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session) fetchOrders();
    }, [session, teamOwnerId]);

    const handleSave = async (data: PenhoraOrderFormData) => {
        const payload = {
            name: data.name,
            case_number: data.caseNumber,
            type: data.type,
            value: data.value,
            last_update_date: data.lastUpdateDate || null,
            status: data.status,
            is_teimosinha: data.isTeimosinha,
            protocol_date: data.protocolDate || null,
            deadline_date: data.deadlineDate || null,
            restriction_type: data.restrictionType,
            obs: data.obs,
            user_id: teamOwnerId || session.user.id,
            unit_id: unitId
        };

        if (editingId) {
            const { error } = await supabase.from('penhora_orders').update(payload).eq('id', editingId);
            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            const { error } = await supabase.from('penhora_orders').insert([payload]);
            if (error) alert('Erro ao criar: ' + error.message);
        }
        await fetchOrders();
        setIsFormOpen(false);
        setEditingId(null);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Mover "${name}" para a lixeira?`)) return;

        const { error } = await supabase
            .from('penhora_orders')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) alert('Erro ao excluir: ' + error.message);
        else await fetchOrders();

    };

    const handleToggleConclusion = async (order: PenhoraOrder) => {
        const isConcluded = !order.isConcluded;
        const concludedAt = isConcluded ? new Date().toISOString() : null;

        const { error } = await supabase
            .from('penhora_orders')
            .update({
                is_concluded: isConcluded,
                concluded_at: concludedAt
            })
            .eq('id', order.id);

        if (error) {
            alert('Erro ao atualizar status: ' + error.message);
            return;
        }

        // Update local state to reflect change immediately without refetching (optimistic-like) or just refetch
        // Refetch is safer for consistency
        await fetchOrders();
    };

    // Calculate stats
    const stats = {
        pending: orders.filter(o => o.type === activeTab && !o.isConcluded).length,
        concluded: orders.filter(o => o.type === activeTab && o.isConcluded).length
    };

    const filteredOrders = orders.filter(o => {
        const matchesTab = o.type === activeTab;
        const matchesSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            o.caseNumber.includes(searchTerm);

        // If searching, show all matching regardless of status, otherwise filter by status
        const matchesStatus = searchTerm ? true : (showConcluded ? o.isConcluded : !o.isConcluded);

        return matchesTab && matchesSearch && matchesStatus;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'created_desc':
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            case 'name_asc':
                return a.name.localeCompare(b.name);
            case 'case_number_asc':
                return a.caseNumber.localeCompare(b.caseNumber);
            case 'deadline_asc':
                const dateA = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Number.MAX_VALUE;
                const dateB = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Number.MAX_VALUE;
                return dateA - dateB;
            case 'value_desc':
                const valA = a.value || 0;
                const valB = b.value || 0;
                return valB - valA;
            default:
                return 0;
        }
    });

    const renderTableContent = () => {
        if (loading) return <tr><td colSpan={7} className="p-8 text-center text-gray-500">Carregando...</td></tr>;
        if (filteredOrders.length === 0) return <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>;

        return filteredOrders.map(order => (

            <tr key={order.id} className={`hover:bg-gray-50 transition-colors group ${order.isConcluded ? 'bg-gray-50/80' : ''}`}>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${order.status === 'Aguardando Resposta' ? 'bg-orange-100 text-orange-700' :
                            order.status === 'Aguardando Protocolo' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                            }`}>
                            {order.status}
                        </span>
                        {order.isConcluded && (
                            <>
                                <span className="text-gray-400">→</span>
                                <span className="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700">
                                    Concluído
                                </span>
                            </>
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{order.name}</td>
                <td className="px-6 py-4 text-gray-600 font-mono text-sm">{order.caseNumber}</td>

                {/* Conditional Columns based on Tab */}
                {activeTab === 'Sisbajud' && (
                    <>
                        <td className="px-6 py-4 text-gray-600">
                            {order.value ? (
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">R$ {order.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    {order.lastUpdateDate && <span className="text-xs text-gray-400">{formatDate(order.lastUpdateDate)}</span>}
                                </div>
                            ) : '-'}
                        </td>
                        <td className="px-6 py-4">
                            {order.isTeimosinha && (
                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 w-fit">
                                    <RefreshCw size={12} /> Teimosinha
                                </span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                            <div className="flex flex-col gap-1">
                                {order.protocolDate && (
                                    <span className="text-xs flex items-center gap-1" title="Data do Protocolo">
                                        <Calendar size={12} /> {formatDate(order.protocolDate)}
                                    </span>
                                )}
                                {order.deadlineDate && (
                                    <span className="text-xs flex items-center gap-1 text-red-600 font-medium" title="Prazo Limite">
                                        <AlertTriangle size={12} /> {formatDate(order.deadlineDate)}
                                    </span>
                                )}
                                {!order.protocolDate && !order.deadlineDate && '-'}
                            </div>
                        </td>
                    </>
                )}

                {activeTab === 'Renajud' && (
                    <td className="px-6 py-4">
                        {order.restrictionType ? (
                            <span className="px-2 py-1 bg-orange-50 text-orange-800 border border-orange-200 rounded text-xs font-semibold">
                                {order.restrictionType}
                            </span>
                        ) : '-'}
                    </td>
                )}

                {/* For Others, no extra specific columns requested beyond Status/Name/Process/Obs */}

                <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate" title={order.obs}>{order.obs || '-'}</td>

                <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(hasEdit || hasAdmin) && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleConclusion(order)}
                                    className={`transition-colors ${order.isConcluded ? 'text-green-600 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'}`}
                                    title={order.isConcluded ? 'Reabrir' : 'Concluir'}
                                >
                                    <CheckCircle size={18} className={order.isConcluded ? 'fill-current' : ''} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setEditingId(order.id); setIsFormOpen(true); }} className="text-blue-600 hover:bg-blue-100"><Edit size={16} /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(order.id, order.name)} className="text-red-600 hover:bg-red-100"><Trash size={16} /></Button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
        ));
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <PenhoraForm
                        initialData={editingId ? orders.find(o => o.id === editingId) : undefined}
                        defaultType={activeTab}
                        onSubmit={handleSave}
                        onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
                    />
                </div>
            )}

            <PenhoraTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                session={session}
                onRestore={fetchOrders}
            />

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 py-2 flex overflow-x-auto space-x-1 shadow-sm">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-sm px-4 py-2.5 rounded-lg whitespace-nowrap transition-all font-medium flex items-center gap-2 ${activeTab === tab
                            ? 'bg-justice-700 text-white shadow-md ring-2 ring-justice-700 ring-offset-1'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-justice-700'}`}
                    >
                        {tab === 'Sisbajud' && <DollarSign size={16} />}
                        {tab === 'Renajud' && <ShieldAlert size={16} />}
                        {tab}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-6 bg-justice-500 rounded-full"></span>
                        Controle de Penhora: {activeTab}
                    </h2>

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

                    <div className="flex gap-2 w-full md:w-auto flex-wrap justify-end">
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
                                <option value="created_desc">Mais Recentes</option>
                                <option value="name_asc">Nome (A-Z)</option>
                                <option value="case_number_asc">Processo</option>
                                <option value="deadline_asc">Prazo Mais Próximo</option>
                                <option value="value_desc">Maior Valor</option>
                            </select>
                        </div>
                        {(hasEdit || hasAdmin) && (
                            <Button variant="outline-danger" onClick={() => setIsTrashOpen(true)} title="Lixeira">
                                <ArchiveRestore size={18} />
                            </Button>
                        )}
                        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }} leftIcon={Plus} className="shadow">
                            Novo
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs border-b">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Situação</th>
                                <th className="px-6 py-4">Nome / Parte</th>
                                <th className="px-6 py-4">Processo</th>
                                {activeTab === 'Sisbajud' && (
                                    <>
                                        <th className="px-6 py-4">Valor / Atualização</th>
                                        <th className="px-6 py-4">Detalhes</th>
                                        <th className="px-6 py-4">Protocolo / Prazo</th>
                                    </>
                                )}
                                {activeTab === 'Renajud' && (
                                    <th className="px-6 py-4">Restrição</th>
                                )}
                                <th className="px-6 py-4">Observações</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {renderTableContent()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
