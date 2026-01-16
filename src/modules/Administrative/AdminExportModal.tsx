import React, { useState, useEffect } from 'react';
import { X, Download, Filter, Layers, ListOrdered } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AdministrativeDocument } from '../../types';

interface AdminExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    documents: AdministrativeDocument[];
}

interface ExportConfig {
    selectedIssuers: { Secretaria: boolean; Gabinete: boolean };
    selectedTypes: string[];
    groupBy: 'none' | 'issuer' | 'type';
    sortOrder: 'asc' | 'desc';
}

export const AdminExportModal: React.FC<AdminExportModalProps> = ({ isOpen, onClose, documents }) => {
    const [availableTypes, setAvailableTypes] = useState<string[]>([]);
    const [config, setConfig] = useState<ExportConfig>({
        selectedIssuers: { Secretaria: true, Gabinete: true },
        selectedTypes: [],
        groupBy: 'none',
        sortOrder: 'desc'
    });

    useEffect(() => {
        if (isOpen) {
            // Extract unique document types from available documents
            const types = Array.from(new Set(documents.map(d => d.documentType || 'Outros'))).sort();
            setAvailableTypes(types);
            setConfig(prev => ({ ...prev, selectedTypes: types }));
        }
    }, [isOpen, documents]);

    if (!isOpen) return null;

    const toggleIssuer = (issuer: 'Secretaria' | 'Gabinete') => {
        setConfig(prev => ({
            ...prev,
            selectedIssuers: { ...prev.selectedIssuers, [issuer]: !prev.selectedIssuers[issuer] }
        }));
    };

    const toggleType = (type: string) => {
        setConfig(prev => {
            const newTypes = prev.selectedTypes.includes(type)
                ? prev.selectedTypes.filter(t => t !== type)
                : [...prev.selectedTypes, type];
            return { ...prev, selectedTypes: newTypes };
        });
    };

    const handleExport = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(16);
        doc.text('Relatório Administrativo', 14, 20);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 28);

        // Filter Data
        let filteredDocs = documents.filter(d => {
            const matchIssuer = config.selectedIssuers[d.issuer];
            const matchType = config.selectedTypes.includes(d.documentType || 'Outros');
            return matchIssuer && matchType;
        });

        // Grouping & Sorting Logic
        if (config.groupBy !== 'none') {
            // Group Logic
            const groups: { [key: string]: AdministrativeDocument[] } = {};

            filteredDocs.forEach(d => {
                const key = config.groupBy === 'issuer' ? d.issuer : (d.documentType || 'Outros');
                if (!groups[key]) groups[key] = [];
                groups[key].push(d);
            });

            // Sort keys
            const sortedKeys = Object.keys(groups).sort();

            let currentY = 35;

            sortedKeys.forEach(key => {
                // Sort items within group
                groups[key].sort((a, b) => {
                    const dateA = new Date(a.date).getTime();
                    const dateB = new Date(b.date).getTime();
                    return config.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                });

                // Add Group Header
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`${config.groupBy === 'issuer' ? 'Origem' : 'Tipo'}: ${key}`, 14, currentY);
                currentY += 5;

                const bodyInput = groups[key].map(d => [
                    d.number,
                    d.documentType || '-',
                    d.issuer,
                    d.subject,
                    new Date(d.date).toLocaleDateString()
                ]);

                autoTable(doc, {
                    startY: currentY,
                    head: [['Número', 'Tipo', 'Origem', 'Assunto', 'Data']],
                    body: bodyInput,
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                    margin: { bottom: 10 },
                });

                // Update Y for next table
                currentY = (doc as any).lastAutoTable.finalY + 15;

                // Check if new page needed
                if (currentY > doc.internal.pageSize.height - 20) {
                    doc.addPage();
                    currentY = 20;
                }
            });

        } else {
            // No Grouping - Single Table
            filteredDocs.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return config.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });

            const bodyInput = filteredDocs.map(d => [
                d.number,
                d.documentType || '-',
                d.issuer,
                d.subject,
                new Date(d.date).toLocaleDateString()
            ]);

            autoTable(doc, {
                startY: 35,
                head: [['Número', 'Tipo', 'Origem', 'Assunto', 'Data']],
                body: bodyInput,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            });
        }

        doc.save('relatorio_administrativo.pdf');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <Download size={20} /> Exportar Relatório PDF
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Filters */}
                    <div className="space-y-6">
                        {/* Issuer Filter */}
                        <div>
                            <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Filter size={16} /> 1. Origem
                            </h4>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.selectedIssuers.Secretaria}
                                        onChange={() => toggleIssuer('Secretaria')}
                                        className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Secretaria</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.selectedIssuers.Gabinete}
                                        onChange={() => toggleIssuer('Gabinete')}
                                        className="rounded text-blue-600 focus:ring-blue-500 w-5 h-5"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Gabinete</span>
                                </label>
                            </div>
                        </div>

                        {/* Type Filter */}
                        <div>
                            <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Filter size={16} /> 2. Tipos de Documento
                            </h4>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                                {availableTypes.length > 0 ? availableTypes.map(type => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={config.selectedTypes.includes(type)}
                                            onChange={() => toggleType(type)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-600 truncate">{type}</span>
                                    </label>
                                )) : <p className="text-xs text-gray-400 italic">Nenhum documento encontrado.</p>}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Organization */}
                    <div className="space-y-6">
                        {/* Grouping */}
                        <div>
                            <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Layers size={16} /> 3. Agrupamento (Separação)
                            </h4>
                            <div className="space-y-2">
                                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${config.groupBy === 'none' ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="group"
                                        checked={config.groupBy === 'none'}
                                        onChange={() => setConfig(prev => ({ ...prev, groupBy: 'none' }))}
                                        className="text-blue-600"
                                    />
                                    <span className="text-sm font-medium">Sem Agrupar (Tudo na mesma lista)</span>
                                </label>
                                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${config.groupBy === 'issuer' ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="group"
                                        checked={config.groupBy === 'issuer'}
                                        onChange={() => setConfig(prev => ({ ...prev, groupBy: 'issuer' }))}
                                        className="text-blue-600"
                                    />
                                    <span className="text-sm font-medium">Por Origem (Secretaria / Gabinete)</span>
                                </label>
                                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${config.groupBy === 'type' ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>
                                    <input
                                        type="radio"
                                        name="group"
                                        checked={config.groupBy === 'type'}
                                        onChange={() => setConfig(prev => ({ ...prev, groupBy: 'type' }))}
                                        className="text-blue-600"
                                    />
                                    <span className="text-sm font-medium">Por Tipo de Documento</span>
                                </label>
                            </div>
                        </div>

                        {/* Sorting */}
                        <div>
                            <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                                <ListOrdered size={16} /> 4. Ordenação Cronológica
                            </h4>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setConfig(prev => ({ ...prev, sortOrder: 'desc' }))}
                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${config.sortOrder === 'desc' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Mais Recentes
                                </button>
                                <button
                                    onClick={() => setConfig(prev => ({ ...prev, sortOrder: 'asc' }))}
                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${config.sortOrder === 'asc' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Mais Antigos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">Cancelar</button>
                    <button
                        onClick={handleExport}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm font-bold"
                    >
                        <Download size={16} /> Baixar Relatório PDF
                    </button>
                </div>
            </div>
        </div>
    );
};
