import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SeiRequest } from '../../types';

interface SeiRequestFormProps {
    onClose: () => void;
    onSuccess: () => void;
    session: any;
    initialData?: SeiRequest;
}

export const SeiRequestForm: React.FC<SeiRequestFormProps> = ({ onClose, onSuccess, session, initialData }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        processNumber: initialData?.processNumber || '',
        subject: initialData?.subject || '',
        creationDate: initialData?.creationDate ? new Date(initialData.creationDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        lastMovementDate: initialData?.lastMovementDate ? new Date(initialData.lastMovementDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        currentSector: initialData?.currentSector || '',
        responsibleServer: initialData?.responsibleServer || '',
        status: initialData?.status || 'Active'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                process_number: formData.processNumber,
                subject: formData.subject,
                creation_date: formData.creationDate,
                last_movement_date: formData.lastMovementDate,
                current_sector: formData.currentSector,
                responsible_server: formData.responsibleServer,
                status: formData.status,
                user_id: session.user.id
            };

            if (initialData) {
                const { error } = await supabase
                    .from('sei_requests')
                    .update(payload)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sei_requests')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">{initialData ? 'Editar Pedido SEI' : 'Novo Pedido SEI'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número do Processo SEI</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.processNumber}
                            onChange={e => setFormData({ ...formData, processNumber: e.target.value })}
                            placeholder="00000.000000/2026-00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                            placeholder="Ex: Solicitação de Material, Férias..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Criação</label>
                            <input
                                type="date"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.creationDate}
                                onChange={e => setFormData({ ...formData, creationDate: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Última Movimentação</label>
                            <input
                                type="date"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.lastMovementDate}
                                onChange={e => setFormData({ ...formData, lastMovementDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Setor Atual</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.currentSector}
                                onChange={e => setFormData({ ...formData, currentSector: e.target.value })}
                                placeholder="Ex: Gabinete, RH..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Servidor Responsável</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.responsibleServer}
                                onChange={e => setFormData({ ...formData, responsibleServer: e.target.value })}
                                placeholder="Nome do servidor"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-2 border-t mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm font-medium disabled:opacity-50"
                        >
                            <Save size={16} />
                            {loading ? 'Salvando...' : 'Salvar Pedido'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
