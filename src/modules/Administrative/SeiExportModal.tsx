import React, { useState } from 'react';
import { Download, X, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SeiRequest } from '../../types';

interface SeiExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    requests: SeiRequest[];
}

export const SeiExportModal: React.FC<SeiExportModalProps> = ({ isOpen, onClose, requests }) => {
    const [title, setTitle] = useState('Relatório de Pedidos SEI');

    const handleExport = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(title, 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()}`, 14, 30);

        // Table
        const tableData = requests.map(req => {
            const daysStalled = Math.floor((new Date().getTime() - new Date(req.lastMovementDate).getTime()) / (1000 * 3600 * 24));
            return [
                req.processNumber,
                req.subject,
                req.currentSector,
                req.responsibleServer,
                new Date(req.lastMovementDate).toLocaleDateString(),
                daysStalled > 30 ? `${daysStalled} dias (VENCIDO)` : `${daysStalled} dias`
            ];
        });

        autoTable(doc, {
            startY: 40,
            head: [['Processo', 'Assunto', 'Setor Atual', 'Responsável', 'Últ. Movimentação', 'Status']],
            body: tableData,
            headStyles: { fillColor: [66, 139, 202] }, // Blue header
            styles: { fontSize: 9 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            didParseCell: (data) => {
                // Highlight stalled rows in red text
                if (data.section === 'body' && data.column.index === 5) {
                    const cellText = data.cell.raw as string;
                    if (cellText.includes('VENCIDO')) {
                        data.cell.styles.textColor = [220, 53, 69]; // Red
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        doc.save(`${title.replace(/ /g, '_').toLowerCase()}.pdf`);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <Download size={20} className="text-blue-600" /> Exportar PDF
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título do Relatório</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900 text-sm">Resumo da Exportação</h4>
                            <p className="text-blue-700 text-xs mt-1">
                                Será gerado um arquivo PDF contendo <strong>{requests.length}</strong> pedidos SEI listados na tela atual (respeitando seus filtros de busca).
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleExport}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm shadow-sm font-medium"
                        >
                            <Download size={16} />
                            Baixar PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
