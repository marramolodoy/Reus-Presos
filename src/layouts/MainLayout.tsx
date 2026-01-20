import React, { useState, useEffect } from 'react';
import { LogOut, Scale, Menu, StickyNote, Gavel, FileText, UserCog, Edit, AlertTriangle, CalendarRange } from 'lucide-react';



interface MainLayoutProps {
    children: React.ReactNode;
    session: any;
    onLogout: () => void;
    courtName: string;
    onEditCourtName: () => void;
    appTitle: string;
    appSubtitle: string;
    onEditAppDetails: () => void;
    activeModule: 'criminal' | 'civil' | 'admin' | 'notes' | 'rogatory' | 'lawyer' | 'critical_issues' | 'schedules';
    onModuleChange: (module: 'criminal' | 'civil' | 'admin' | 'notes' | 'rogatory' | 'lawyer' | 'critical_issues' | 'schedules') => void;


}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    session,
    onLogout,
    courtName,
    onEditCourtName,
    appTitle,
    appSubtitle,
    onEditAppDetails,
    activeModule,
    onModuleChange
}) => {
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setSidebarOpen(true);
            } else {
                setSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const navItems = [
        { id: 'criminal', label: 'Criminal', icon: Gavel },
        { id: 'civil', label: 'Cível & Menores', icon: Scale },
        { id: 'lawyer', label: 'Req. Advogados', icon: UserCog },
        { id: 'notes', label: 'Avisos / Mural', icon: StickyNote },
        { id: 'admin', label: 'Administrativo', icon: FileText },
        { id: 'rogatory', label: 'Carta Precatória', icon: UserCog },
        { id: 'critical_issues', label: 'Pendências Críticas', icon: AlertTriangle },
        { id: 'schedules', label: 'Audiências & Perícias', icon: CalendarRange },
    ] as const;

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
                        <div onClick={onEditAppDetails} className="cursor-pointer hover:bg-white/5 p-1 rounded transition-colors group">
                            <h1 className="font-bold leading-none tracking-tight text-lg flex items-center gap-2">
                                {appTitle}
                                <Edit size={12} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                            </h1>
                            <span className="text-[10px] text-justice-300 uppercase tracking-widest font-bold block mt-1">{appSubtitle}</span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 py-6 px-2 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { onModuleChange(item.id); if (isMobile) setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeModule === item.id ? 'bg-justice-700 text-white shadow-lg' : 'text-justice-200 hover:bg-justice-800 hover:text-white'}`}
                        >
                            <item.icon size={22} className="flex-shrink-0" />
                            {(isSidebarOpen || isMobile) && <span className="font-medium">{item.label}</span>}
                        </button>
                    ))}
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
                        onClick={onLogout}
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
                        <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2 cursor-pointer group truncate max-w-[200px] md:max-w-none" onClick={onEditCourtName}>
                            {courtName}
                            <Edit size={14} className="opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity flex-shrink-0" />
                        </h2>
                    </div>

                    <div className="text-xs md:text-sm font-medium text-gray-500 hidden sm:block">
                        {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                </header>

                {/* DYNAMIC CONTENT */}
                <div className="flex-1">
                    {children}
                </div>

            </main>
        </div>
    );
};
