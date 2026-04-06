import React from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';

interface ExpiredDeadlinesBannerProps {
    count: number;
    onClick: () => void;
}

export const ExpiredDeadlinesBanner: React.FC<ExpiredDeadlinesBannerProps> = ({ count, onClick }) => {
    if (count === 0) return null;

    return (
        <div 
            onClick={onClick}
            className="bg-red-50 border-l-4 border-red-500 p-3 mx-4 md:mx-6 mt-4 rounded-lg shadow-sm flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors animate-in fade-in slide-in-from-top-4"
        >
            <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-full shrink-0">
                    <AlertTriangle size={20} className="text-red-600 animate-pulse" />
                </div>
                <div>
                    <h4 className="text-red-800 font-bold text-sm">Atenção: Prazos Pendentes ou Vencidos</h4>
                    <p className="text-red-600 text-xs">Existem {count} {count === 1 ? 'item' : 'itens'} na unidade aguardando movimentação ou fora do prazo.</p>
                </div>
            </div>
            <div className="text-red-600 font-medium text-xs flex items-center gap-1 group shrink-0 ml-2">
                Ver detalhes <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
        </div>
    );
};
