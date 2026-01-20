import React, { useState, useEffect } from 'react';
import { X, RefreshCcw, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Defendant } from '../types';
import { formatDate } from '../utils';

interface RecycleBinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestore: () => void; // Trigger refresh on parent
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ isOpen, onClose, onRestore }) => {
    const [deletedItems, setDeletedItems] = useState<Defendant[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchDeletedItems();
        }
    }, [isOpen]);

    const fetchDeletedItems = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('defendants')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error(error);
            alert('Erro ao carregar lixeira');
        } else {
            setDeletedItems(data.map((d: any) => ({
                id: d.id, name: d.name, caseNumber: d.case_number, penalType: d.penal_type,
                prisonType: d.prison_type, arrestDate: d.arrest_date, lastReviewDate: d.last_review_date,
                movementType: d.movement_type, lastMovementDate: d.last_movement_date,
                deadline: d.deadline, obs: d.obs, rji: d.rji, bnmp: d.bnmp, infopen: d.infopen,
                prison: d.prison, user_id: d.user_id, deleted_at: d.deleted_at
            })));
        }
        setLoading(false);
    };

    const handleRestore = async (id: string) => {
        if (confirm('Restaurar este registro?')) {
            const { error } = await supabase.from('defendants').update({ deleted_at: null }).eq('id', id);
            if (error) alert('Erro ao restaurar: ' + error.message);
            else {
                fetchDeletedItems();
                onRestore();
            }
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (confirm('ATENÇÃO: Isso excluirá permanentemente o registro. Continuar?')) {
            const { error } = await supabase.from('defendants').delete().eq('id', id);
            if (error) alert('Erro ao excluir: ' + error.message);
            else fetchDeletedItems();
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 md:p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-lg">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Trash2 size={20} className="text-red-500" />
                        Lixeira / Histórico de Exclusões
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-0">
                    <div className="min-w-full inline-block align-middle">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 font-semibold uppercase text-xs sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Réu</th>
                                        <th className="px-4 py-3">Data Exclusão</th>
                                        <th className="px-4 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={3} className="p-4 text-center">Carregando...</td></tr>
                                    ) : deletedItems.length === 0 ? (
                                        <tr><td colSpan={3} className="p-8 text-center text-gray-400">Lixeira vazia.</td></tr>
                                    ) : (
                                        deletedItems.map(item => (
                                            <tr key={item.id} className="hover:bg-red-50 group">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold">{item.name}</div>
                                                    <div className="text-xs text-gray-500">{item.caseNumber}</div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {item.deleted_at ? new Date(item.deleted_at).toLocaleString('pt-BR') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleRestore(item.id)}
                                                        className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs font-bold flex items-center gap-1"
                                                        title="Restaurar para a lista principal"
                                                    >
                                                        <RefreshCcw size={14} /> Restaurar
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(item.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600"
                                                        title="Excluir Permanentemente"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 text-center rounded-b-lg">
                    Itens restaurados voltarão para a lista principal imediatamente.
                </div>
            </div>
        </div>
    );
};
