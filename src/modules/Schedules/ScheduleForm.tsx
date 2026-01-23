
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { PendingSchedule, PendingScheduleFormData } from '../../types';

const formatForInput = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

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

        scheduledDate: '',
        schedulingStatus: 'scheduled',
        completionStatus: 'pending',
        tags: [],
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
                scheduledDate: formatForInput(initialData.scheduledDate),
                schedulingStatus: initialData.schedulingStatus || 'scheduled',
                completionStatus: initialData.completionStatus || 'pending',
                tags: initialData.tags || [],
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
        const finalData = { ...formData };

        // Fix Timezone: Convert local input string to ISO UTC string
        if (formData.scheduledDate) {
            const localDate = new Date(formData.scheduledDate);
            finalData.scheduledDate = localDate.toISOString();
        }

        onSubmit(finalData);
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

                {/* Tags Selection */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {['Réu Preso', 'Menor', 'Idoso', 'Urgente'].map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => {
                                const currentTags = formData.tags || [];
                                const newTags = currentTags.includes(tag)
                                    ? currentTags.filter(t => t !== tag)
                                    : [...currentTags, tag];
                                setFormData({ ...formData, tags: newTags });
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${formData.tags?.includes(tag)
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                } transition-colors`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                {/* Scheduling Status (Only for Hearings?) - User said "Nas audiências". For expertise maybe similar? Let's assume both for flexibility or default to scheduled. */}
                <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Situação da Audiência *</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="schedulingStatus"
                                checked={formData.schedulingStatus === 'scheduled'}
                                onChange={() => setFormData({ ...formData, schedulingStatus: 'scheduled' })}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Audiência Designada</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="schedulingStatus"
                                checked={formData.schedulingStatus === 'to_be_scheduled'}
                                onChange={() => setFormData({ ...formData, schedulingStatus: 'to_be_scheduled', scheduledDate: '' })}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">A Designar</span>
                        </label>
                    </div>
                </div>

                <div className="mb-2 bg-gray-50 p-2 rounded border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Situação do Cumprimento (Cor na Agenda)</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="completionStatus"
                                checked={formData.completionStatus === 'pending' || !formData.completionStatus}
                                onChange={() => setFormData({ ...formData, completionStatus: 'pending' })}
                                className="text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-red-700 font-medium">Não Cumprida (Vermelho)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="completionStatus"
                                checked={formData.completionStatus === 'partial'}
                                onChange={() => setFormData({ ...formData, completionStatus: 'partial' })}
                                className="text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-sm text-orange-600 font-medium">Parcial (Laranja)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="completionStatus"
                                checked={formData.completionStatus === 'completed'}
                                onChange={() => setFormData({ ...formData, completionStatus: 'completed' })}
                                className="text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm text-green-700 font-medium">Cumprida (Verde)</span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {formData.type === 'hearing' ? 'Data da Audiência' : 'Data da Perícia'}
                            {formData.schedulingStatus === 'scheduled' && formData.type === 'hearing' && ' *'}
                        </label>
                        <input
                            type="datetime-local"
                            required={formData.schedulingStatus === 'scheduled' && formData.type === 'hearing'}
                            disabled={formData.schedulingStatus === 'to_be_scheduled'}
                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none ${formData.schedulingStatus === 'to_be_scheduled' ? 'bg-gray-100 text-gray-400' : ''}`}
                            value={formData.scheduledDate || ''}
                            onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Últ. Movimentação (Opcional)</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-200 outline-none"
                            value={formData.lastMovementDate || ''}
                            onChange={e => setFormData({ ...formData, lastMovementDate: e.target.value })}
                        />
                    </div>
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
