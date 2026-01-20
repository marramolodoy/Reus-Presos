import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { LawyerRequest, LawyerRequestFormData } from '../../types';
import { Button } from '../../components/ui/Button';

interface LawyerFormProps {
    initialData?: LawyerRequest;
    onSubmit: (data: LawyerRequestFormData) => void;
    onCancel: () => void;
}

const CONTACT_METHODS = [
    'WhatsApp',
    'Email',
    'Telefone',
    'Presencial',
    'Balcão Virtual',
    'Outros'
];

const MATTERS = [
    'Cível',
    'Criminal',
    'Outros'
];

export const LawyerForm: React.FC<LawyerFormProps> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<LawyerRequestFormData>({
        name: '',
        caseNumber: '',
        contactMethod: 'WhatsApp',
        matter: 'Cível',
        requestDate: (() => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        })(),
        isConcluded: false,
        obs: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                caseNumber: initialData.caseNumber || '',
                contactMethod: initialData.contactMethod,
                matter: initialData.matter,
                requestDate: initialData.requestDate ? initialData.requestDate.split('T')[0] : '',
                isConcluded: initialData.isConcluded,
                concludedAt: initialData.concludedAt,
                obs: initialData.obs || ''
            });
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg w-full max-w-2xl mx-auto shadow-sm max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                    {initialData ? 'Editar Requerimento' : 'Novo Requerimento'}
                </h2>
                <Button variant="ghost" size="icon" onClick={onCancel} className="text-gray-500 hover:text-gray-700">
                    <X size={24} />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Advogado / Parte</label>
                    <input
                        type="text"
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Dr. João Silva / Maria Souza"
                    />
                </div>

                {/* Processo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Processo</label>
                    <input
                        type="text"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.caseNumber}
                        onChange={e => setFormData({ ...formData, caseNumber: e.target.value })}
                    />
                </div>

                {/* Data do Pedido */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pedido</label>
                    <input
                        type="date"
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.requestDate}
                        onChange={e => setFormData({ ...formData, requestDate: e.target.value })}
                    />
                </div>

                {/* Meio de Contato */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meio de Contato</label>
                    <select
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        value={formData.contactMethod}
                        onChange={e => setFormData({ ...formData, contactMethod: e.target.value as any })}
                    >
                        {CONTACT_METHODS.map(method => (
                            <option key={method} value={method}>{method}</option>
                        ))}
                    </select>
                </div>

                {/* Matéria */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matéria</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {MATTERS.map(m => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setFormData({ ...formData, matter: m as any })}
                                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-all ${formData.matter === m ? 'bg-white shadow text-justice-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Obs */}
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações / Resumo do Pedido</label>
                    <textarea
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-500 outline-none"
                        rows={4}
                        value={formData.obs}
                        onChange={e => setFormData({ ...formData, obs: e.target.value })}
                        placeholder="Descreva brevemente o que foi solicitado..."
                    />
                </div>

                {/* Concluído Checkbox (Edição apenas ou se já quiser criar concluído) */}
                <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={formData.isConcluded}
                            onChange={e => setFormData({
                                ...formData,
                                isConcluded: e.target.checked,
                                concludedAt: e.target.checked && !formData.isConcluded ? new Date().toISOString() : (!e.target.checked ? null : formData.concludedAt)
                            })}
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                        />
                        <div>
                            <span className="font-medium text-gray-800">Marcar como Concluído</span>
                            <p className="text-xs text-gray-500">O pedido foi atendido ou finalizado.</p>
                        </div>
                    </label>
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <Button variant="secondary" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" variant="primary" leftIcon={Save}>
                    Salvar
                </Button>
            </div>
        </form>
    );
};
