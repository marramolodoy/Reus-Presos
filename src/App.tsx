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
import { CriticalIssuesDashboard } from './modules/CriticalIssues/CriticalIssuesDashboard';
import { SchedulesDashboard } from './modules/Schedules/SchedulesDashboard';
import { TeamDashboard } from './modules/Team/TeamDashboard';
import { PenhoraDashboard } from './modules/Penhora/PenhoraDashboard';
import { SeizedAssetsDashboard } from './modules/SeizedAssets/SeizedAssetsDashboard';

import { APP_MODULES } from './constants';
import { useUserRole } from './hooks/useUserRole';

// Types for Module Switcher
type ModuleType = typeof APP_MODULES[number]['id'];

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

  const { role, loading: loadingRole } = useUserRole(session);

  useEffect(() => {
    // "Original Settings" logic: If the user is independent (no entry in user_roles), 
    // reset the custom branding to defaults.
    if (!loadingRole && session) {
      const checkOrphan = async () => {
        const { data } = await supabase.from('user_roles').select('id').eq('user_id', session.user.id).single();
        if (!data) {
          console.log('Orphan user detected: Resetting branding to defaults');
          localStorage.removeItem('court_name');
          localStorage.removeItem('app_title');
          localStorage.removeItem('app_subtitle');
          setCourtName('Vara Única de Goianésia do Pará');
          setAppTitle('Controle Unidade');
          setAppSubtitle('Vara Única');
        }
      };
      checkOrphan();
    }
  }, [loadingRole, session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (loadingSession) return <div className="h-screen w-full flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-justice-600"></div></div>;

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
      case 'critical_issues':
        return <CriticalIssuesDashboard session={session} />;
      case 'schedules':
        return <SchedulesDashboard session={session} />;
      case 'team':
        return <TeamDashboard session={session} />;
      case 'penhora':
        return <PenhoraDashboard session={session} />;
      case 'seized_assets':
        return <SeizedAssetsDashboard session={session} />;
      default:
        return <CriminalDashboard session={session} courtName={courtName} />;
    }
  };

  return (
    <div id="app-container">
      {!session ? (
        <AuthScreen onLogin={setSession} />
      ) : (
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
      )}
    </div>
  );
}