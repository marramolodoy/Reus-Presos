import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Trash2, Search, ArchiveRestore } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CivilCase } from '../../types';

interface CivilTrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onRestore: () => void;
}

export const CivilTrashModal: React.FC<CivilTrashModalProps> = ({ isOpen, onClose, session, onRestore }) => {
    const [deletedCases, setDeletedCases] = useState<CivilCase[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDeletedCases = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('civil_cases')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar lixeira:', error);
        } else {
            setDeletedCases(data.map((d: any) => ({
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
                user_id: d.user_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchDeletedCases();
        }
    }, [isOpen, session]);

    const handleRestore = async (id: string) => {
        const { error } = await supabase
            .from('civil_cases')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) {
            alert('Erro ao restaurar: ' + error.message);
        } else {
            setDeletedCases(prev => prev.filter(c => c.id !== id));
            onRestore();
        }
    };

    const handleDeletePermanently = async (id: string) => {
        if (!confirm('ATENÇÃO: Isso excluirá o processo permanentemente. Deseja continuar?')) return;

        const { error } = await supabase
            .from('civil_cases')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            setDeletedCases(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleEmptyTrash = async () => {
        if (!confirm('ATENÇÃO: Isso excluirá TODOS os itens da lixeira PERMANENTEMENTE. Deseja continuar?')) return;

        setLoading(true);

        const { error } = await supabase
            .from('civil_cases')
            .delete()
            .not('deleted_at', 'is', null);

        if (error) {
            alert('Erro ao esvaziar lixeira: ' + error.message);
        } else {
            setDeletedCases([]);
        }
        setLoading(false);
    };

    const filteredCases = deletedCases.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.caseNumber.includes(searchTerm)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-red-50 border-b border-red-100 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                        <Trash2 size={20} /> Lixeira Cível
                    </h3>
                    <div className="flex items-center gap-2">
                        {deletedCases.length > 0 && (
                            <button
                                onClick={handleEmptyTrash}
                                className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 font-bold flex items-center gap-1 border border-red-200 transition-colors"
                            >
                                <Trash2 size={14} /> Esvaziar Lixeira
                            </button>
                        )}
                        <button onClick={onClose} className="text-red-400 hover:text-red-700">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-white border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Pesquisar itens excluídos..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-200 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-500 gap-2">
                            <span className="animate-spin">⌛</span> Carregando...
                        </div>
                    ) : filteredCases.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Trash2 size={48} className="mb-2 opacity-50" />
                            <p>Lixeira vazia</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredCases.map(c => (
                                <div key={c.id} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow flex justify-between items-center group">
                                    <div>
                                        <h4 className="font-bold text-gray-800">{c.name}</h4>
                                        <div className="text-sm text-gray-500 mt-1 flex gap-3">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{c.caseNumber}</span>
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs uppercase">{c.category}</span>
                                        </div>
                                        <p className="text-xs text-red-400 mt-2">
                                            Excluído em: {new Date(c.deletedAt!).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRestore(c.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg tooltip"
                                            title="Restaurar"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePermanently(c.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg tooltip"
                                            title="Excluir Permanentemente"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
