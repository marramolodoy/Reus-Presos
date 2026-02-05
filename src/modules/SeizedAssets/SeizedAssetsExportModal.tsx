import React, { useState } from 'react';
import { X, Download, Filter, ListOrdered } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SeizedAsset } from '../../types';

interface SeizedAssetsExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    assets: SeizedAsset[];
}

export const SeizedAssetsExportModal: React.FC<SeizedAssetsExportModalProps> = ({ isOpen, onClose, assets }) => {
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Concluded'>('All');

    if (!isOpen) return null;

    const handleExport = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(16);
        doc.text('Relatório de Bens Apreendidos', 14, 20);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 28);

        // Filter & Sort
        let processedAssets = [...assets];

        if (filterStatus === 'Pending') {
            processedAssets = processedAssets.filter(a => !a.isConcluded);
        } else if (filterStatus === 'Concluded') {
            processedAssets = processedAssets.filter(a => a.isConcluded);
        }

        processedAssets.sort((a, b) => { // Default sort by Party Name for PDF usually, or Creation Date? Let's use name.
            return sortOrder === 'asc'
                ? a.partyName.localeCompare(b.partyName)
                : b.partyName.localeCompare(a.partyName);
        });

        const bodyInput = processedAssets.map(a => [
            a.partyName,
            a.description,
            a.processNumber || '-',
            a.location,
            a.destinationStatus,
            a.isConcluded ? 'Concluído' : 'Pendente'
        ]);

        autoTable(doc, {
            startY: 35,
            head: [['Parte', 'Descrição', 'Processo', 'Local', 'Destinação', 'Status']],
            body: bodyInput,
            theme: 'grid',
            headStyles: { fillColor: [234, 88, 12], textColor: 255 }, // Orange header
        });

        doc.save('relatorio_bens_apreendidos.pdf');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <Download size={20} /> Exportar PDF
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Filter */}
                    <div>
                        <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Filter size={16} /> Filtrar por Status
                        </h4>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            {(['All', 'Pending', 'Concluded'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilterStatus(f)}
                                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${filterStatus === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {f === 'All' ? 'Todos' : f === 'Pending' ? 'Pendentes' : 'Concluídos'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sorting */}
                    <div>
                        <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                            <ListOrdered size={16} /> Ordenação (Nome)
                        </h4>
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setSortOrder('asc')}
                                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${sortOrder === 'asc' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                A-Z
                            </button>
                            <button
                                onClick={() => setSortOrder('desc')}
                                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${sortOrder === 'desc' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Z-A
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        className="w-full bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 text-sm shadow-sm font-bold"
                    >
                        <Download size={18} /> Baixar Relatório
                    </button>
                </div>
            </div>
        </div>
    );
};
