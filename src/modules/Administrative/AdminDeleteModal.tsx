import React, { useState } from 'react';
import { AlertTriangle, Trash2, ArrowDown10, PauseCircle } from 'lucide-react';
import { AdministrativeDocument } from '../../types';

interface AdminDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (action: 'gap' | 'recalculate') => void;
    document: AdministrativeDocument | null;
}

export const AdminDeleteModal: React.FC<AdminDeleteModalProps> = ({ isOpen, onClose, onConfirm, document }) => {
    const [action, setAction] = useState<'gap' | 'recalculate'>('gap');

    if (!isOpen || !document) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-red-50 border-b border-red-100 p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                        <Trash2 size={20} /> Confirmar Exclusão
                    </h3>
                </div>

                <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-red-100 text-red-600 rounded-full shrink-0">
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 text-lg">Excluir Documento #{document.number}?</h4>
                            <p className="text-gray-600 mt-1">
                                O documento <strong>{document.documentType} - {document.issuer}</strong> será movido para a lixeira.
                            </p>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
                        <h5 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Como tratar a numeração?</h5>

                        <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${action === 'gap' ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'hover:bg-gray-100 border-gray-200'}`}>
                            <input
                                type="radio"
                                name="deleteAction"
                                checked={action === 'gap'}
                                onChange={() => setAction('gap')}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 font-bold text-gray-800">
                                    <PauseCircle size={18} className="text-orange-500" />
                                    Manter Lacuna (Recomendado)
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    O número <strong>#{document.number}</strong> ficará vago.
                                    Você poderá reutilizá-lo ao criar um novo documento depois.
                                    A numeração dos outros documentos não muda.
                                </p>
                            </div>
                        </label>

                        <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${action === 'recalculate' ? 'bg-white border-blue-500 ring-1 ring-blue-500 shadow-sm' : 'hover:bg-gray-100 border-gray-200'}`}>
                            <input
                                type="radio"
                                name="deleteAction"
                                checked={action === 'recalculate'}
                                onChange={() => setAction('recalculate')}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 font-bold text-gray-800">
                                    <ArrowDown10 size={18} className="text-blue-500" />
                                    Recalcular Sequência
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Todos os documentos posteriores (da mesma origem/tipo) terão seus números reduzidos em 1.
                                    <br />Ex: O nº {parseInt(document.number) + 1} vira {document.number}.
                                    <span className="block mt-1 font-bold text-red-500">Atenção: Isso altera o histórico de documentos existentes!</span>
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">
                        Cancelar
                    </button>
                    <button
                        onClick={() => onConfirm(action)}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm shadow-sm font-bold"
                    >
                        <Trash2 size={16} /> Confirmar Exclusão
                    </button>
                </div>
            </div>
        </div>
    );
};
