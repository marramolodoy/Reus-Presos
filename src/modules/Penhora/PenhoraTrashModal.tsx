import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';

interface PenhoraTrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onRestore: () => void;
}

export const PenhoraTrashModal: React.FC<PenhoraTrashModalProps> = ({ isOpen, onClose, session, onRestore }) => {
    const [deletedItems, setDeletedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDeleted = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('penhora_orders')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Error fetching trash:', error);
        } else {
            setDeletedItems(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) fetchDeleted();
    }, [isOpen]);

    const handleRestore = async (id: string, name: string) => {
        if (!confirm(`Restaurar "${name}"?`)) return;

        const { error } = await supabase
            .from('penhora_orders')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) {
            alert('Erro ao restaurar: ' + error.message);
        } else {
            await fetchDeleted();
            onRestore();
        }
    };

    const handlePermanentDelete = async (id: string, name: string) => {
        if (!confirm(`ATENÇÃO: Isso excluirá permanentemente "${name}". Continuar?`)) return;

        const { error } = await supabase
            .from('penhora_orders')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            await fetchDeleted();
        }
    };

    if (!isOpen) return null;

    const filteredItems = deletedItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.case_number.includes(searchTerm)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Trash2 className="text-red-500" />
                        Lixeira - Penhora
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisar itens excluídos..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-justice-200 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Carregando...</div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">Lixeira vazia.</div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Nome / Parte</th>
                                    <th className="px-4 py-3">Processo</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Excluído em</th>
                                    <th className="px-4 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                                        <td className="px-4 py-3 text-gray-600 font-mono">{item.case_number}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {new Date(item.deleted_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRestore(item.id, item.name)}
                                                    className="text-green-600 hover:bg-green-50"
                                                    title="Restaurar"
                                                >
                                                    <RefreshCw size={16} />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handlePermanentDelete(item.id, item.name)}
                                                    className="text-red-600 hover:bg-red-50"
                                                    title="Excluir Permanentemente"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                    <Button variant="secondary" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </div>
        </div>
    );
};
