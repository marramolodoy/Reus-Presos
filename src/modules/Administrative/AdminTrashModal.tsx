import React, { useState, useEffect } from 'react';
import { X, Trash2, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdministrativeDocument } from '../../types';

interface AdminTrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onRestore: () => void; // Refresh parent list
}

export const AdminTrashModal: React.FC<AdminTrashModalProps> = ({ isOpen, onClose, session, onRestore }) => {
    const [deletedDocs, setDeletedDocs] = useState<AdministrativeDocument[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchDeletedDocs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('administrative_documents')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Error fetching trash:', error);
        } else {
            setDeletedDocs(data.map((d: any) => ({
                id: d.id,
                number: d.number,
                subject: d.subject,
                date: d.date,
                issuer: d.issuer,
                documentType: d.document_type,
                filePath: d.file_path,
                deletedAt: d.deleted_at,
                user_id: d.user_id
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchDeletedDocs();
        }
    }, [isOpen]);

    const handleRestore = async (id: string) => {
        if (!confirm('Deseja restaurar este documento?')) return;

        const { error } = await supabase
            .from('administrative_documents')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) {
            alert('Erro ao restaurar: ' + error.message);
        } else {
            fetchDeletedDocs();
            onRestore();
        }
    };

    const handlePermanentDelete = async (doc: AdministrativeDocument) => {
        if (!confirm('ATENÇÃO: Isso excluirá o documento PERMANENTEMENTE. Deseja continuar?')) return;

        // Delete file from storage if exists
        if (doc.filePath) {
            await supabase.storage.from('documents').remove([doc.filePath]);
        }

        // Delete record
        const { error } = await supabase
            .from('administrative_documents')
            .delete()
            .eq('id', doc.id);

        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
        }
    };

    const handleEmptyTrash = async () => {
        if (!confirm('ATENÇÃO: Isso excluirá TODOS os itens da lixeira PERMANENTEMENTE e libera espaço no sistema. Deseja continuar?')) return;

        setLoading(true);

        // Fetch files to delete first
        const { data: filesToDelete } = await supabase
            .from('administrative_documents')
            .select('file_path')
            .not('deleted_at', 'is', null)
            .not('file_path', 'is', null);

        // Delete files from storage
        if (filesToDelete && filesToDelete.length > 0) {
            const paths = filesToDelete.map(d => d.file_path).filter((p): p is string => !!p);
            if (paths.length > 0) {
                await supabase.storage.from('documents').remove(paths);
            }
        }

        // Delete records
        const { error } = await supabase
            .from('administrative_documents')
            .delete()
            .not('deleted_at', 'is', null);

        if (error) {
            alert('Erro ao esvaziar lixeira: ' + error.message);
        } else {
            fetchDeletedDocs();
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-red-50 border-b border-red-100 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                        <Trash2 size={20} /> Lixeira (Itens Excluídos)
                    </h3>
                    <div className="flex items-center gap-2">
                        {deletedDocs.length > 0 && (
                            <button
                                onClick={handleEmptyTrash}
                                className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 font-bold flex items-center gap-1 border border-red-200 transition-colors"
                            >
                                <Trash2 size={14} /> Esvaziar Lixeira
                            </button>
                        )}
                        <button onClick={onClose} className="text-red-400 hover:text-red-600 p-1">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-full text-gray-400">Carregando...</div>
                    ) : deletedDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                            <Trash2 size={48} className="opacity-20" />
                            <p>Lixeira vazia</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {deletedDocs.map(doc => (
                                <div key={doc.id} className="bg-white border hover:border-red-200 rounded-lg p-4 flex justify-between items-center shadow-sm transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800">#{doc.number}</span>
                                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 uppercase">{doc.documentType}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${doc.issuer === 'Gabinete' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {doc.issuer}
                                                </span>
                                            </div>
                                            <h4 className="text-gray-900 font-medium">{doc.subject}</h4>
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                <Trash2 size={10} /> Excluído em: {doc.deletedAt ? new Date(doc.deletedAt).toLocaleDateString() : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleRestore(doc.id)}
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg tooltip"
                                            title="Restaurar"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                        <button
                                            onClick={() => handlePermanentDelete(doc)}
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
