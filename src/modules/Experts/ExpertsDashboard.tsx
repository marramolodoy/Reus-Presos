import React, { useState, useEffect } from 'react';
import { Stethoscope, Plus, Search, Filter, ClipboardList, TrendingUp, History, Download, Trash2, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Expert, ExpertAppointment } from '../../types';
import { useUserRole } from '../../hooks/useUserRole';
import { ExpertForm } from './ExpertForm';
import { AppointmentForm } from './AppointmentForm';

interface ExpertsDashboardProps {
    session: any;
}

export const ExpertsDashboard: React.FC<ExpertsDashboardProps> = ({ session }) => {
    const { unitId } = useUserRole(session);
    const [activeTab, setActiveTab] = useState<'rotation' | 'history'>('rotation');

    // Data State
    const [experts, setExperts] = useState<Expert[]>([]);
    const [appointments, setAppointments] = useState<ExpertAppointment[]>([]);
    const [loading, setLoading] = useState(true);

    // Form Modals State
    const [isExpertFormOpen, setIsExpertFormOpen] = useState(false);
    const [editingExpert, setEditingExpert] = useState<Expert | null>(null);

    const [isAppointmentFormOpen, setIsAppointmentFormOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<ExpertAppointment | null>(null);

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [specialtyFilter, setSpecialtyFilter] = useState('Todas');

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, unitId]);

    const fetchData = async () => {
        if (!session) return;
        setLoading(true);

        try {
            const userId = session.user.id;
            let queryExperts = supabase.from('experts').select('*');
            let queryAppoints = supabase.from('expert_appointments').select('*, experts(*)');

            if (unitId) {
                queryExperts = queryExperts.eq('unit_id', unitId);
                queryAppoints = queryAppoints.eq('unit_id', unitId);
            } else {
                queryExperts = queryExperts.eq('user_id', userId);
                queryAppoints = queryAppoints.eq('user_id', userId);
            }

            const [expertsRes, appointsRes] = await Promise.all([queryExperts, queryAppoints]);

            if (expertsRes.data) setExperts(expertsRes.data);
            if (appointsRes.data) {
                // Ordering by date descending
                const appData = appointsRes.data.sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());
                setAppointments(appData);
            }
        } catch (error) {
            console.error('Error fetching expert data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Derived states
    const specialties = ['Todas', ...Array.from(new Set(experts.map(e => e.specialty)))];

    const getRotationData = () => {
        return experts.map(expert => {
            const expertAppoints = appointments.filter(a => a.expert_id === expert.id);
            const total = expertAppoints.length;
            const mostRecent = total > 0 ? expertAppoints[0].appointment_date : null;
            const activeCount = expertAppoints.filter(a => ['Nomeado', 'Aceitou o Encargo', 'Aguardando Laudo'].includes(a.status)).length;

            return {
                ...expert,
                totalAppointments: total,
                lastAppointmentDate: mostRecent,
                activeAppointments: activeCount
            };
        }).filter(e => {
            if (specialtyFilter !== 'Todas' && e.specialty !== specialtyFilter) return false;
            if (searchTerm && !e.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        }).sort((a, b) => {
            // Sort to show those who haven't been appointed recently FIRST (fair rotation)
            if (!a.lastAppointmentDate && !b.lastAppointmentDate) return 0;
            if (!a.lastAppointmentDate) return -1; // Never appointed goes first
            if (!b.lastAppointmentDate) return 1;
            return new Date(a.lastAppointmentDate).getTime() - new Date(b.lastAppointmentDate).getTime();
        });
    };

    const rotationData = getRotationData();

    // Handlers
    const handleSaveExpert = async (data: any) => {
        if (!session) return;
        const payload = {
            ...data,
            user_id: session.user.id,
            unit_id: unitId
        };

        if (editingExpert) {
            await supabase.from('experts').update(payload).eq('id', editingExpert.id);
        } else {
            await supabase.from('experts').insert([payload]);
        }

        setIsExpertFormOpen(false);
        setEditingExpert(null);
        fetchData();
    };

    const handleDeleteExpert = async (id: string) => {
        if (window.confirm('Tem certeza? Isso pode afetar o histórico da corregedoria.')) {
            await supabase.from('experts').delete().eq('id', id);
            fetchData();
        }
    };

    const handleSaveAppointment = async (data: any) => {
        if (!session) return;
        const payload = {
            ...data,
            user_id: session.user.id,
            unit_id: unitId
        };

        if (editingAppointment) {
            await supabase.from('expert_appointments').update(payload).eq('id', editingAppointment.id);
        } else {
            await supabase.from('expert_appointments').insert([payload]);
        }

        setIsAppointmentFormOpen(false);
        setEditingAppointment(null);
        fetchData();
    };

    const handleDeleteAppointment = async (id: string) => {
        if (window.confirm('Deseja realmente apagar esta nomeação?')) {
            await supabase.from('expert_appointments').delete().eq('id', id);
            fetchData();
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        let colors = 'bg-gray-100 text-gray-800';
        if (status === 'Laudo Entregue') colors = 'bg-green-100 text-green-800 border-green-200';
        if (status === 'Nomeado' || status === 'Aguardando Laudo') colors = 'bg-blue-100 text-blue-800 border-blue-200';
        if (status === 'Aceitou o Encargo') colors = 'bg-purple-100 text-purple-800 border-purple-200';
        if (status === 'Suspenso') colors = 'bg-orange-100 text-orange-800 border-orange-200';
        if (status === 'Destituído') colors = 'bg-red-100 text-red-800 border-red-200';

        return <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${colors}`}>{status}</span>;
    };

    const generateReport = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Perito,Especialidade,Processo,Data Nomeacao,Status,Honorarios,Status Pagamento,OBS\n";

        appointments.forEach(app => {
            const expertName = app.experts?.name || 'Desconhecido';
            const specialty = app.experts?.specialty || '';
            const row = `"${expertName}","${specialty}","${app.process_number}","${new Date(app.appointment_date).toLocaleDateString()}","${app.status}",${app.fee_amount || 0},"${app.fee_status}","${app.obs || ''}"`;
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_corregedoria_peritos_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 animate-fade-in relative z-10 w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                        <Stethoscope size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Peritos Nomeados</h1>
                        <p className="text-sm text-gray-500">Módulo de controle de rotatividade e relatórios para Corregedoria</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setEditingExpert(null); setIsExpertFormOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition border shadow-sm"
                    >
                        <Plus size={18} /> Cadastrar Perito
                    </button>
                    <button
                        onClick={() => { setEditingAppointment(null); setIsAppointmentFormOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition shadow-sm"
                    >
                        <Plus size={18} /> Nova Nomeação
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col p-6 max-w-7xl mx-auto w-full">

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar perito por nome ou processo..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="relative shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select
                            className="pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-gray-700 cursor-pointer"
                            value={specialtyFilter}
                            onChange={(e) => setSpecialtyFilter(e.target.value)}
                        >
                            {specialties.map(spec => (
                                <option key={spec} value={spec}>{spec}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6 shrink-0 gap-6">
                    <button
                        className={`pb-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'rotation' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('rotation')}
                    >
                        <TrendingUp size={16} /> Painel de Rotatividade
                    </button>
                    <button
                        className={`pb-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <History size={16} /> Histórico de Nomeações
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-48">
                            <div className="h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <>
                            {/* ROTATION TAB */}
                            {activeTab === 'rotation' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {rotationData.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">Nenhum perito cadastrado ou filtrado.</div>}
                                    {rotationData.map((expert, idx) => (
                                        <div key={expert.id} className="bg-white rounded-xl p-5 border shadow-sm relative overflow-hidden group">
                                            {/* Badge for longest waiting */}
                                            {idx === 0 && expert.is_active && !expert.activeAppointments && (
                                                <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                                                    VEZ NA ROTAÇÃO
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-lg">{expert.name}</h3>
                                                    <p className="text-sm text-purple-600 font-medium">{expert.specialty}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setEditingExpert(expert); setIsExpertFormOpen(true); }} className="text-gray-400 hover:text-blue-600"><Edit size={16} /></button>
                                                    <button onClick={() => handleDeleteExpert(expert.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mt-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Última Nomeação:</span>
                                                    <span className="font-semibold text-gray-800">{expert.lastAppointmentDate ? new Date(expert.lastAppointmentDate).toLocaleDateString('pt-BR') : 'Nunca Nomeado'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Nomeações Ativas:</span>
                                                    <span className="font-semibold text-gray-800">
                                                        {expert.activeAppointments > 0 ? (
                                                            <span className="text-orange-600">{expert.activeAppointments} pendentes</span>
                                                        ) : (
                                                            <span className="text-green-600">Livre</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Total Histórico:</span>
                                                    <span className="font-semibold text-gray-800">{expert.totalAppointments}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t mt-2">
                                                    <span className="text-gray-500">Status Cadastro:</span>
                                                    <span className="font-semibold">{expert.is_active ? <span className="text-green-600">Ativo</span> : <span className="text-red-600">Inativo</span>}</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setEditingAppointment(null);
                                                    setIsAppointmentFormOpen(true);
                                                    // Idealmente passaríamos o ID do perito pré-selecionado pro formulário
                                                }}
                                                className="mt-4 w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg transition-colors text-sm"
                                                disabled={!expert.is_active}
                                            >
                                                {expert.is_active ? 'Nomear Este Perito' : 'Perito Inativo'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* HISTORY TAB */}
                            {activeTab === 'history' && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full max-h-[800px]">
                                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                            <ClipboardList size={18} /> Histórico Consolidado
                                        </h2>
                                        <button onClick={generateReport} className="flex items-center gap-2 text-sm text-purple-700 bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                                            <Download size={16} /> Gerar Relatório Corregedoria
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm text-gray-600">
                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 font-semibold">Perito</th>
                                                    <th className="px-4 py-3 font-semibold">Especialidade</th>
                                                    <th className="px-4 py-3 font-semibold">Processo</th>
                                                    <th className="px-4 py-3 font-semibold">Data</th>
                                                    <th className="px-4 py-3 font-semibold">Status Perícia</th>
                                                    <th className="px-4 py-3 font-semibold">Honorários</th>
                                                    <th className="px-4 py-3 font-semibold">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {appointments.filter(a => {
                                                    if (searchTerm) {
                                                        const pNumber = a.process_number.toLowerCase();
                                                        const pName = a.experts?.name.toLowerCase() || '';
                                                        return pNumber.includes(searchTerm.toLowerCase()) || pName.includes(searchTerm.toLowerCase());
                                                    }
                                                    if (specialtyFilter !== 'Todas') return a.experts?.specialty === specialtyFilter;
                                                    return true;
                                                }).map(app => (
                                                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-gray-900">{app.experts?.name}</td>
                                                        <td className="px-4 py-3 text-xs">{app.experts?.specialty}</td>
                                                        <td className="px-4 py-3 font-mono text-xs">{app.process_number}</td>
                                                        <td className="px-4 py-3">{new Date(app.appointment_date).toLocaleDateString('pt-BR')}</td>
                                                        <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                                                        <td className="px-4 py-3">
                                                            <div>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(app.fee_amount || 0)}</div>
                                                            <div className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{app.fee_status}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex gap-2">
                                                                <button onClick={() => { setEditingAppointment(app); setIsAppointmentFormOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Editar Nomeação"><Edit size={16} /></button>
                                                                <button onClick={() => handleDeleteAppointment(app.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Excluir Nomeação"><Trash2 size={16} /></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {appointments.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="text-center py-8 text-gray-500">Nenhuma nomeação encontrada no sistema.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ExpertForm
                isOpen={isExpertFormOpen}
                onClose={() => setIsExpertFormOpen(false)}
                onSave={handleSaveExpert}
                initialData={editingExpert}
            />

            <AppointmentForm
                isOpen={isAppointmentFormOpen}
                onClose={() => setIsAppointmentFormOpen(false)}
                onSave={handleSaveAppointment}
                initialData={editingAppointment}
                experts={experts.filter(e => e.is_active)}
            />
        </div>
    );
};
