import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthScreen } from './components/AuthScreen';
import { MainLayout } from './layouts/MainLayout';
import { CriminalDashboard } from './modules/Criminal/CriminalDashboard';
// UtilsDashboard removed
import { AdminDashboard } from './modules/Administrative/AdminDashboard';
import { NotesBoard } from './modules/Notes/NotesBoard';
import { CivilDashboard } from './modules/Civil/CivilDashboard';
import { RogatoryDashboard } from './modules/Rogatory/RogatoryDashboard';
import { LawyerDashboard } from './modules/Lawyer/LawyerDashboard';

// Types for Module Switcher
type ModuleType = 'criminal' | 'civil' | 'admin' | 'notes' | 'rogatory' | 'lawyer';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleType>('notes');

  // Persistence for Court Name (Header)
  const [courtName, setCourtName] = useState(() => localStorage.getItem('court_name') || 'Vara Única de Goianésia do Pará');

  // Persistence for App Branding (Sidebar)
  const [appTitle, setAppTitle] = useState(() => localStorage.getItem('app_title') || 'Controle Unidade');
  const [appSubtitle, setAppSubtitle] = useState(() => localStorage.getItem('app_subtitle') || 'Vara Única');

  const handleEditCourtName = () => {
    const newName = prompt("Digite o nome da Vara/Comarca:", courtName);
    if (newName && newName.trim() !== '') {
      setCourtName(newName);
      localStorage.setItem('court_name', newName);
    }
  };

  const handleEditAppDetails = () => {
    const newTitle = prompt("Título do Sistema (Linha 1):", appTitle);
    if (newTitle !== null) {
      setAppTitle(newTitle || 'Controle Unidade');
      localStorage.setItem('app_title', newTitle || 'Controle Unidade');

      const newSubtitle = prompt("Subtítulo (Linha 2):", appSubtitle);
      if (newSubtitle !== null) {
        setAppSubtitle(newSubtitle || 'Vara Única');
        localStorage.setItem('app_subtitle', newSubtitle || 'Vara Única');
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (loadingSession) return <div className="h-screen w-full flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-justice-600"></div></div>;
  if (!session) return <AuthScreen onLogin={setSession} />;

  const renderModule = () => {
    switch (activeModule) {
      case 'criminal':
        return <CriminalDashboard session={session} courtName={courtName} />;
      case 'notes':
        return <NotesBoard session={session} />;
      case 'civil':
        return <CivilDashboard session={session} />;
      case 'admin':
        return <AdminDashboard session={session} />;
      case 'rogatory':
        return <RogatoryDashboard session={session} />;
      case 'lawyer':
        return <LawyerDashboard session={session} />;
      default:
        return <CriminalDashboard session={session} courtName={courtName} />;
    }
  };

  return (
    <MainLayout
      session={session}
      onLogout={async () => { await supabase.auth.signOut(); setSession(null); }}
      courtName={courtName}
      onEditCourtName={handleEditCourtName}
      appTitle={appTitle}
      appSubtitle={appSubtitle}
      onEditAppDetails={handleEditAppDetails}
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    >
      {renderModule()}
    </MainLayout>
  );
}