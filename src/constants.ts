import { Scale, StickyNote, Gavel, FileText, UserCog, AlertTriangle, CalendarRange, Users, ShieldAlert } from 'lucide-react';

export const CIVIL_CATEGORIES = [
    'Urgentes',
    'Acolhidos',
    'Apreendidos',
    'Infracionais',
    'Adoção',
    'RPV',
    'Precatório',
    'Alvarás',
] as const;

export const APP_MODULES = [
    { id: 'criminal', label: 'Criminal', icon: Gavel, permissionKey: 'criminal' },
    { id: 'civil', label: 'Cível & Menores', icon: Scale, permissionKey: 'civil' },
    { id: 'lawyer', label: 'Req. Advogados', icon: UserCog, permissionKey: 'lawyer_requests' },
    { id: 'notes', label: 'Avisos / Mural', icon: StickyNote, permissionKey: 'sticky_notes' },
    { id: 'admin', label: 'Administrativo', icon: FileText, permissionKey: 'administrative' },
    { id: 'rogatory', label: 'Carta Precatória', icon: UserCog, permissionKey: 'rogatory' },
    { id: 'critical_issues', label: 'Pendências Críticas', icon: AlertTriangle, permissionKey: 'critical_issues' },
    { id: 'penhora', label: 'Penhora / Restrições', icon: ShieldAlert, permissionKey: 'penhora' },
    { id: 'schedules', label: 'Audiências & Perícias', icon: CalendarRange, permissionKey: 'schedules' },
    { id: 'team', label: 'Minha Equipe', icon: Users, permissionKey: 'team', adminOnly: true },
] as const;
