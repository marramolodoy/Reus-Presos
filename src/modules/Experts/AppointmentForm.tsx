import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Expert, ExpertAppointment, ExpertAppointmentFormData } from '../../types';

interface AppointmentFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ExpertAppointmentFormData) => void;
    initialData?: ExpertAppointment | null;
    experts: Expert[]; // Lista de peritos cadastrados (apenas os ativos) para o select
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({ isOpen, onClose, onSave, initialData, experts }) => {
    const [formData, setFormData] = useState<ExpertAppointmentFormData>({
        expert_id: '',
        process_number: '',
        appointment_date: new Date().toISOString().split('T')[0],
        status: 'Nomeado',
        fee_amount: 0,
        fee_status: 'Não Pago',
        obs: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                expert_id: initialData.expert_id,
                process_number: initialData.process_number,
                appointment_date: initialData.appointment_date,
                status: initialData.status,
                fee_amount: initialData.fee_amount || 0,
                fee_status: initialData.fee_status,
                obs: initialData.obs || '',
            });
        } else {
            setFormData({
                expert_id: '',
                process_number: '',
                appointment_date: new Date().toISOString().split('T')[0],
                status: 'Nomeado',
                fee_amount: 0,
                fee_status: 'Não Pago',
                obs: '',
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-800">
                        {initialData ? 'Editar Nomeação' : 'Nova Nomeação de Perito'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto">
                    <form id="appointment-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Perito *</label>
                                <select
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                    value={formData.expert_id}
                                    onChange={(e) => setFormData({ ...formData, expert_id: e.target.value })}
                                >
                                    <option value="" disabled>Selecione um perito ativo...</option>
                                    {experts.map(expert => (
                                        <option key={expert.id} value={expert.id}>
                                            {expert.name} ({expert.specialty})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nº do Processo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="0000000-00.0000.0.00.0000"
                                    className="w-full p-2 border border-gray-300 rounded font-mono text-sm focus:ring-2 focus:ring-purple-500"
                                    value={formData.process_number}
                                    onChange={(e) => setFormData({ ...formData, process_number: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Nomeação *</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                    value={formData.appointment_date}
                                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status da Perícia *</label>
                                <select
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                >
                                    <option value="Nomeado">Nomeado</option>
                                    <option value="Aceitou o Encargo">Aceitou o Encargo</option>
                                    <option value="Aguardando Laudo">Aguardando Laudo</option>
                                    <option value="Laudo Entregue">Laudo Entregue</option>
                                    <option value="Suspenso">Suspenso</option>
                                    <option value="Destituído">Destituído</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Honorários (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                    value={formData.fee_amount}
                                    onChange={(e) => setFormData({ ...formData, fee_amount: parseFloat(e.target.value) })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Situação Pagamento *</label>
                                <select
                                    required
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
                                    value={formData.fee_status}
                                    onChange={(e) => setFormData({ ...formData, fee_status: e.target.value as any })}
                                >
                                    <option value="Não Pago">Não Pago / Aguardando</option>
                                    <option value="Parcial">Parcial</option>
                                    <option value="Pago">Pago</option>
                                    <option value="AJG">AJG (Tribunal)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Ex: Quesitos do MP)</label>
                            <textarea
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                                rows={3}
                                value={formData.obs}
                                onChange={(e) => setFormData({ ...formData, obs: e.target.value })}
                            />
                        </div>
                    </form>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="appointment-form"
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                    >
                        Salvar Nomeação
                    </button>
                </div>
            </div>
        </div>
    );
};
