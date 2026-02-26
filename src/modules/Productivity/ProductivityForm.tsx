import React, { useState, useEffect } from 'react';
import { ProductivityLog, ProductivityLogFormData } from '../../types';
import { X, Save } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Props {
    initialData?: ProductivityLog;
    onSubmit: (data: ProductivityLogFormData) => void;
    onCancel: () => void;
}

const emptyForm: ProductivityLogFormData = {
    date: new Date().toISOString().split('T')[0],
    processNumbers: '',
    activities: ''
};

export const ProductivityForm: React.FC<Props> = ({ initialData, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<ProductivityLogFormData>(emptyForm);

    useEffect(() => {
        if (initialData) {
            setFormData({
                date: initialData.date,
                processNumbers: initialData.processNumbers,
                activities: initialData.activities
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
            <div className="bg-justice-900 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    {initialData ? 'Editar Produtividade' : 'Registrar Produtividade'}
                </h2>
                <button onClick={onCancel} className="text-justice-300 hover:text-white transition-colors">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Data de Referência *</label>
                        <input
                            type="date"
                            required
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-justice-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Processos Trabalhados</label>
                    <textarea
                        name="processNumbers"
                        value={formData.processNumbers}
                        onChange={handleChange}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-justice-500 outline-none transition-all"
                        placeholder="Ex: 0000000-00.2024.8.14.0000, ..."
                    />
                    <p className="mt-1 text-xs text-gray-400">Liste os números dos processos em que atuou neste dia.</p>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Atividades Realizadas *</label>
                    <textarea
                        required
                        name="activities"
                        value={formData.activities}
                        onChange={handleChange}
                        rows={6}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-justice-500 outline-none transition-all"
                        placeholder="Descreva as atividades, despachos, sentenças, ou atos realizados..."
                    />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t font-medium">
                    <Button variant="secondary" onClick={onCancel} type="button">
                        Cancelar
                    </Button>
                    <Button variant="primary" type="submit" leftIcon={Save}>
                        {initialData ? 'Salvar Alterações' : 'Registrar'}
                    </Button>
                </div>
            </form>
        </div>
    );
};
