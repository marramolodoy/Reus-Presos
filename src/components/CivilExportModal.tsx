import React, { useState } from 'react';
import { X, Download, CheckSquare, Square } from 'lucide-react';

interface CivilExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (config: CivilExportConfig) => void;
}

export interface CivilExportConfig {
    selectedCategories: string[];
    sortBy: 'name' | 'category' | 'date';
}

import { CIVIL_CATEGORIES } from '../constants';

const CATEGORIES = CIVIL_CATEGORIES;

export const CivilExportModal: React.FC<CivilExportModalProps> = ({ isOpen, onClose, onExport }) => {
    const [selectedCategories, setSelectedCategories] = useState<string[]>([...CATEGORIES]);
    const [sortBy, setSortBy] = useState<'name' | 'category' | 'date'>('name');

    if (!isOpen) return null;

    const toggleCategory = (cat: string) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handleSelectAll = () => {
        if (selectedCategories.length === CATEGORIES.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories([...CATEGORIES]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-justice-700 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Download size={20} /> Exportar Relatório Geral (Civil)
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Section: Filter Categories */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Incluir Categorias</h4>
                            <button
                                onClick={handleSelectAll}
                                className="text-xs text-justice-600 hover:underline font-medium"
                            >
                                {selectedCategories.length === CATEGORIES.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${selectedCategories.includes(cat)
                                        ? 'bg-justice-50 border-justice-200 text-justice-800 font-medium'
                                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    {selectedCategories.includes(cat)
                                        ? <CheckSquare size={16} className="text-justice-600" />
                                        : <Square size={16} className="text-gray-300" />
                                    }
                                    {cat === 'Advogados' ? 'Req. Adv' : cat}
                                </button>
                            ))}
                        </div>
                        {selectedCategories.length === 0 && (
                            <p className="text-xs text-red-500 mt-2">Selecione pelo menos uma categoria.</p>
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
                                <span className="text-sm font-medium text-gray-700">Alfabética (Nome)</span>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="sort"
                                    checked={sortBy === 'category'}
                                    onChange={() => setSortBy('category')}
                                    className="text-justice-600 focus:ring-justice-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Agrupar por Categoria</span>
                            </label>

                            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                <input
                                    type="radio"
                                    name="sort"
                                    checked={sortBy === 'date'}
                                    onChange={() => setSortBy('date')}
                                    className="text-justice-600 focus:ring-justice-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Data de Entrada (Mais Recente)</span>
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
                        onClick={() => onExport({ selectedCategories, sortBy })}
                        disabled={selectedCategories.length === 0}
                        className="px-6 py-2 bg-justice-700 text-white rounded-lg hover:bg-justice-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm shadow-sm transition-all transform active:scale-95"
                    >
                        <Download size={16} /> Gerar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
