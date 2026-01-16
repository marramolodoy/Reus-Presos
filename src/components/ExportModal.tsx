import React, { useState } from 'react';
import { X, Download, CheckSquare, Square } from 'lucide-react';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (config: ExportConfig) => void;
}

export interface ExportConfig {
    selectedTypes: string[];
    sortBy: 'name' | 'prison_type' | 'prison';
}

const PRISON_TYPES = ['Preventiva', 'Temporária', 'Domiciliar', 'Provisória', 'Definitiva', 'Cível'];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport }) => {
    const [selectedTypes, setSelectedTypes] = useState<string[]>(PRISON_TYPES);
    const [sortBy, setSortBy] = useState<'name' | 'prison_type' | 'prison'>('name');

    if (!isOpen) return null;

    const toggleType = (type: string) => {
        setSelectedTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleSelectAll = () => {
        if (selectedTypes.length === PRISON_TYPES.length) {
            setSelectedTypes([]);
        } else {
            setSelectedTypes(PRISON_TYPES);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-justice-700 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Download size={20} /> Exportar Relatório Geral
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Section: Filter Types */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Incluir Listas</h4>
                            <button
                                onClick={handleSelectAll}
                                className="text-xs text-justice-600 hover:underline font-medium"
                            >
                                {selectedTypes.length === PRISON_TYPES.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {PRISON_TYPES.map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleType(type)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${selectedTypes.includes(type)
                                            ? 'bg-justice-50 border-justice-200 text-justice-800 font-medium'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    {selectedTypes.includes(type)
                                        ? <CheckSquare size={16} className="text-justice-600" />
                                        : <Square size={16} className="text-gray-300" />
                                    }
                                    {type}
                                </button>
                            ))}
                        </div>
                        {selectedTypes.length === 0 && (
                            <p className="text-xs text-red-500 mt-2">Selecione pelo menos um tipo.</p>
                        )}
                    </div>

                    {/* Section: Sort Order */}
                    <div>
                        <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3">Ordenação</h4>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="sort"
                                    checked={sortBy === 'name'}
                                    onChange={() => setSortBy('name')}
                                    className="text-justice-600 focus:ring-justice-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Alfabética (Nome do Réu)</span>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="sort"
                                    checked={sortBy === 'prison_type'}
                                    onChange={() => setSortBy('prison_type')}
                                    className="text-justice-600 focus:ring-justice-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Agrupar por Tipo de Prisão</span>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="sort"
                                    checked={sortBy === 'prison'}
                                    onChange={() => setSortBy('prison')}
                                    className="text-justice-600 focus:ring-justice-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Agrupar por Presídio (Local)</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => onExport({ selectedTypes, sortBy })}
                        disabled={selectedTypes.length === 0}
                        className="px-6 py-2 bg-justice-700 text-white rounded-lg hover:bg-justice-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm shadow-sm transition-all transform active:scale-95"
                    >
                        <Download size={16} /> Gerar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
