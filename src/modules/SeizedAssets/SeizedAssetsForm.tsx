import React, { useState } from 'react';
import { X, Save, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SeizedAsset } from '../../types';
import { useUserRole } from '../../hooks/useUserRole';

interface SeizedAssetsFormProps {
    onClose: () => void;
    onSuccess: () => void;
    session: any;
    initialData?: SeizedAsset;
}

export const SeizedAssetsForm: React.FC<SeizedAssetsFormProps> = ({ onClose, onSuccess, session, initialData }) => {
    const { teamOwnerId, unitId } = useUserRole(session);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        processNumber: initialData?.processNumber || '',
        partyName: initialData?.partyName || '',
        possibleOwner: initialData?.possibleOwner || '',
        description: initialData?.description || '',
        location: initialData?.location || '',
        destinationStatus: initialData?.destinationStatus || 'Aguardando',
        seizureDate: initialData?.seizureDate ? new Date(initialData.seizureDate).toISOString().split('T')[0] : '',
        hasCourtCase: initialData?.hasCourtCase !== undefined ? initialData.hasCourtCase : true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const dataToSave = {
                process_number: formData.hasCourtCase ? formData.processNumber : null,
                party_name: formData.partyName,
                possible_owner: formData.possibleOwner,
                description: formData.description,
                location: formData.location,
                destination_status: formData.destinationStatus,
                seizure_date: formData.seizureDate || null,
                has_court_case: formData.hasCourtCase,
                user_id: teamOwnerId || session.user.id,
                unit_id: unitId
            };

            if (initialData) {
                const { error } = await supabase
                    .from('seized_assets')
                    .update(dataToSave)
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('seized_assets')
                    .insert([dataToSave]);
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
                    <h3 className="font-bold text-lg text-gray-800">{initialData ? 'Editar Bem Apreendido' : 'Novo Bem Apreendido'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                <Calendar size={14} /> Data da Apreensão
                            </label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                                value={formData.seizureDate}
                                onChange={e => setFormData({ ...formData, seizureDate: e.target.value })}
                            />
                        </div>
                        <div className="flex items-end pb-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 font-medium">
                                <input
                                    type="checkbox"
                                    checked={formData.hasCourtCase}
                                    onChange={e => setFormData({ ...formData, hasCourtCase: e.target.checked })}
                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                />
                                Já possui processo no PJe?
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Parte (Réu/Indiciado) *</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none uppercase"
                            value={formData.partyName}
                            onChange={e => setFormData({ ...formData, partyName: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={!formData.hasCourtCase ? 'opacity-50 pointer-events-none' : ''}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nº Processo</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                                value={formData.processNumber}
                                onChange={e => setFormData({ ...formData, processNumber: e.target.value })}
                                disabled={!formData.hasCourtCase}
                                placeholder={!formData.hasCourtCase ? 'Sem processo' : ''}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Possível Proprietário</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                                value={formData.possibleOwner}
                                onChange={e => setFormData({ ...formData, possibleOwner: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Bem *</label>
                        <textarea
                            required
                            rows={3}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Ex: Celular Samsung, Arma de fogo Taurus..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Localização *</label>
                            <input
                                type="text"
                                required
                                placeholder="Ex: Armário 1, Depósito..."
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status de Destinação</label>
                            <select
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none bg-white"
                                value={formData.destinationStatus}
                                onChange={e => setFormData({ ...formData, destinationStatus: e.target.value })}
                            >
                                <option value="Aguardando">Aguardando Destinação</option>
                                <option value="Encaminhado">Encaminhado</option>
                                <option value="Devolvido">Devolvido</option>
                                <option value="Doado">Doado</option>
                                <option value="Destruído">Destruído</option>
                                <option value="Leiloado">Leiloado</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-2">
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
                            className="bg-justice-600 text-white px-4 py-2 rounded-lg hover:bg-justice-700 flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
                        >
                            <Save size={16} />
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
