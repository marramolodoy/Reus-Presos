
import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

interface ScheduleTrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRestore: () => void;
}

export const ScheduleTrashModal: React.FC<ScheduleTrashModalProps> = ({ isOpen, onClose, onRestore }) => {
    const [deletedItems, setDeletedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchDeleted = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('pending_schedules')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) console.error(error);
        else setDeletedItems(data || []);
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) fetchDeleted();
    }, [isOpen]);

    const handleRestore = async (id: string) => {
        const { error } = await supabase
            .from('pending_schedules')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) alert('Erro ao restaurar: ' + error.message);
        else {
            await fetchDeleted();
            onRestore();
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir permanentemente? Isso não pode ser desfeito.')) return;

        const { error } = await supabase
            .from('pending_schedules')
            .delete()
            .eq('id', id);

        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchDeleted();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col animate-scale-in">
                <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Trash2 size={20} className="text-red-500" />
                        Lixeira - Designações
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Carregando itens excluídos...</div>
                    ) : deletedItems.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                            <Trash2 size={48} className="mb-4 opacity-20" />
                            <p>Lixeira vazia</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-100 text-gray-600 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Processo</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Assunto</th>
                                    <th className="px-4 py-3">Data Exclusão</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {deletedItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{item.process_number}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs border ${item.type === 'hearing' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                                                {item.type === 'hearing' ? 'Audiência' : 'Perícia'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{item.subject}</td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {new Date(item.deleted_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-3 text-right flex justify-end gap-2">
                                            <Button size="sm" variant="outline-primary" onClick={() => handleRestore(item.id)} leftIcon={RefreshCw}>
                                                Restaurar
                                            </Button>
                                            <Button size="sm" variant="outline-danger" onClick={() => handlePermanentDelete(item.id)} leftIcon={Trash2}>
                                                Excluir
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
