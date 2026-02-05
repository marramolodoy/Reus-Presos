import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, AlertCircle } from 'lucide-react';
import { CivilCase, CivilCaseFormData, CivilCategory, UserProfile } from '../../types';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';

interface CivilFormProps {
    initialData?: CivilCase;
    defaultCategory?: CivilCategory;
    onSubmit: (data: CivilCaseFormData) => void;
    onCancel: () => void;
}

import { CIVIL_CATEGORIES } from '../../constants';

const CATEGORIES = CIVIL_CATEGORIES;

export const CivilForm: React.FC<CivilFormProps> = ({ initialData, defaultCategory, onSubmit, onCancel }) => {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);

    useEffect(() => {
        const fetchProfiles = async () => {
            // First get the team members
            const { data: teamMembers, error: teamError } = await supabase.rpc('get_my_team');

            if (teamError) {
                console.error('Error fetching team:', teamError);
                return;
            }

            const teamIds = (teamMembers || []).map((m: any) => m.user_id);

            if (teamIds.length > 0) {
                // Then fetch profiles only for these users
                const { data } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .in('user_id', teamIds);

                if (data) setProfiles(data);
            } else {
                setProfiles([]);
            }
        };
        fetchProfiles();
    }, []);

    const [formData, setFormData] = useState<CivilCaseFormData>({
        name: '',
        caseNumber: '',
        category: defaultCategory || 'Urgentes',
        entryDate: (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })(),
        lastMovementDate: '',
        lastReevaluationDate: '',
        deadlineDate: '',
        obs: '',
        isDelegated: false,
        expeditionStatus: undefined,
        responsibleServer: '',
        signatureServer: false,
        signatureMagistrate: false,
        subaccountId: '',
        isConcluded: false,
        concludedAt: null
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                caseNumber: initialData.caseNumber,
                category: initialData.category,
                entryDate: initialData.entryDate ? new Date(initialData.entryDate).toISOString().split('T')[0] : '',
                lastMovementDate: initialData.lastMovementDate ? new Date(initialData.lastMovementDate).toISOString().split('T')[0] : '',
                lastReevaluationDate: initialData.lastReevaluationDate ? new Date(initialData.lastReevaluationDate).toISOString().split('T')[0] : '',
                deadlineDate: initialData.deadlineDate ? new Date(initialData.deadlineDate).toISOString().split('T')[0] : '',
                obs: initialData.obs || '',
                isDelegated: initialData.isDelegated || false,
                expeditionStatus: initialData.expeditionStatus,
                responsibleServer: initialData.responsibleServer || '',
                signatureServer: initialData.signatureServer || false,
                signatureMagistrate: initialData.signatureMagistrate || false,
                subaccountId: initialData.subaccountId || '',
                isConcluded: initialData.isConcluded || false,
                concludedAt: initialData.concludedAt || null,
            });
        }
    }, [initialData]);

    // Auto-calculate deadline
    useEffect(() => {
        if (!initialData && formData.entryDate) {
            if (formData.category === 'Infracionais') {
                const entry = new Date(formData.entryDate);
                entry.setDate(entry.getDate() + 180);
                setFormData(prev => ({ ...prev, deadlineDate: entry.toISOString().split('T')[0] }));
            } else if (formData.category === 'Apreendidos') {
                const entry = new Date(formData.entryDate);
                entry.setDate(entry.getDate() + 45);
                setFormData(prev => ({ ...prev, deadlineDate: entry.toISOString().split('T')[0] }));
            }
        }
    }, [formData.category, formData.entryDate]);

    // Automate Alvarás Status based on signatures
    useEffect(() => {
        if (formData.category === 'Alvarás') {
            const hasServer = formData.signatureServer;
            const hasMagistrate = formData.signatureMagistrate;

            const newStatus = hasServer ? 'dispatched' : 'pending';
            const newIsConcluded = hasServer && hasMagistrate;
            const newConcludedAt = newIsConcluded ? (formData.concludedAt || new Date().toISOString()) : null;

            if (formData.expeditionStatus !== newStatus ||
                formData.isConcluded !== newIsConcluded ||
                formData.concludedAt !== newConcludedAt) {
                setFormData(prev => ({
                    ...prev,
                    expeditionStatus: newStatus as any,
                    isConcluded: newIsConcluded,
                    concludedAt: newConcludedAt
                }));
            }
        }
    }, [formData.signatureServer, formData.signatureMagistrate, formData.category]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSubmit = { ...formData };
        // Ensure pending status for RPV/Precatório if not set
        if ((dataToSubmit.category === 'RPV' || dataToSubmit.category === 'Precatório') && !dataToSubmit.expeditionStatus) {
            dataToSubmit.expeditionStatus = 'pending';
        }

        // Notification Logic
        // Check if responsible server changed or is new
        const initialResponsible = initialData?.responsibleServer;
        const newResponsible = dataToSubmit.responsibleServer;

        if (newResponsible && newResponsible !== initialResponsible) {
            const assignedProfile = profiles.find(p => p.name === newResponsible);
            if (assignedProfile) {
                // Send notification
                await supabase.from('notifications').insert({
                    user_id: assignedProfile.user_id,
                    title: 'Processo Atribuído',
                    message: `Você foi definido como responsável pelo processo ${dataToSubmit.caseNumber} (${dataToSubmit.name})`,
                    link: '/civil', // Ideally link to specific item
                    read: false
                });
            }
        }

        onSubmit(dataToSubmit);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 md:p-6 bg-white rounded-lg w-full max-w-2xl mx-auto shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                    {initialData ? 'Editar Processo Cível' : 'Novo Processo Cível'}
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

                {/* Categoria */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* Checkbox Competência Delegada - Apenas para RPV e Precatório */}
                    {(formData.category === 'RPV' || formData.category === 'Precatório') && (
                        <div className="mt-4 flex flex-col gap-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={formData.isDelegated || false}
                                        onChange={e => setFormData({ ...formData, isDelegated: e.target.checked })}
                                    />
                                    <div className="w-5 h-5 bg-white border-2 border-indigo-300 rounded peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                                        <svg className={`w-3.5 h-3.5 text-white transition-transform ${formData.isDelegated ? 'scale-100' : 'scale-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm font-semibold text-indigo-900 block">E-Prec</span>
                                    <span className="text-xs text-indigo-600 block">Expedido em sistema diferente</span>
                                </div>
                            </label>

                            <div className="border-t border-indigo-200 pt-3">
                                <label className="block text-sm font-medium text-indigo-900 mb-2">Situação da Expedição</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="expeditionStatus"
                                            value="pending"
                                            checked={formData.expeditionStatus === 'pending' || !formData.expeditionStatus}
                                            onChange={() => setFormData({ ...formData, expeditionStatus: 'pending' })}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Pendente</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="expeditionStatus"
                                            value="dispatched"
                                            checked={formData.expeditionStatus === 'dispatched'}
                                            onChange={() => setFormData({ ...formData, expeditionStatus: 'dispatched' })}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Expedido</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Campos Específicos para Alvarás */}
                    {formData.category === 'Alvarás' && (
                        <div className="mt-4 flex flex-col gap-4 bg-amber-50 p-4 rounded-lg border border-amber-100 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <h3 className="text-sm font-semibold text-amber-900 mb-3 block">Controle & Assinaturas</h3>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                            checked={formData.signatureServer || false}
                                            onChange={e => setFormData({ ...formData, signatureServer: e.target.checked })}
                                        />
                                        <span className="text-sm text-gray-700">Assinatura Servidor</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                            checked={formData.signatureMagistrate || false}
                                            onChange={e => setFormData({ ...formData, signatureMagistrate: e.target.checked })}
                                        />
                                        <span className="text-sm text-gray-700">Assinatura Magistrado</span>
                                    </label>
                                </div>
                            </div>

                            <div className="border-t border-amber-200 pt-3">
                                <label className="block text-sm font-medium text-amber-900 mb-1">Situação da Expedição</label>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${formData.expeditionStatus === 'dispatched' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {formData.expeditionStatus === 'dispatched' ? 'Expedido' : 'Pendente'}
                                    </span>
                                    {formData.isConcluded && (
                                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                                            Concluído
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-amber-600 mt-1 italic">* Automático: Expedido se Servidor assinar, Concluído se ambos assinarem.</p>
                            </div>

                            <div className="border-t border-amber-200 pt-3">
                                <label className="block text-sm font-medium text-amber-900 mb-1">Subconta / Id SISBAJUD</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border border-amber-200 rounded focus:ring-2 focus:ring-amber-500 outline-none bg-amber-50"
                                    value={formData.subaccountId || ''}
                                    onChange={e => setFormData({ ...formData, subaccountId: e.target.value })}
                                    placeholder="Informe o ID para controle da subconta"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Data Entrada */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Entrada</label>
                    <input
                        type="date"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.entryDate}
                        onChange={e => setFormData({ ...formData, entryDate: e.target.value })}
                    />
                </div>

                {/* Reavaliação - Apenas para Acolhidos */}
                {formData.category === 'Acolhidos' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Data Última Reavaliação</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                            value={formData.lastReevaluationDate || ''}
                            onChange={e => setFormData({ ...formData, lastReevaluationDate: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">Alerta automático após 90 dias.</p>
                    </div>
                )}

                {/* Última Movimentação */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Última Movimentação</label>
                    <input
                        type="date"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.lastMovementDate || ''}
                        onChange={e => setFormData({ ...formData, lastMovementDate: e.target.value })}
                    />
                </div>

                {/* Prazo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                        <span>Data Limite / Prazo</span>
                        {formData.category === 'Infracionais' && <span className="text-xs text-orange-600 font-bold flex items-center gap-1"><AlertCircle size={12} /> 180 dias auto</span>}
                        {formData.category === 'Apreendidos' && <span className="text-xs text-blue-600 font-bold flex items-center gap-1"><AlertCircle size={12} /> 45 dias auto</span>}
                    </label>
                    <input
                        type="date"
                        className={`w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none ${(formData.category === 'Infracionais' || formData.category === 'Apreendidos') ? 'bg-gray-50 border-gray-200' : ''}`}
                        value={formData.deadlineDate}
                        onChange={e => setFormData({ ...formData, deadlineDate: e.target.value })}
                    />
                </div>

                {/* Servidor Responsável */}
                <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Servidor Responsável</label>
                    <select
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.responsibleServer || ''}
                        onChange={e => setFormData({ ...formData, responsibleServer: e.target.value })}
                    >
                        <option value="">Selecione um servidor</option>
                        {profiles.map(profile => (
                            <option key={profile.user_id} value={profile.name}>{profile.name}</option>
                        ))}
                    </select>
                </div>

                {/* Obs */}
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
