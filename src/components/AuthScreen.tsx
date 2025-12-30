import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Scale, AlertTriangle, Info, Mail, Lock, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
    onLogin: (session: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setMessage('Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.');
                setIsSignUp(false);
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onLogin(data.session);
            }
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-justice-50 to-justice-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="bg-justice-900 p-8 text-white text-center">
                    <div className="inline-flex bg-white/10 p-4 rounded-full mb-4">
                        <Scale size={48} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold">SysPenal Cloud</h1>
                    <p className="text-justice-200 text-sm mt-1 uppercase tracking-widest">Controle de Réus Presos</p>
                </div>

                <div className="p-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
                        {isSignUp ? 'Criar Nova Conta' : 'Acesse o Sistema'}
                    </h2>

                    {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-4 border border-red-100 flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}
                    {message && <div className="bg-green-50 text-green-600 p-3 rounded text-sm mb-4 border border-green-100 flex items-center gap-2"><Info size={16} /> {message}</div>}

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-justice-500 focus:border-transparent outline-none transition-all"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-justice-500 focus:border-transparent outline-none transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-justice-600 text-white py-3 rounded-lg hover:bg-justice-700 transition-colors font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? 'Processando...' : (isSignUp ? 'Cadastrar' : 'Entrar')}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-justice-600 text-sm font-medium hover:underline"
                        >
                            {isSignUp ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se gratuitamente'}
                        </button>
                    </div>
                </div>
                <div className="bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-100">
                    Ambiente Seguro • Supabase Auth
                </div>
            </div>
        </div>
    );
};
