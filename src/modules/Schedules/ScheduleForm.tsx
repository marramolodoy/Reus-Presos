
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { PendingSchedule, PendingScheduleFormData } from '../../types';

interface ScheduleFormProps {
    initialData?: PendingSchedule;
    initialType: 'hearing' | 'expertise';
    onSubmit: (data: PendingScheduleFormData) => void;
    onCancel: () => void;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({ initialData, initialType, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<PendingScheduleFormData>({
        processNumber: '',
        lastMovementDate: '',
        subject: '',
        obs: '',
        type: initialType,
        hearingType: 'Conciliação',
        competence: 'Juizado',
        expertiseType: '',
        responsibleServer: '' // Not used but keeps TS happy if extended
    } as any);

    useEffect(() => {
        if (initialData) {
            setFormData({
                processNumber: initialData.processNumber,
                lastMovementDate: initialData.lastMovementDate,
                subject: initialData.subject,
                obs: initialData.obs,
                type: initialData.type,
                hearingType: initialData.hearingType,
                competence: initialData.competence,
                expertiseType: initialData.expertiseType
            } as any);
        } else {
            setFormData(prev => ({ ...prev, type: initialType }));
        }
    }, [initialData, initialType]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className={`px-4 py-3 border-b flex justify-between items-center ${initialType === 'hearing' ? 'bg-cyan-50' : 'bg-purple-50'}`}>
                <h3 className={`font-bold ${initialType === 'hearing' ? 'text-cyan-800' : 'text-purple-800'}`}>
                    {initialData ? 'Editar Designação' : (initialType === 'hearing' ? 'Nova Audiência' : 'Nova Perícia')}
                </h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número do Processo *</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.processNumber}
                            onChange={e => setFormData({ ...formData, processNumber: e.target.value })}
                            placeholder="0000000-00..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Competência *</label>
                        <select
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                            value={formData.competence}
                            onChange={e => setFormData({ ...formData, competence: e.target.value as any })}
                        >
                            <option value="Juizado">Juizado</option>
                            <option value="Cível">Cível</option>
                            <option value="Criminal">Criminal</option>
                            <option value="Delegada">Competência Delegada</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Últ. Movimentação *</label>
                    <input
                        type="date"
                        required
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none"
                        value={formData.lastMovementDate}
                        onChange={e => setFormData({ ...formData, lastMovementDate: e.target.value })}
                    />
                </div>

                {formData.type === 'hearing' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Audiência *</label>
                        <select
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                            value={formData.hearingType}
                            onChange={e => setFormData({ ...formData, hearingType: e.target.value as any })}
                        >
                            <option value="Conciliação">Conciliação</option>
                            <option value="Preliminar">Preliminar</option>
                            <option value="AIJ">AIJ (Instrução e Julgamento)</option>
                            <option value="Continuação">Continuação</option>
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Perícia *</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.expertiseType || ''}
                            onChange={e => setFormData({ ...formData, expertiseType: e.target.value })}
                            placeholder="Ex: Médica, Engenharia, Social..."
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assunto *</label>
                    <input
                        type="text"
                        required
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none"
                        value={formData.subject}
                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Ex: Indenização por Danos Morais"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações (Testemunhas, Réus, etc)</label>
                    <textarea
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none"
                        rows={3}
                        value={formData.obs}
                        onChange={e => setFormData({ ...formData, obs: e.target.value })}
                        placeholder="Detalhes adicionais..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                        Cancelar
                    </button>
                    <button type="submit" className={`px-4 py-2 text-sm font-medium text-white rounded-md flex items-center gap-2 ${initialType === 'hearing' ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-purple-600 hover:bg-purple-700'}`}>
                        <Save size={16} />
                        Salvar
                    </button>
                </div>
            </form>
        </div>
    );
};
