import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Trash2, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Note } from './NotesBoard';

interface NotesTrashModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: any;
    onRestore: () => void;
}

export const NotesTrashModal: React.FC<NotesTrashModalProps> = ({ isOpen, onClose, session, onRestore }) => {
    const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDeletedNotes = async () => {
        if (!session) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('sticky_notes')
            .select('*')
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar lixeira:', error);
        } else if (data) {
            setDeletedNotes(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchDeletedNotes();
        }
    }, [isOpen, session]);

    const handleRestore = async (id: string) => {
        const { error } = await supabase
            .from('sticky_notes')
            .update({ deleted_at: null })
            .eq('id', id);

        if (error) {
            alert('Erro ao restaurar: ' + error.message);
            if (error) {
                alert('Erro ao restaurar: ' + error.message);
            } else {
                setDeletedNotes(prev => prev.filter(n => n.id !== id));
                onRestore();
            }
        };

        const handleDeletePermanently = async (id: string) => {
            if (!confirm('ATENÇÃO: Isso excluirá a nota permanentemente. Deseja continuar?')) return;

            const { error } = await supabase
                .from('sticky_notes')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Erro ao excluir: ' + error.message);
            } else {
            }
        };

        const handleEmptyTrash = async () => {
            if (!confirm('ATENÇÃO: Isso excluirá TODOS os itens da lixeira PERMANENTEMENTE. Deseja continuar?')) return;

            setLoading(true);

            const { error } = await supabase
                .from('sticky_notes')
                .delete()
                .not('deleted_at', 'is', null);

            if (error) {
                alert('Erro ao esvaziar lixeira: ' + error.message);
            } else {
                setDeletedNotes([]);
            }
            setLoading(false);
        };

        const filteredNotes = deletedNotes.filter(n =>
            n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            n.content.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-stone-100 border-b border-stone-200 p-4 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-stone-800 flex items-center gap-2">
                            <Trash2 size={20} /> Lixeira do Mural
                        </h3>
                        <div className="flex items-center gap-2">
                            {deletedNotes.length > 0 && (
                                <button
                                    onClick={handleEmptyTrash}
                                    className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 font-bold flex items-center gap-1 border border-red-200 transition-colors"
                                >
                                    <Trash2 size={14} /> Esvaziar Lixeira
                                </button>
                            )}
                            <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 bg-white border-b">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Pesquisar notas excluídas..."
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-stone-200 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-stone-50">
                        {loading ? (
                            <div className="flex justify-center items-center h-full text-gray-500 gap-2">
                                <span className="animate-spin">⌛</span> Carregando...
                            </div>
                        ) : filteredNotes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Trash2 size={48} className="mb-2 opacity-50" />
                                <p>Lixeira vazia</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredNotes.map(note => (
                                    <div key={note.id} className={`p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between h-[200px] ${note.color.startsWith('bg-') ? note.color : 'bg-white'}`} style={!note.color.startsWith('bg-') ? { backgroundColor: note.color } : undefined}>
                                        <div>
                                            <h4 className="font-bold text-gray-800 truncate mb-2">{note.title}</h4>
                                            <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">{note.content}</p>
                                        </div>
                                        <div className="flex justify-between items-end mt-2 pt-2 border-t border-black/5">
                                            <span className="text-xs text-black/50 font-mono">
                                                Excluída: {note.deleted_at ? new Date(note.deleted_at).toLocaleDateString() : '-'}
                                            </span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleRestore(note.id)}
                                                    className="p-1.5 text-green-700 hover:bg-green-100/50 rounded tooltip bg-white/50"
                                                    title="Restaurar"
                                                >
                                                    <RefreshCw size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePermanently(note.id)}
                                                    className="p-1.5 text-red-700 hover:bg-red-100/50 rounded tooltip bg-white/50"
                                                    title="Excluir Permanentemente"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
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
