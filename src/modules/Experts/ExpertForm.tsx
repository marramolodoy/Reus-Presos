import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Expert, ExpertFormData } from '../../types';

interface ExpertFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ExpertFormData) => void;
    initialData?: Expert | null;
}

export const ExpertForm: React.FC<ExpertFormProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<ExpertFormData>({
        name: '',
        specialty: '',
        contact: '',
        bank_info: '',
        is_active: true,
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                specialty: initialData.specialty,
                contact: initialData.contact || '',
                bank_info: initialData.bank_info || '',
                is_active: initialData.is_active,
            });
        } else {
            setFormData({
                name: '',
                specialty: '',
                contact: '',
                bank_info: '',
                is_active: true,
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">
                        {initialData ? 'Editar Perito' : 'Novo Perito'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    <form id="expert-form" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Perito *</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade *</label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Médico Psiquiatra, Engenheiro Civil..."
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                value={formData.specialty}
                                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Contato (Telefone/Email)</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                value={formData.contact}
                                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dados Bancários / CPF / CNPJ</label>
                            <textarea
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={2}
                                value={formData.bank_info}
                                onChange={(e) => setFormData({ ...formData, bank_info: e.target.value })}
                            />
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                                Perito Ativo (Disponível para receber nomeações)
                            </label>
                        </div>
                    </form>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="expert-form"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    );
};
