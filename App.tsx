import React, { useState, useMemo } from 'react';
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Search, 
  FileText, 
  Scale, 
  Calendar,
  AlertOctagon,
  Bot
} from 'lucide-react';
import { Defendant, DefendantFormData, DashboardStats } from './types';
import { DefendantForm } from './components/DefendantForm';
import { calculateDaysDiff, formatDate, getStatusColor, THRESHOLD_IMPRISONMENT, THRESHOLD_REVIEW } from './utils';
import { generateLegalAnalysis } from './services/geminiService';

// Mock Data
const MOCK_DEFENDANTS: Defendant[] = [
  {
    id: '1',
    name: 'João da Silva',
    caseNumber: '0001234-56.2023.8.14.0022',
    penalType: 'Art. 121 (Homicídio)',
    arrestDate: '2023-01-15',
    lastReviewDate: '2023-12-01', // Needs review
    movementType: 'Concluso para julgamento',
    lastMovementDate: '2023-11-20',
    deadline: 60,
    obs: 'Réu primário. Defensor Público.',
    rji: '12345',
    bnmp: 'CNJ-123',
    infopen: 'PA-999',
    prison: 'CP Goianésia'
  },
  {
    id: '2',
    name: 'Maria Oliveira',
    caseNumber: '0005678-12.2024.8.14.0022',
    penalType: 'Art. 33 (Tráfico)',
    arrestDate: '2024-02-10',
    lastReviewDate: '2024-04-10', // OK
    movementType: 'Aguardando Audiência',
    lastMovementDate: '2024-03-01',
    deadline: 45,
    obs: 'Audiência remarcada.',
    rji: '67890',
    bnmp: 'CNJ-456',
    infopen: 'PA-888',
    prison: 'CP Goianésia'
  },
  {
    id: '3',
    name: 'Carlos Pereira',
    caseNumber: '0009999-99.2022.8.14.0022',
    penalType: 'Art. 157 (Roubo)',
    arrestDate: '2022-05-20', // Long imprisonment
    lastReviewDate: '2024-05-01',
    movementType: 'Aguardando Sentença',
    lastMovementDate: '2024-04-15',
    deadline: 30,
    obs: 'Reincidente.',
    rji: '11122',
    bnmp: 'CNJ-789',
    infopen: 'PA-777',
    prison: 'CP Marabá'
  }
];

