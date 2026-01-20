
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { CriticalIssue, CriticalIssueFormData } from '../../types';

interface CriticalIssueFormProps {
    initialData?: CriticalIssue;
    onSubmit: (data: CriticalIssueFormData) => void;
    onCancel: () => void;
}

export const CriticalIssueForm: React.FC<CriticalIssueFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<CriticalIssueFormData>({
        processNumber: '',
        defendantName: '',
        lastMovementDate: '',
        reason: '',
        responsibleServer: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                processNumber: initialData.processNumber,
                defendantName: initialData.defendantName || '',
                lastMovementDate: initialData.lastMovementDate,
                reason: initialData.reason,
                responsibleServer: initialData.responsibleServer
            });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800">{initialData ? 'Editar Pendência' : 'Nova Pendência Crítica'}</h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Processo *</label>
                    <input
                        type="text"
                        required
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-200 outline-none"
                        value={formData.processNumber}
                        onChange={e => setFormData({ ...formData, processNumber: e.target.value })}
                        placeholder="0000000-00.0000.8.14.0000"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Réu (Opcional)</label>
                    <input
                        type="text"
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-200 outline-none"
                        value={formData.defendantName}
                        onChange={e => setFormData({ ...formData, defendantName: e.target.value })}
                        placeholder="Nome do réu relacionado"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Últ. Movimentação *</label>
                        <input
                            type="date"
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-200 outline-none"
                            value={formData.lastMovementDate}
                            onChange={e => setFormData({ ...formData, lastMovementDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Servidor Responsável *</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-200 outline-none"
                            value={formData.responsibleServer}
                            onChange={e => setFormData({ ...formData, responsibleServer: e.target.value })}
                            placeholder="Nome do servidor"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Pendência *</label>
                    <textarea
                        required
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-200 outline-none"
                        rows={3}
                        value={formData.reason}
                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Descreva por que impede o cumprimento ou qual a pendência..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                        Cancelar
                    </button>
                    <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 flex items-center gap-2">
                        <Save size={16} />
                        Salvar
                    </button>
                </div>
            </form>
        </div>
    );
};
