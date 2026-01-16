import React, { useState, useEffect } from 'react';
import { Copy, X } from 'lucide-react';
import { SeiRequest } from '../../types';

interface SeiReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    seiRequest: SeiRequest | null;
}

export const SeiReminderModal: React.FC<SeiReminderModalProps> = ({ isOpen, onClose, seiRequest }) => {
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (seiRequest) {
            setMessage(`Olá ${seiRequest.responsibleServer}, solicitamos informações sobre o andamento do Processo SEI nº ${seiRequest.processNumber} (${seiRequest.subject}), que se encontra sem movimentação há mais de 30 dias.`);
        }
    }, [seiRequest]);

    const handleCopy = () => {
        navigator.clipboard.writeText(message);
        alert("Mensagem copiada para a área de transferência!");
        onClose();
    };

    if (!isOpen || !seiRequest) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">Gerar Cobrança</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500">
                        Edite a mensagem antes de copiar.
                    </p>
                    <textarea
                        className="w-full h-40 p-3 border rounded-lg focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-700 leading-relaxed"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleCopy}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm font-medium"
                        >
                            <Copy size={16} />
                            Copiar Mensagem
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
