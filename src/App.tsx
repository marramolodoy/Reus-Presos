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
import { ProductivityDashboard } from './modules/Productivity/ProductivityDashboard';
import { FormatterDashboard } from './modules/Formatter/FormatterDashboard';

import { APP_MODULES, APP_VERSION } from './constants';
import { useUserRole } from './hooks/useUserRole';

// Types for Module Switcher
type ModuleType = typeof APP_MODULES[number]['id'];

import { SpeedInsights } from "@vercel/speed-insights/react";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleType>('notes');

  // Persistence for Court Name (Header)
  const [courtName, setCourtName] = useState(() => localStorage.getItem('court_name') || 'Vara Única de Goianésia do Pará');

  // Persistence for App Branding (Sidebar)
  const [appTitle, setAppTitle] = useState(() => localStorage.getItem('app_title') || 'Controle Unidade');
  const [appSubtitle, setAppSubtitle] = useState(() => localStorage.getItem('app_subtitle') || 'Vara Única');
  const [formatterSettings, setFormatterSettings] = useState(() => {
    const saved = localStorage.getItem('formatter_settings');
    return saved ? JSON.parse(saved) : {
      fontFamily: 'Century Gothic',
      fontSize: 13,
      marginTop: 1.0,
      marginBottom: 1.0,
      marginLeft: 1.0,
      marginRight: 1.0,
      indent: 2.0
    };
  });

  // Get Role AND Unit
  const { role, unit, unitId, loading: loadingRole, checkPermission, isAdmin } = useUserRole(session);

  // Auto-switch to an allowed module if current one isn't permitted
  useEffect(() => {
    if (loadingRole || !session) return;
    
    const currentModuleObj = APP_MODULES.find(m => m.id === activeModule);
    if (!currentModuleObj) return;

    const isAllowed = ((currentModuleObj as any).adminOnly) 
      ? isAdmin 
      : checkPermission(currentModuleObj.permissionKey, 'view');

    if (!isAllowed) {
      const firstAllowed = APP_MODULES.find(item => {
        if ((item as any).adminOnly) return isAdmin;
        return checkPermission(item.permissionKey, 'view');
      });

      if (firstAllowed) {
        setActiveModule(firstAllowed.id);
      }
    }
  }, [loadingRole, role, checkPermission, isAdmin, activeModule, session]);

  // Force Version update Check (Active Polling)
  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Use a timestamp to bypass any intermediate caching
        const response = await fetch(`/version.json?t=${Date.now()}`, { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.version && data.version !== APP_VERSION) {
            console.log(`Nova versão detectada (${data.version}). Sistema atualizando...`);
            // Brief delay before reload to avoid interruptive loops
            setTimeout(() => window.location.reload(), 1000);
          }
        }
      } catch (err) {
        // Silently fail to not disturb user experience
        console.debug('Falha ao verificar versão:', err);
      }
    };

    // Check on mount and every 2 minutes
    checkVersion();
    const interval = setInterval(checkVersion, 120000);
    return () => clearInterval(interval);
  }, []);

  // Load Unit Settings from Supabase
  useEffect(() => {
    if (unit && session) {
      const fetchSettings = async () => {
        const { data, error } = await supabase
          .from('unit_settings')
          .select('court_name, app_title, app_subtitle, formatter_font, formatter_font_size, formatter_margin_top, formatter_margin_bottom, formatter_margin_left, formatter_margin_right, formatter_indent')
          .eq('unit', unit)
          .single();

        if (data) {
          if (data.court_name) {
            setCourtName(data.court_name);
            localStorage.setItem('court_name', data.court_name);
          }
          if (data.app_title) {
            setAppTitle(data.app_title);
            localStorage.setItem('app_title', data.app_title);
          }
          if (data.app_subtitle) {
            setAppSubtitle(data.app_subtitle);
            localStorage.setItem('app_subtitle', data.app_subtitle);
          }
          if (data.formatter_font) {
            const settings = {
              fontFamily: data.formatter_font || 'Century Gothic',
              fontSize: data.formatter_font_size || 13,
              marginTop: data.formatter_margin_top !== null && data.formatter_margin_top !== undefined ? data.formatter_margin_top : 1.0,
              marginBottom: data.formatter_margin_bottom !== null && data.formatter_margin_bottom !== undefined ? data.formatter_margin_bottom : 1.0,
              marginLeft: data.formatter_margin_left !== null && data.formatter_margin_left !== undefined ? data.formatter_margin_left : 1.0,
              marginRight: data.formatter_margin_right !== null && data.formatter_margin_right !== undefined ? data.formatter_margin_right : 1.0,
              indent: data.formatter_indent !== null && data.formatter_indent !== undefined ? data.formatter_indent : 2.0
            };
            setFormatterSettings(settings);
            localStorage.setItem('formatter_settings', JSON.stringify(settings));
          }
        }
      };
      fetchSettings();
    }
  }, [unit, session]);


  const handleEditCourtName = async () => {
    if (role !== 'admin') {
      alert("Apenas administradores podem alterar o nome da Unidade.");
      return;
    }
    const newName = prompt("Digite o nome da Vara/Comarca:", courtName);
    if (newName && newName.trim() !== '') {
      setCourtName(newName);
      localStorage.setItem('court_name', newName);

      if (unit) {
        await supabase.from('unit_settings').upsert({
          unit,
          unit_id: unitId, // Add unit_id for future proofing
          court_name: newName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'unit' });
      }
    }
  };

  const handleEditAppDetails = async () => {
    if (role !== 'admin') {
      alert("Apenas administradores podem alterar os títulos do sistema.");
      return;
    }

    const newTitle = prompt("Título do Sistema (Linha 1):", appTitle);
    if (newTitle !== null) {
      const titleToSave = newTitle || 'Controle Unidade';
      setAppTitle(titleToSave);
      localStorage.setItem('app_title', titleToSave);

      const newSubtitle = prompt("Subtítulo (Linha 2):", appSubtitle);
      if (newSubtitle !== null) {
        const subtitleToSave = newSubtitle || 'Vara Única';
        setAppSubtitle(subtitleToSave);
        localStorage.setItem('app_subtitle', subtitleToSave);

        if (unit) {
          await supabase.from('unit_settings').upsert({
            unit,
            unit_id: unitId, // Add unit_id for future proofing
            app_title: titleToSave,
            app_subtitle: subtitleToSave,
            updated_at: new Date().toISOString()
          }, { onConflict: 'unit' });
        }
      }
    }
  };

  const handleUpdateFormatterSettings = async (newSettings: any) => {
    if (role !== 'admin') {
      alert("Apenas administradores podem atualizar o padrão oficial da Unidade.");
      return;
    }

    setFormatterSettings(newSettings);
    localStorage.setItem('formatter_settings', JSON.stringify(newSettings));

    if (unit) {
      await supabase.from('unit_settings').upsert({
        unit,
        unit_id: unitId,
        formatter_font: newSettings.fontFamily,
        formatter_font_size: newSettings.fontSize,
        formatter_margin_top: newSettings.marginTop,
        formatter_margin_bottom: newSettings.marginBottom,
        formatter_margin_left: newSettings.marginLeft,
        formatter_margin_right: newSettings.marginRight,
        formatter_indent: newSettings.indent,
        updated_at: new Date().toISOString()
      }, { onConflict: 'unit' });
    }
  };

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
        return <NotesBoard session={session} onNavigate={setActiveModule} />;
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
      case 'productivity':
        return <ProductivityDashboard session={session} />;
      case 'formatter':
        return <FormatterDashboard 
          session={session} 
          unitSettings={formatterSettings} 
          onUpdateSettings={handleUpdateFormatterSettings}
          isAdmin={role === 'admin'}
        />;
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
      <SpeedInsights />
    </div>
  );
}