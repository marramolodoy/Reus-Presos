import React, { useState, useEffect, useMemo } from 'react';
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
  LogOut,
  Download,
  Edit,
  Trash,
  Info,
  LayoutDashboard,
  List,
  Menu,
  Home,
  Link as LinkIcon,
  CalendarDays
} from 'lucide-react';
import { Defendant, DefendantFormData, DashboardStats } from './types';
import { DefendantForm } from './components/DefendantForm';
import { AuthScreen } from './components/AuthScreen';
import { DashboardCharts } from './components/DashboardCharts';
import { calculateDaysDiff, calculateDaysUntil, formatDate, getStatusColor, THRESHOLD_IMPRISONMENT, THRESHOLD_REVIEW } from './utils';

import { supabase } from './lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF for autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const [defendants, setDefendants] = useState<Defendant[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- NEW STATE FOR TABS (Moved to top to avoid Hook Error) ---
  const [activeTab, setActiveTab] = useState<'preventive' | 'home_arrest' | 'provisional_definitive' | 'civil' | 'dashboard'>('preventive');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(true); // Reset to open on desktop by default
      } else {
        setSidebarOpen(false); // Close on mobile by default
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sorting
  type SortOption = 'created_desc' | 'review_desc' | 'imprisonment_desc' | 'stalled_desc' | 'name_asc';
  const [sortBy, setSortBy] = useState<SortOption>('created_desc');

  // Court Name Feature (Local Persistence)
  const [courtName, setCourtName] = useState(() => localStorage.getItem('court_name') || 'Vara Única de Goianésia do Pará');

  const handleEditCourtName = () => {
    const newName = prompt("Digite o nome da Vara/Comarca:", courtName);
    if (newName && newName.trim() !== '') {
      setCourtName(newName);
      localStorage.setItem('court_name', newName);
    }
  };

  // Auth Initialization
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Data Fetching
  const fetchDefendants = async () => {
    if (!session) return;
    setLoadingData(true);
    const { data, error } = await supabase.from('defendants').select('*').order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } else {
      // Map snake_case -> camelCase
      setDefendants(data.map((d: any) => ({
        id: d.id, name: d.name, caseNumber: d.case_number, penalType: d.penal_type,
        prisonType: d.prison_type || 'Preventiva', // Default if missing
        arrestDate: d.arrest_date, lastReviewDate: d.last_review_date,
        movementType: d.movement_type, lastMovementDate: d.last_movement_date,
        deadline: d.deadline, obs: d.obs, rji: d.rji, bnmp: d.bnmp, infopen: d.infopen,
        prison: d.prison, user_id: d.user_id,
        hasHearing: d.has_hearing, hearingDate: d.hearing_date, linkedDefendantIds: d.linked_defendant_ids
        // date created implicitly handled by order
      })));
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (session) fetchDefendants();
  }, [session]);

  // Handlers
  const handleSave = async (data: DefendantFormData) => {
    if (!session || !session.user) return;

    // Map camelCase -> snake_case
    const payload = {
      name: data.name, case_number: data.caseNumber, penal_type: data.penalType,
      prison_type: data.prisonType,
      arrest_date: data.arrestDate, last_review_date: data.lastReviewDate,
      movement_type: data.movementType, last_movement_date: data.lastMovementDate,
      deadline: data.deadline, obs: data.obs, rji: data.rji, bnmp: data.bnmp,
      infopen: data.infopen, prison: data.prison, user_id: session.user.id,
      has_hearing: data.hasHearing, hearing_date: data.hearingDate, linked_defendant_ids: data.linkedDefendantIds
    };

    if (editingId) {
      const { error } = await supabase.from('defendants').update(payload).eq('id', editingId);
      if (error) { alert('Erro ao atualizar: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('defendants').insert([payload]);
      if (error) { alert('Erro ao criar: ' + error.message); return; }
    }

    await fetchDefendants();
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (defendant: Defendant) => {
    setEditingId(defendant.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir da nuvem?')) {
      const { error } = await supabase.from('defendants').delete().eq('id', id);
      if (error) alert('Erro ao excluir: ' + error.message);
      else await fetchDefendants();
    }
  };


  // Filter logic based on Tabs
  const filteredDefendants = defendants.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.caseNumber.includes(searchTerm);

    // Tab filtering
    let matchesTab = true;
    if (activeTab === 'preventive') {
      // Default list: Preventiva or Temporária
      matchesTab = d.prisonType === 'Preventiva' || d.prisonType === 'Temporária' || !d.prisonType;
    } else if (activeTab === 'home_arrest') {
      matchesTab = d.prisonType === 'Domiciliar';
    } else if (activeTab === 'provisional_definitive') {
      matchesTab = d.prisonType === 'Provisória' || d.prisonType === 'Definitiva';
    } else if (activeTab === 'civil') {
      matchesTab = d.prisonType === 'Cível';
    }

    return matchesSearch && matchesTab;
  });

  const sortedDefendants = useMemo(() => {
    const sorted = [...filteredDefendants];
    return sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'review_desc': // Mais tempo sem revisão (Older date first)
          return new Date(a.lastReviewDate).getTime() - new Date(b.lastReviewDate).getTime();
        case 'imprisonment_desc': // Maior tempo preso (Older date first)
          return new Date(a.arrestDate).getTime() - new Date(b.arrestDate).getTime();
        case 'stalled_desc': // Maior tempo paralisado (Older movement date first)
          return new Date(a.lastMovementDate).getTime() - new Date(b.lastMovementDate).getTime();
        case 'created_desc':
        default:
          return 0; // Already sorted by fetch (created_at desc)
      }
    });
  }, [filteredDefendants, sortBy]);

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

  // Export Functions
  // Export Functions
  const exportToCSV = () => {
    try {
      const headers = [
        'Nome', 'Processo', 'Tipo Penal', 'Prisão', 'Tipo Prisão',
        'Revisão', 'Movimentação', 'Data Mov.', 'Prazo',
        'Presídio', 'Tem Audiência?', 'Data Audiência', 'OBS'
      ];

      const escapeCsvField = (field: any) => {
        if (field === null || field === undefined) return '';
        const stringField = String(field);
        // Se tiver aspas, ponto e vírgula ou quebra de linha, envolve em aspas e duplica aspas internas
        if (stringField.includes('"') || stringField.includes(';') || stringField.includes('\n')) {
          return `"${stringField.replace(/"/g, '""')}"`;
        }
        return stringField;
      };

      const rows = sortedDefendants.map(d => [
        d.name,
        d.caseNumber,
        d.penalType,
        formatDate(d.arrestDate),
        d.prisonType,
        formatDate(d.lastReviewDate),
        d.movementType,
        formatDate(d.lastMovementDate),
        d.deadline,
        d.prison,
        d.hasHearing ? 'Sim' : 'Não',
        d.hearingDate ? new Date(d.hearingDate).toLocaleString('pt-BR') : '-',
        d.obs || ''
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(escapeCsvField).join(';'))
      ].join('\n');

      // Adiciona BOM (\uFEFF) para forçar Excel a reconhecer UTF-8
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      alert("Erro ao exportar CSV. Verifique o console.");
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4'); // Changed to Portrait ('p')
      let title = 'Lista Geral';
      if (activeTab === 'preventive') title = 'Preventivos e Temporários';
      if (activeTab === 'home_arrest') title = 'Prisão Domiciliar';
      if (activeTab === 'provisional_definitive') title = 'Provisórios e Definitivos';
      if (activeTab === 'civil') title = 'Prisão Cível';

      doc.setFontSize(14); doc.setTextColor(40); doc.text(`Relatório - ${title}`, 14, 15);
      doc.setFontSize(9); doc.setTextColor(100); doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} - ${courtName}`, 14, 21);

      const rows = sortedDefendants.map(d => [
        d.name,
        d.caseNumber,
        `${d.penalType || '-'}\n(${d.prisonType || '-'})`,
        `${formatDate(d.arrestDate)}\n(${calculateDaysDiff(d.arrestDate)}d)`, // Shortened 'dias' to 'd'
        `${formatDate(d.lastReviewDate)}\n(${calculateDaysDiff(d.lastReviewDate)}d)`,
        d.movementType,
        `${d.deadline}d`,
        d.prison,
        d.obs || '-'
      ]);

      autoTable(doc, {
        head: [["Nome", "Processo", "Tipo/Reg.", "Prisão", "Revisão", "Movim.", "Prz", "Local", "Obs"]],
        body: rows,
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' }, // Reduced font size
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 25 }, // Name
          1: { cellWidth: 25 }, // Processo
          2: { cellWidth: 20 }, // Tipo/Reg
          3: { cellWidth: 20 }, // Prisão
          4: { cellWidth: 20 }, // Revisão
          5: { cellWidth: 20 }, // Movim
          6: { cellWidth: 10 }, // Prazo
          7: { cellWidth: 25 }, // Local
          8: { cellWidth: 'auto' } // Obs
        }
      });
      doc.save(`relatorio_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF: " + error);
    }
  };

  if (loadingSession) return <div className="h-screen w-full flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-justice-600"></div></div>;
  if (!session) return <AuthScreen onLogin={setSession} />;

  return (
    <div className="flex font-sans bg-gray-100 min-h-screen">

      {/* MOBILE BACKDROP */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden glass-effect"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`bg-justice-900 text-white flex-shrink-0 transition-all duration-300 fixed h-full z-30 flex flex-col
        ${isMobile
          ? (isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64')
          : (isSidebarOpen ? 'w-64' : 'w-20')
        }
      `}>
        <div className="p-4 flex items-center gap-3 border-b border-justice-800 h-16">
          <div className="bg-white/10 p-2 rounded-full flex-shrink-0">
            <Scale size={24} className="text-white" />
          </div>
          {(isSidebarOpen || isMobile) && (
            <div>
              <h1 className="font-bold leading-none tracking-tight text-lg">Controle - Presos</h1>
              <span className="text-[10px] text-justice-300 uppercase tracking-widest font-bold">TJPA</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-6 px-2 space-y-2 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('preventive'); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'preventive' ? 'bg-justice-700 text-white shadow-lg' : 'text-justice-200 hover:bg-justice-800 hover:text-white'}`}
          >
            <List size={22} className="flex-shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="font-medium">Preventivos</span>}
          </button>

          <button
            onClick={() => { setActiveTab('home_arrest'); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'home_arrest' ? 'bg-justice-700 text-white shadow-lg' : 'text-justice-200 hover:bg-justice-800 hover:text-white'}`}
          >
            <Home size={22} className="flex-shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="font-medium">Domiciliar</span>}
          </button>

          <button
            onClick={() => { setActiveTab('provisional_definitive'); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'provisional_definitive' ? 'bg-justice-700 text-white shadow-lg' : 'text-justice-200 hover:bg-justice-800 hover:text-white'}`}
          >
            <Users size={22} className="flex-shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="font-medium">Provisório/Definitivo</span>}
          </button>

          <button
            onClick={() => { setActiveTab('civil'); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'civil' ? 'bg-justice-700 text-white shadow-lg' : 'text-justice-200 hover:bg-justice-800 hover:text-white'}`}
          >
            <Scale size={22} className="flex-shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="font-medium">Cíveis</span>}
          </button>

          <button
            onClick={() => { setActiveTab('dashboard'); if (isMobile) setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-justice-700 text-white shadow-lg' : 'text-justice-200 hover:bg-justice-800 hover:text-white'}`}
          >
            <LayoutDashboard size={22} className="flex-shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="font-medium">Painel Gráfico</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-justice-800">
          {(isSidebarOpen || isMobile) ? (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-justice-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs text-justice-300 truncate">Conectado como</p>
                <p className="text-xs font-bold truncate" title={session.user.email}>{session.user.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 rounded-full bg-justice-700 flex items-center justify-center text-xs font-bold" title={session.user.email}>
                {session.user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <button
            onClick={async () => {
              try {
                await supabase.auth.signOut();
                setSession(null);
              } catch (error) {
                console.error("Error signing out:", error);
                setSession(null);
              }
            }}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-justice-950/50 hover:bg-red-900/50 text-justice-200 hover:text-white transition-colors text-sm"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {(isSidebarOpen || isMobile) && <span>Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300
        ${isMobile ? 'ml-0 w-full' : (isSidebarOpen ? 'ml-64' : 'ml-20')}
      `}>

        {/* TOP HEADER */}
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10 w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-justice-600">
              <Menu size={24} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2 cursor-pointer group truncate max-w-[200px] md:max-w-none" onClick={handleEditCourtName}>
              {courtName}
              <Edit size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity flex-shrink-0" />
            </h2>
          </div>

          <div className="text-xs md:text-sm font-medium text-gray-500 hidden sm:block">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <div className="p-4 md:p-6">
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Painel Gerencial</h2>
              <p className="text-gray-500 text-sm">Visualização gráfica e métricas consolidadas</p>
            </div>
            <DashboardCharts defendants={defendants} />
          </div>
        ) : (
          /* LIST VIEW CONTENT */
          <div className="p-4 md:p-6 fade-in">
            {/* Sub-header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Controle de Processos</h2>
                <p className="text-gray-500 text-sm">Gerencie os réus, prazos e movimentações</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button onClick={exportToCSV} className="flex-1 md:flex-none justify-center text-gray-600 hover:text-emerald-600 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-emerald-500 flex items-center gap-2 bg-white transition-all">
                  <Download size={18} /> <span className="hidden sm:inline">CSV</span>
                </button>
                <button onClick={generatePDF} className="flex-1 md:flex-none justify-center text-gray-600 hover:text-red-600 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-red-500 flex items-center gap-2 bg-white transition-all">
                  <FileText size={18} /> <span className="hidden sm:inline">PDF</span>
                </button>
                <button onClick={() => { setEditingId(null); setIsFormOpen(true); }} className="flex-1 md:flex-none justify-center bg-justice-600 hover:bg-justice-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg flex items-center gap-2 transition-all transform hover:-translate-y-0.5 min-w-[120px]">
                  <Plus size={18} /> Novo Réu
                </button>
              </div>
            </div>

            {/* DASHBOARD STATS CARDS (Mini) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Cards layout is already responsive (grid-cols-1 on mobile) */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-1 bg-justice-500"></div>
                <div><p className="text-gray-500 text-xs font-bold uppercase">Total</p><p className="text-3xl font-bold text-gray-800">{stats.total}</p></div>
                <div className="bg-justice-50 p-3 rounded-lg text-justice-600 group-hover:scale-110 transition-transform"><Users size={24} /></div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                <div className={`absolute right-0 top-0 h-full w-1 ${stats.expiredReviews > 0 ? 'bg-red-500' : 'bg-green-500'}`}></div>
                <div><p className="text-gray-500 text-xs font-bold uppercase">Revisão Vencida</p><p className={`text-3xl font-bold ${stats.expiredReviews > 0 ? 'text-red-600' : 'text-gray-800'}`}>{stats.expiredReviews}</p></div>
                <div className={`p-3 rounded-lg group-hover:scale-110 transition-transform ${stats.expiredReviews > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}><AlertOctagon size={24} /></div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-1 bg-orange-400"></div>
                <div><p className="text-gray-500 text-xs font-bold uppercase">Prisão Longa</p><p className="text-3xl font-bold text-gray-800">{stats.longImprisonment}</p></div>
                <div className="bg-orange-50 p-3 rounded-lg text-orange-600 group-hover:scale-110 transition-transform"><Calendar size={24} /></div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-1 bg-yellow-400"></div>
                <div><p className="text-gray-500 text-xs font-bold uppercase">Paralisados</p><p className="text-3xl font-bold text-gray-800">{stats.stalledCases}</p></div>
                <div className="bg-yellow-50 p-3 rounded-lg text-yellow-600 group-hover:scale-110 transition-transform"><Clock size={24} /></div>
              </div>
            </div>

            {/* SEARCH BAR & FILTER */}
            <div className="bg-white rounded-xl shadow-sm p-2 mb-6 border border-gray-200 flex flex-col md:flex-row items-center gap-2">
              <div className="flex-1 flex items-center w-full bg-gray-50 md:bg-transparent rounded-lg md:rounded-none px-2 md:px-0 mb-2 md:mb-0">
                <div className="p-3 text-gray-400"><Search size={20} /></div>
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="hidden md:block h-8 w-px bg-gray-200 mx-2"></div>

              <div className="w-full md:w-auto px-0 md:px-2 md:pr-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full md:w-auto bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-justice-200 focus:border-justice-400"
                >
                  <option value="created_desc">Mais Recentes</option>
                  <option value="review_desc">Sem Revisão (+ tempo)</option>
                  <option value="imprisonment_desc">Tempo Preso (+ tempo)</option>
                  <option value="stalled_desc">Sem Movimentação (+ tempo)</option>
                  <option value="name_asc">Nome (A-Z)</option>
                </select>
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-[1000px] w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[250px]">Réu / Processo</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[150px]">Audiência</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Prisão</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[150px]">Revisão (90d)</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-[200px]">Últ. Movimentação</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Local</th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[120px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {loadingData ? (
                      <tr><td colSpan={7} className="py-20 text-center text-gray-500"><div className="animate-spin h-6 w-6 border-2 border-justice-600 border-t-transparent rounded-full mx-auto mb-2"></div>Carregando dados...</td></tr>
                    ) : sortedDefendants.length === 0 ? (
                      <tr><td colSpan={7} className="py-20 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                    ) : (
                      sortedDefendants.map((defendant) => {
                        const daysImprisoned = calculateDaysDiff(defendant.arrestDate);
                        const daysSinceReview = calculateDaysDiff(defendant.lastReviewDate);
                        const daysStalled = calculateDaysDiff(defendant.lastMovementDate);
                        const isStalled = daysStalled > defendant.deadline;

                        return (
                          <tr key={defendant.id} className="hover:bg-blue-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900 flex items-center gap-2">
                                  {defendant.name}
                                  {defendant.linkedDefendantIds && defendant.linkedDefendantIds.length > 0 && (
                                    <span className="text-blue-500" title="Possui vínculo com outro preso"><LinkIcon size={14} /></span>
                                  )}
                                </span>
                                <span className="text-xs text-gray-500 font-mono mt-0.5">{defendant.caseNumber}</span>
                                <span className="inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 w-fit">
                                  {defendant.penalType}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              {defendant.hasHearing && defendant.hearingDate ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-justice-700 flex items-center gap-1">
                                    <CalendarDays size={14} />
                                    {new Date(defendant.hearingDate).toLocaleDateString('pt-BR')}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(defendant.hearingDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className={`text-xs font-bold mt-1 ${calculateDaysUntil(defendant.hearingDate) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {calculateDaysUntil(defendant.hearingDate) > 0
                                      ? `Faltam ${calculateDaysUntil(defendant.hearingDate)} dias`
                                      : 'Realizada/Passou'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>

                            <td className="px-6 py-4">
                              <div className={`inline-flex flex-col`}>
                                <span className={`text-sm font-bold ${daysImprisoned > THRESHOLD_IMPRISONMENT ? 'text-orange-600' : 'text-gray-700'}`}>{daysImprisoned} dias</span>
                                <span className="text-xs text-gray-400">{formatDate(defendant.arrestDate)}</span>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${daysSinceReview > THRESHOLD_REVIEW ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                                <div className="flex flex-col">
                                  <span className={`text-sm font-medium ${daysSinceReview > THRESHOLD_REVIEW ? 'text-red-700' : 'text-gray-700'}`}>{daysSinceReview} dias atrás</span>
                                  <span className="text-xs text-gray-400">{formatDate(defendant.lastReviewDate)}</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-col max-w-[180px]">
                                <span className="text-sm text-gray-900 truncate" title={defendant.movementType}>{defendant.movementType}</span>
                                <div className={`flex items-center gap-1 mt-1 text-xs ${isStalled ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                  {isStalled ? <AlertTriangle size={12} /> : <Clock size={12} />}
                                  <span>{daysStalled}d paralisado (Prazo: {defendant.deadline}d)</span>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-700">{defendant.prison}</span>
                                {defendant.rji && <span className="text-[10px] text-gray-400">RJI: {defendant.rji}</span>}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(defendant)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Editar">
                                  <Edit size={16} />
                                </button>
                                <button onClick={() => handleDelete(defendant.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Excluir">
                                  <Trash size={16} />
                                </button>
                                {defendant.obs && (
                                  <div className="group/tooltip relative">
                                    <button className="p-1.5 text-gray-400 hover:text-justice-600 transition-colors"><Info size={16} /></button>
                                    <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg hidden group-hover/tooltip:block z-50">
                                      {defendant.obs}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Modal Form */}
      {isFormOpen && (
        <DefendantForm
          initialData={editingId ? defendants.find(d => d.id === editingId) : undefined}
          defendants={defendants} // Passar lista completa para linkagem
          onSubmit={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingId(null); }}
        />
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