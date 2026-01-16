import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RogatoryLetter } from '../../types';
import { Plus, Search, Mail, Edit, Trash2, Calendar, MapPin, User, FileText, AlertCircle, Gavel, Lock } from 'lucide-react';
import { RogatoryForm } from './RogatoryForm';
import { calculateDaysUntil } from '../../utils';

export const RogatoryDashboard: React.FC<{ session: any }> = ({ session }) => {
    const [letters, setLetters] = useState<RogatoryLetter[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDirection, setActiveDirection] = useState<'incoming' | 'outgoing'>('incoming');
    const [activeTab, setActiveTab] = useState<'criminal' | 'civil'>('criminal');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLetter, setEditingLetter] = useState<RogatoryLetter | undefined>(undefined);

    const fetchLetters = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('rogatory_letters')
            .select('*')
            .is('deleted_at', null)
            .order('received_date', { ascending: false });

        if (error) {
            console.error('Error fetching letters:', error);
        } else {
            setLetters(data.map((d: any) => ({
                id: d.id,
                caseNumber: d.case_number,
                direction: d.direction || 'incoming',
                defendantName: d.defendant_name,
                originCourt: d.origin_court,
                type: d.type,
                receivedDate: d.received_date,
                deadlineDate: d.deadline_date,
                status: d.status,
                obs: d.obs,
                purpose: d.purpose,
                hasHearing: d.has_hearing,
                hearingDate: d.hearing_date,
                isPrisoner: d.is_prisoner,
                user_id: d.user_id,
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLetters();
    }, [session]);

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta carta precatória?')) return;

        // Soft delete logic would go here, currently hard delete or implement soft delete in DB
        // Based on plan we have soft delete column
        const { error } = await supabase
            .from('rogatory_letters')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            fetchLetters();
        }
    };

    const filteredLetters = letters.filter(l => {
        const matchesDirection = (l.direction || 'incoming') === activeDirection;
        const matchesTab = l.type === activeTab;
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
            l.caseNumber.toLowerCase().includes(searchLower) ||
            l.defendantName.toLowerCase().includes(searchLower) ||
            l.originCourt.toLowerCase().includes(searchLower);
        return matchesDirection && matchesTab && matchesSearch;
    });

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-8 bg-indigo-600 rounded-full block"></span>
                        Cartas Precatórias
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Gerencie cartas precatórias recebidas de outras comarcas.</p>
                </div>
                <button
                    onClick={() => { setEditingLetter(undefined); setIsFormOpen(true); }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-colors"
                >
                    <Plus size={20} /> Nova Carta
                </button>
            </div>

            {/* Main Direction Tabs */}
            <div className="flex gap-4 mb-6 bg-white p-1 rounded-xl border border-gray-100 shadow-sm w-fit">
                <button
                    onClick={() => setActiveDirection('incoming')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeDirection === 'incoming' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    Recebidas
                </button>
                <button
                    onClick={() => setActiveDirection('outgoing')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeDirection === 'outgoing' ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    Enviadas
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('criminal')}
                    className={`pb-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'criminal' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${activeTab === 'criminal' ? 'bg-red-500' : 'bg-gray-300'}`} />
                    Criminal
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {letters.filter(l => l.type === 'criminal' && (l.direction || 'incoming') === activeDirection).length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('civil')}
                    className={`pb-3 px-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'civil' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${activeTab === 'civil' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    Cível
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {letters.filter(l => l.type === 'civil' && (l.direction || 'incoming') === activeDirection).length}
                    </span>
                </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 mb-6 sticky top-20 z-10">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar por processo, nome ou origem..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none text-gray-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Carregando cartas...</div>
                ) : filteredLetters.length === 0 ? (
                    <div className="p-12 bg-white rounded-xl border border-dashed border-gray-300 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Mail size={32} />
                        </div>
                        <p className="text-gray-500">Nenhuma carta precatória encontrada nesta categoria.</p>
                    </div>
                ) : (
                    filteredLetters.map(letter => (
                        <div
                            key={letter.id}
                            className={`p-5 rounded-xl shadow-sm border hover:shadow-md transition-shadow group relative overflow-hidden ${letter.isPrisoner && letter.type === 'criminal'
                                ? 'bg-red-50 border-red-200'
                                : letter.hasHearing
                                    ? 'bg-indigo-50 border-indigo-200'
                                    : 'bg-white border-gray-100'
                                }`}
                        >
                            <div className={`absolute top-0 left-0 w-1 h-full ${letter.isPrisoner && letter.type === 'criminal'
                                ? 'bg-red-600'
                                : letter.hasHearing
                                    ? 'bg-indigo-500'
                                    : letter.type === 'criminal' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />

                            <div className="flex flex-col md:flex-row justify-between gap-4">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-sm">
                                            {letter.caseNumber}
                                        </span>
                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${letter.type === 'criminal' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                            {letter.type}
                                        </span>
                                        {letter.deadlineDate && (
                                            (() => {
                                                const daysLeft = calculateDaysUntil(letter.deadlineDate);
                                                const isExpired = daysLeft < 0;
                                                const isOutgoing = letter.direction === 'outgoing';

                                                return (
                                                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isExpired ? 'bg-red-100 text-red-700 font-bold border border-red-200' : 'text-orange-600 bg-orange-50'}`}>
                                                        {isExpired ? <AlertCircle size={12} /> : <Calendar size={12} />}
                                                        {isExpired
                                                            ? (isOutgoing ? 'COBRAR ANDAMENTO' : 'VENCIDO')
                                                            : `${isOutgoing ? 'Cobrar em: ' : 'Prazo: '} ${new Date(letter.deadlineDate).toLocaleDateString()}`
                                                        }
                                                    </span>
                                                );
                                            })()
                                        )}

                                        {letter.hasHearing && (
                                            <div className="flex items-center gap-2">
                                                <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-100">
                                                    <Gavel size={10} /> Audiência
                                                </span>
                                                {letter.hearingDate && (() => {
                                                    const daysUntilHearing = calculateDaysUntil(letter.hearingDate);
                                                    const isPast = daysUntilHearing < 0;
                                                    return (
                                                        <span className={`text-xs font-medium ${isPast ? 'text-gray-500' : 'text-indigo-600'}`}>
                                                            Data: {new Date(letter.hearingDate).toLocaleString()}
                                                            <span className={isPast ? 'font-bold text-gray-600 ml-1' : 'ml-1'}>
                                                                ({isPast ? 'DATA PASSADA / REALIZADA' : `Faltam ${daysUntilHearing} dias`})
                                                            </span>
                                                        </span>
                                                    )
                                                })()}
                                            </div>
                                        )}
                                        {letter.isPrisoner && letter.type === 'criminal' && (
                                            <span className="flex items-center gap-1 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-sm animate-pulse">
                                                <Lock size={10} /> RÉU PRESO
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                            <User size={18} className="text-gray-400" />
                                            {letter.defendantName}
                                        </h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                            <MapPin size={14} />
                                            {letter.direction === 'outgoing' ? 'Destino: ' : 'Origem: '}
                                            {letter.originCourt}
                                        </p>


                                        {letter.purpose && (
                                            <p className="text-sm text-gray-700 mt-1 font-medium bg-gray-50 inline-block px-2 py-0.5 rounded">
                                                Finalidade: {letter.purpose}
                                            </p>
                                        )}
                                    </div>

                                    {letter.obs && (
                                        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 flex gap-2">
                                            <FileText size={16} className="text-gray-400 shrink-0 mt-0.5" />
                                            {letter.obs}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-row md:flex-col justify-between md:justify-start items-end gap-2 border-t md:border-t-0 pt-4 md:pt-0">
                                    <div className="text-xs text-gray-400 text-right">
                                        <div>Recebido em</div>
                                        <div>{new Date(letter.receivedDate).toLocaleDateString()}</div>
                                    </div>

                                    <div className="flex gap-1 mt-2">
                                        <button
                                            onClick={() => { setEditingLetter(letter); setIsFormOpen(true); }}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                            title="Editar"
                                        >
                                            <Edit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(letter.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {
                isFormOpen && (
                    <RogatoryForm
                        session={session}
                        initialData={editingLetter}
                        defaultDirection={activeDirection}
                        onClose={() => setIsFormOpen(false)}
                        onSuccess={fetchLetters}
                    />
                )
            }
        </div >
    );
};
