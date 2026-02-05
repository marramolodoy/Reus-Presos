import React, { useState, useEffect } from 'react';
import { X, Trash2, RefreshCw, Archive } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SeizedAsset } from '../../types';

interface SeizedAssetsTrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onRestore: () => void;
}

export const SeizedAssetsTrashModal: React.FC<SeizedAssetsTrashModalProps> = ({ isOpen, onClose, session, onRestore }) => {
    const [deletedAssets, setDeletedAssets] = useState<SeizedAsset[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchDeletedAssets = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('seized_assets')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Error fetching trash:', error);
        } else {
            setDeletedAssets((data || []).map((d: any) => ({
                id: d.id,
                processNumber: d.process_number,
                partyName: d.party_name,
                possibleOwner: d.possible_owner,
                description: d.description,
                location: d.location,
                destinationStatus: d.destination_status,
                user_id: d.user_id,
                deletedAt: d.deleted_at
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchDeletedAssets();
        }
    }, [isOpen]);

    const handleRestore = async (id: string) => {
        if (!confirm('Deseja restaurar este item?')) return;

        const { error } = await supabase
            .from('seized_assets')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) {
            alert('Erro ao restaurar: ' + error.message);
        } else {
            setDeletedAssets(prev => prev.filter(d => d.id !== id));
            onRestore();
        }
    };

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('ATENÇÃO: Isso excluirá o item PERMANENTEMENTE. Deseja continuar?')) return;

        const { error } = await supabase
            .from('seized_assets')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            setDeletedAssets(prev => prev.filter(d => d.id !== id));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-red-50 border-b border-red-100 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                        <Trash2 size={20} /> Lixeira (Itens Excluídos)
                    </h3>
                    <button onClick={onClose} className="text-red-400 hover:text-red-600 p-1">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-400">Carregando...</div>
                    ) : deletedAssets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                            <Trash2 size={48} className="opacity-20" />
                            <p>Lixeira vazia</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {deletedAssets.map(asset => (
                                <div key={asset.id} className="bg-white border hover:border-red-200 rounded-lg p-4 flex justify-between items-center shadow-sm transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                                            <Archive size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800">{asset.partyName}</h4>
                                            <p className="text-sm text-gray-600 line-clamp-1">{asset.description}</p>
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <Trash2 size={10} /> Excluído em: {asset.deletedAt ? new Date(asset.deletedAt).toLocaleDateString() : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleRestore(asset.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg tooltip"
                                            title="Restaurar"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                        <button
                                            onClick={() => handlePermanentDelete(asset.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg tooltip"
                                            title="Excluir Permanentemente"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
