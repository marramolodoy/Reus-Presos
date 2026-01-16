import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RogatoryLetter } from '../../types';

interface RogatoryFormProps {
    onClose: () => void;
    onSuccess: () => void;
    session: any;
    initialData?: RogatoryLetter;
    defaultDirection?: 'incoming' | 'outgoing';
}

export const RogatoryForm: React.FC<RogatoryFormProps> = ({ onClose, onSuccess, session, initialData, defaultDirection = 'incoming' }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        caseNumber: initialData?.caseNumber || '',
        direction: initialData?.direction || defaultDirection,
        defendantName: initialData?.defendantName || '',
        originCourt: initialData?.originCourt || '',
        type: initialData?.type || 'criminal',
        receivedDate: initialData?.receivedDate || new Date().toISOString().split('T')[0],
        deadlineDate: initialData?.deadlineDate || '',
        status: initialData?.status || 'pending',
        obs: initialData?.obs || '',
        purpose: initialData?.purpose || '',
        hasHearing: initialData?.hasHearing || false,
        hearingDate: initialData?.hearingDate ? (() => {
            const date = new Date(initialData.hearingDate);
            const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
            return localDate.toISOString().slice(0, 16);
        })() : '',
        isPrisoner: initialData?.isPrisoner || false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                case_number: formData.caseNumber,
                direction: formData.direction,
                defendant_name: formData.defendantName,
                origin_court: formData.originCourt,
                type: formData.type,
                received_date: formData.receivedDate,
                deadline_date: formData.deadlineDate || null,
                status: formData.status,
                obs: formData.obs,
                purpose: formData.purpose,
                has_hearing: formData.hasHearing,
                hearing_date: formData.hasHearing && formData.hearingDate ? new Date(formData.hearingDate).toISOString() : null,
                is_prisoner: formData.type === 'criminal' ? formData.isPrisoner : false,
                user_id: session.user.id
            };

            if (initialData) {
                const { error } = await supabase
                    .from('rogatory_letters')
                    .update(payload)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('rogatory_letters')
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
                    <h3 className="font-bold text-lg text-gray-800">{initialData ? 'Editar Carta Precatória' : 'Nova Carta Precatória'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Direction Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, direction: 'incoming' })}
                            className={`flex-1 text-sm py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${formData.direction === 'incoming' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Recebida
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, direction: 'outgoing' })}
                            className={`flex-1 text-sm py-2 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${formData.direction === 'outgoing' ? 'bg-white shadow text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Enviada
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Processo Origem</label>
                            <input
                                type="text"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.caseNumber}
                                onChange={e => setFormData({ ...formData, caseNumber: e.target.value })}
                                placeholder="0000000-00.0000.0.00.0000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'criminal' })}
                                    className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${formData.type === 'criminal' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Criminal
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'civil' })}
                                    className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${formData.type === 'civil' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Cível
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome (Réu ou Partes)</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.defendantName}
                            onChange={e => setFormData({ ...formData, defendantName: e.target.value })}
                            placeholder="Fulano de Tal"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {formData.direction === 'incoming' ? 'Juízo Deprecante (Origem)' : 'Juízo Deprecado (Destino)'}
                        </label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.originCourt}
                            onChange={e => setFormData({ ...formData, originCourt: e.target.value })}
                            placeholder="Comarca de Belém/PA"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {formData.direction === 'incoming' ? 'Data Recebimento' : 'Data de Envio'}
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.receivedDate}
                                onChange={e => {
                                    const newDate = e.target.value;
                                    const updates: any = { receivedDate: newDate };

                                    // Auto-calculate 90 days for outgoing letters
                                    if (formData.direction === 'outgoing' && newDate) {
                                        const date = new Date(newDate);
                                        date.setDate(date.getDate() + 90);
                                        updates.deadlineDate = date.toISOString().split('T')[0];
                                    }

                                    setFormData({ ...formData, ...updates });
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {formData.direction === 'incoming' ? 'Prazo Cumprimento' : 'Cobrar Andamento (90 dias)'}
                            </label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                                value={formData.deadlineDate}
                                onChange={e => setFormData({ ...formData, deadlineDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                        <textarea
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none h-20 resize-none"
                            value={formData.obs}
                            onChange={e => setFormData({ ...formData, obs: e.target.value })}
                            placeholder="Instruções específicas..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finalidade</label>
                        <input
                            type="text"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.purpose}
                            onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                            placeholder="Ex: Intimação de Audiência, Oitiva de Testemunha..."
                        />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-3">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={formData.hasHearing}
                                    onChange={e => setFormData({ ...formData, hasHearing: e.target.checked })}
                                />
                                <span className="text-sm font-medium text-gray-700">Tem Audiência Designada?</span>
                            </label>

                            {formData.hasHearing && (
                                <input
                                    type="datetime-local"
                                    className="p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                                    value={formData.hearingDate}
                                    onChange={e => setFormData({ ...formData, hearingDate: e.target.value })}
                                />
                            )}
                        </div>

                        {formData.type === 'criminal' && (
                            <label className="flex items-center gap-2 cursor-pointer border-t border-gray-200 pt-3">
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    checked={formData.isPrisoner}
                                    onChange={e => setFormData({ ...formData, isPrisoner: e.target.checked })}
                                />
                                <span className="text-sm font-bold text-red-700">RÉU PRESO (Destacar)</span>
                            </label>
                        )}
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
                            {loading ? 'Salvando...' : 'Salvar Carta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
