import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    isLoading = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Header */}
                <div className={`p-6 flex items-start gap-4 ${variant === 'danger' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`p-3 rounded-full flex-shrink-0 ${variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-justice-100 text-justice-600'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">{title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-100 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        onClick={() => {
                            onConfirm();
                        }}
                        isLoading={isLoading}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};
