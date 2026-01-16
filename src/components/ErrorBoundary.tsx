import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full text-center">
                        <div className="inline-flex bg-red-100 p-4 rounded-full mb-4">
                            <AlertTriangle className="text-red-600" size={48} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Ops! Algo deu errado.</h1>
                        <p className="text-gray-600 mb-6">
                            Ocorreu um erro inesperado ao carregar a aplicação. Tente recarregar a página.
                        </p>
                        <div className="bg-gray-50 border border-gray-200 rounded p-4 text-left overflow-auto max-h-40 mb-6">
                            <code className="text-xs text-red-800 font-mono">
                                {this.state.error?.message}
                            </code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-justice-600 text-white px-6 py-2 rounded-md font-medium hover:bg-justice-700 transition-colors"
                        >
                            Recarregar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children ?? null;
    }
}
