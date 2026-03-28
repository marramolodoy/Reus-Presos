import React from 'react';
import { X, Calendar, ExternalLink, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { ExpiredItem } from '../hooks/useExpiredDeadlines';

interface ExpiredDeadlinesModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: ExpiredItem[];
    onNavigate: (module: string) => void;
    onRefresh: () => void;
    loading: boolean;
    lastUpdated?: Date | null;
}

export const ExpiredDeadlinesModal: React.FC<ExpiredDeadlinesModalProps> = ({ 
    isOpen, onClose, items, onNavigate, onRefresh, loading, lastUpdated 
}) => {
    if (!isOpen) return null;

    const groupByType = (type: string) => items.filter(i => i.type === type);
    const criminalItems = groupByType('criminal');
    const civilItems = groupByType('civil');
    const penhoraItems = groupByType('penhora');
    const rogatoryItems = groupByType('rogatory');

    const handleResolve = (item: ExpiredItem) => {
        localStorage.setItem('navigationTarget', JSON.stringify({
            module: item.moduleKey,
            tab: item.targetTab,
            direction: item.targetDirection
        }));
        onNavigate(item.moduleKey);
        onClose();
    };

    const renderList = (list: ExpiredItem[], title: string, moduleName: string) => {
        if (list.length === 0) return null;
        return (
            <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-200 pb-1 flex items-center justify-between">
                    <span>{title}</span>
                    <span className="bg-red-100 text-red-700 px-2 rounded-full text-xs font-bold">{list.length}</span>
                </h3>
                <div className="space-y-2">
                    {list.map(item => (
                        <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-center hover:border-red-300 transition-colors group shadow-sm hover:shadow">
                            <div className="flex-1 pr-4">
                                <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                    {item.title}
                                    <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex items-center gap-1">
                                        <AlertCircle size={10} /> -{item.daysOverdue} dias
                                    </span>
                                    {item.expiredCause && (
                                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                                            {item.expiredCause}
                                        </span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-1">
                                    <span>{item.subtitle}</span>
                                    {item.exactLocation && (
                                        <>
                                            <span className="text-gray-300">•</span>
                                            <span className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded uppercase font-semibold text-[9px]">{item.exactLocation}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button 
                                onClick={() => handleResolve(item)}
                                className="shrink-0 bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1"
                            >
                                <span className="hidden sm:inline">Resolver</span> <ExternalLink size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative" onClick={e => e.stopPropagation()}>
                <div className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full text-red-600">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Prazos Vencidos</h2>
                            <p className="text-xs text-gray-500">Ações pendentes que ultrapassaram o limite de prazo na unidade.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onRefresh} className={`p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors ${loading ? 'animate-spin text-indigo-500' : ''}`} title="Atualizar">
                            <RefreshCw size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <CheckCircle size={40} className="text-green-500 mb-3" />
                            <p className="font-bold text-gray-700 text-lg">Tudo em dia!</p>
                            <p className="text-sm">Você não possui prazos vencidos no momento.</p>
                        </div>
                    ) : (
                        <>
                            {renderList(criminalItems, 'Processos Criminais (Revisão / Excesso de Prazo)', 'criminal')}
                            {renderList(civilItems, 'Processos Cíveis e Pedidos', 'civil')}
                            {renderList(penhoraItems, 'Ordens de Penhora / Restrição', 'penhora')}
                            {renderList(rogatoryItems, 'Cartas Precatórias', 'rogatory')}
                        </>
                    )}
                </div>
                
                <div className="bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center text-[10px] sm:text-xs text-gray-500 font-medium">
                    <p>
                        Atualizado automaticamente (a cada minuto). {lastUpdated && <span className="ml-1 text-gray-400 font-mono">Última checagem: {lastUpdated.toLocaleTimeString('pt-BR')}</span>}
                    </p>
                    <p className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Total: {items.length} itens</p>
                </div>
            </div>
            {/* Click outside to close handled basically by making parent div fixed, but wait, need onClick to close */}
            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    );
};