export default function App() {
  const [defendants, setDefendants] = useState<Defendant[]>(MOCK_DEFENDANTS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [selectedDefendantForAI, setSelectedDefendantForAI] = useState<Defendant | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Stats Calculation
  const stats: DashboardStats = useMemo(() => {
    let expiredReviews = 0;
    let longImprisonment = 0;
    let stalledCases = 0;

    defendants.forEach(d => {
      const daysSinceReview = calculateDaysDiff(d.lastReviewDate);
      const daysSinceArrest = calculateDaysDiff(d.arrestDate);
      const daysStalled = calculateDaysDiff(d.lastMovementDate);

      if (daysSinceReview > THRESHOLD_REVIEW) expiredReviews++;
      if (daysSinceArrest > THRESHOLD_IMPRISONMENT) longImprisonment++;
      if (daysStalled > d.deadline) stalledCases++;
    });

    return {
      total: defendants.length,
      expiredReviews,
      longImprisonment,
      stalledCases
    };
  }, [defendants]);

  // Handlers
  const handleSave = (data: DefendantFormData) => {
    if (editingId) {
      setDefendants(prev => prev.map(d => d.id === editingId ? { ...data, id: editingId } : d));
    } else {
      const newDefendant: Defendant = { ...data, id: Math.random().toString(36).substr(2, 9) };
      setDefendants(prev => [...prev, newDefendant]);
    }
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (defendant: Defendant) => {
    setEditingId(defendant.id);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      setDefendants(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleAIAnalysis = async (defendant: Defendant) => {
    setSelectedDefendantForAI(defendant);
    setAiModalOpen(true);
    setLoadingAi(true);
    setAiAnalysis('');
    
    const result = await generateLegalAnalysis(defendant);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  const filteredDefendants = defendants.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.caseNumber.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-justice-900 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-full">
              <Scale size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Vara Única de Goianésia do Pará</h1>
              <p className="text-justice-100 text-xs uppercase tracking-widest">Controle de Réus Presos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <button 
              onClick={() => { setEditingId(null); setIsFormOpen(true); }}
              className="bg-justice-500 hover:bg-justice-700 text-white px-4 py-2 rounded-md shadow flex items-center gap-2 transition-colors font-medium"
            >
              <Plus size={18} />
              Novo Réu
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Stats */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-justice-500 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Total de Réus</p>
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <Users className="text-justice-200" size={32} />
          </div>

          <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 flex items-center justify-between ${stats.expiredReviews > 0 ? 'border-red-500 bg-red-50' : 'border-green-500'}`}>
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Revisão Vencida (>90d)</p>
              <p className={`text-3xl font-bold ${stats.expiredReviews > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.expiredReviews}</p>
            </div>
            <AlertOctagon className={stats.expiredReviews > 0 ? 'text-red-300' : 'text-green-200'} size={32} />
          </div>

          <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 flex items-center justify-between ${stats.longImprisonment > 0 ? 'border-orange-500' : 'border-blue-300'}`}>
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Prisão Longa (>1 ano)</p>
              <p className="text-3xl font-bold text-gray-800">{stats.longImprisonment}</p>
            </div>
            <Calendar className="text-orange-200" size={32} />
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-yellow-400 flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs uppercase font-bold tracking-wider">Processos Paralisados</p>
              <p className="text-3xl font-bold text-gray-800">{stats.stalledCases}</p>
            </div>
            <Clock className="text-yellow-200" size={32} />
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou número do processo..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-justice-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500">
            Mostrando {filteredDefendants.length} registros
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Réu / Processo</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Prisão (Dias)</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Última Revisão</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Movimentação</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status Prazo</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Local</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDefendants.map((defendant) => {
                const daysImprisoned = calculateDaysDiff(defendant.arrestDate);
                const daysSinceReview = calculateDaysDiff(defendant.lastReviewDate);
                const daysStalled = calculateDaysDiff(defendant.lastMovementDate);
                const isStalled = daysStalled > defendant.deadline;

                return (
                  <tr key={defendant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{defendant.name}</span>
                        <span className="text-xs text-gray-500 font-mono">{defendant.caseNumber}</span>
                        <span className="text-xs text-justice-600 mt-1">{defendant.penalType}</span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className={`px-2 py-1 rounded-md text-xs inline-flex flex-col items-center border ${getStatusColor(daysImprisoned, THRESHOLD_IMPRISONMENT)}`}>
                        <span className="font-bold">{daysImprisoned} dias</span>
                        <span className="text-[10px] opacity-75">{formatDate(defendant.arrestDate)}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                       <div className={`px-2 py-1 rounded-md text-xs inline-flex flex-col items-center border ${getStatusColor(daysSinceReview, THRESHOLD_REVIEW, true)}`}>
                        <span className="font-bold">{daysSinceReview} dias atrás</span>
                        <span className="text-[10px] opacity-75">{formatDate(defendant.lastReviewDate)}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900">{defendant.movementType}</span>
                        <span className="text-xs text-gray-500">{formatDate(defendant.lastMovementDate)}</span>
                      </div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                       <div className={`flex items-center gap-2 ${isStalled ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                         {isStalled ? <AlertTriangle size={16} /> : <Clock size={16} />}
                         <span className="text-sm">
                           {daysStalled} / {defendant.deadline} dias
                         </span>
                       </div>
                       {isStalled && <span className="text-xs text-red-500 block mt-1">Prazo excedido</span>}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{defendant.prison}</span>
                      {defendant.rji && <span className="block text-xs text-gray-400">RJI: {defendant.rji}</span>}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleAIAnalysis(defendant)} className="text-justice-600 hover:text-justice-900 p-1" title="Análise IA">
                          <Bot size={18} />
                        </button>
                        <button onClick={() => handleEdit(defendant)} className="text-indigo-600 hover:text-indigo-900 p-1" title="Editar">
                          <FileText size={18} />
                        </button>
                        <button onClick={() => handleDelete(defendant.id)} className="text-red-600 hover:text-red-900 p-1" title="Excluir">
                          <AlertOctagon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredDefendants.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhum réu encontrado com os critérios de busca.
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {isFormOpen && (
        <DefendantForm 
          initialData={editingId ? defendants.find(d => d.id === editingId) : undefined}
          onSubmit={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
        />
      )}

      {/* AI Assistant Modal */}
      {aiModalOpen && selectedDefendantForAI && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-justice-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <Bot className="text-justice-600" />
                <h3 className="font-bold text-lg text-justice-800">Assistente Jurídico Virtual</h3>
              </div>
              <button onClick={() => setAiModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {loadingAi ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-justice-600 mb-4"></div>
                  <p className="text-gray-500">Analisando situação processual e prazos...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                    <p className="font-semibold text-blue-900 text-sm mb-2">Análise para: {selectedDefendantForAI.name}</p>
                    <p className="text-xs text-blue-700">Processo: {selectedDefendantForAI.caseNumber}</p>
                  </div>
                  
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <p className="whitespace-pre-line leading-relaxed">{aiAnalysis}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 italic">
                    Nota: Esta análise é gerada por inteligência artificial e serve apenas como auxílio. Verifique sempre os autos oficiais.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Icon helper for modal
function X({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
}