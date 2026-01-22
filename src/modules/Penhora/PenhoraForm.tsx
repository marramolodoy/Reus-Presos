import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { PenhoraOrder, PenhoraOrderFormData } from '../../types';
import { Button } from '../../components/ui/Button';

interface PenhoraFormProps {
    initialData?: PenhoraOrder;
    defaultType?: PenhoraOrder['type'];
    onSubmit: (data: PenhoraOrderFormData) => void;
    onCancel: () => void;
}

const TYPES = ['Sisbajud', 'Renajud', 'Infojud', 'Siel', 'Serasajud', 'CNIB', 'SNIPER'] as const;

export const PenhoraForm: React.FC<PenhoraFormProps> = ({ initialData, defaultType, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<PenhoraOrderFormData>({
        name: '',
        caseNumber: '',
        type: defaultType || 'Sisbajud',
        value: undefined,
        lastUpdateDate: '',
        status: 'Aguardando Protocolo',
        isTeimosinha: false,
        protocolDate: '',
        deadlineDate: '',
        restrictionType: undefined,
        obs: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                caseNumber: initialData.caseNumber,
                type: initialData.type,
                value: initialData.value,
                lastUpdateDate: initialData.lastUpdateDate ? new Date(initialData.lastUpdateDate).toISOString().split('T')[0] : '',
                status: initialData.status,
                isTeimosinha: initialData.isTeimosinha,
                protocolDate: initialData.protocolDate ? new Date(initialData.protocolDate).toISOString().split('T')[0] : '',
                deadlineDate: initialData.deadlineDate ? new Date(initialData.deadlineDate).toISOString().split('T')[0] : '',
                restrictionType: initialData.restrictionType,
                obs: initialData.obs || ''
            });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 md:p-6 bg-white rounded-lg w-full max-w-2xl mx-auto shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                    {initialData ? 'Editar Ordem de Penhora' : 'Nova Ordem de Penhora'}
                </h2>
                <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-500 hover:text-gray-700">
                    <X size={24} />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Parte</label>
                    <input
                        type="text"
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                {/* Processo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Processo</label>
                    <input
                        type="text"
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.caseNumber}
                        onChange={e => setFormData({ ...formData, caseNumber: e.target.value })}
                    />
                </div>

                {/* Tipo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    >
                        {TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* SISBAJUD FIELDS */}
                {formData.type === 'Sisbajud' && (
                    <div className="col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                        <h3 className="col-span-2 text-sm font-bold text-blue-800 border-b border-blue-200 pb-2 mb-2">Detalhes Sisbajud</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full pl-8 p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                                    value={formData.value || ''}
                                    onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data Últ. Atualização</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                                value={formData.lastUpdateDate || ''}
                                onChange={e => setFormData({ ...formData, lastUpdateDate: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Situação</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="Aguardando Protocolo"
                                        checked={formData.status === 'Aguardando Protocolo'}
                                        onChange={() => setFormData({ ...formData, status: 'Aguardando Protocolo' })}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Aguardando Protocolo</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="Aguardando Resposta"
                                        checked={formData.status === 'Aguardando Resposta'}
                                        onChange={() => setFormData({ ...formData, status: 'Aguardando Resposta' })}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">Aguardando Resposta</span>
                                </label>
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded border border-blue-200 shadow-sm">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    checked={formData.isTeimosinha || false}
                                    onChange={e => setFormData({ ...formData, isTeimosinha: e.target.checked })}
                                />
                                <span className="text-sm font-medium text-gray-900">Teimosinha (Repetição Automática)</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data Protocolo</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                                value={formData.protocolDate || ''}
                                onChange={e => setFormData({ ...formData, protocolDate: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Limite Prazo</label>
                            <input
                                type="date"
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                                value={formData.deadlineDate || ''}
                                onChange={e => setFormData({ ...formData, deadlineDate: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {/* RENAJUD FIELDS */}
                {formData.type === 'Renajud' && (
                    <div className="col-span-2 bg-orange-50 p-4 rounded-lg border border-orange-100 grid grid-cols-1 gap-4 animate-in fade-in">
                        <h3 className="text-sm font-bold text-orange-800 border-b border-orange-200 pb-2 mb-2">Detalhes Renajud</h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Restrição</label>
                            <div className="flex flex-wrap gap-4">
                                {['Transferência', 'Licenciamento', 'Circulação'].map(r => (
                                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="restrictionType"
                                            value={r}
                                            checked={formData.restrictionType === r}
                                            onChange={() => setFormData({ ...formData, restrictionType: r })}
                                            className="text-orange-600 focus:ring-orange-500"
                                        />
                                        <span className="text-sm text-gray-700">{r}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* COMMON OBS */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        rows={3}
                        value={formData.obs}
                        onChange={e => setFormData({ ...formData, obs: e.target.value })}
                    />
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 pt-4 border-t">
                <Button variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
                    Cancelar
                </Button>
                <Button type="submit" variant="primary" leftIcon={Save} className="w-full sm:w-auto">
                    Salvar
                </Button>
            </div>
        </form>
    );
};
