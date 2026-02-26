import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, StickyNote, AlertCircle, FileText, Gavel, Calendar, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppNotification } from '../types';

interface NotificationCenterProps {
    session: any;
    onNavigate?: (module: string) => void;
}

const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'agora';
    if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} h`;
    if (diffInSeconds < 604800) return `há ${Math.floor(diffInSeconds / 86400)} dias`;
    return date.toLocaleDateString('pt-BR');
};

const getIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('nota') || lowerTitle.includes('aviso')) return <StickyNote size={16} className="text-yellow-500" />;
    if (lowerTitle.includes('processo') || lowerTitle.includes('criminal')) return <Gavel size={16} className="text-red-500" />;
    if (lowerTitle.includes('prazo') || lowerTitle.includes('agenda')) return <Calendar size={16} className="text-blue-500" />;
    if (lowerTitle.includes('alerta') || lowerTitle.includes('erro')) return <AlertCircle size={16} className="text-orange-500" />;
    return <Info size={16} className="text-gray-400" />;
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ session, onNavigate }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        if (!session?.user?.id) return;

        try {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.read).length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const markAsRead = async (id: string, currentReadStatus: boolean) => {
        if (currentReadStatus) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (!error) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', session.user.id)
                .eq('read', false);

            if (!error) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleNotificationClick = (notif: AppNotification) => {
        markAsRead(notif.id, notif.read);
        setIsOpen(false);

        if (onNavigate && notif.link) {
            // Map link path to module ID
            const link = notif.link.toLowerCase();
            if (link.includes('avisos') || link.includes('notes')) onNavigate('notes');
            else if (link.includes('criminal')) onNavigate('criminal');
            else if (link.includes('civil')) onNavigate('civil');
            else if (link.includes('admin')) onNavigate('admin');
            else if (link.includes('produtividade') || link.includes('productivity')) onNavigate('productivity');
            else if (link.includes('team') || link.includes('equipe')) onNavigate('team');
            // Add more mappings as needed
        }
    };

    // Subscriptions for real-time updates
    useEffect(() => {
        if (!session?.user?.id) return;

        fetchNotifications();

        const subscription = supabase
            .channel('public:notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${session.user.id}`
            }, (payload) => {
                const newNotif = payload.new as AppNotification;
                setNotifications(prev => [newNotif, ...prev]);
                setUnreadCount(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [session]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative mr-2 md:mr-4" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-all duration-300 ${isOpen ? 'bg-justice-100 text-justice-700' : 'text-gray-500 hover:text-justice-600 hover:bg-gray-100'}`}
                title="Notificações"
            >
                <Bell size={20} className={unreadCount > 0 ? 'animate-wiggle' : ''} />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-black/5">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center backdrop-blur-xl">
                        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            Notificações
                            {unreadCount > 0 && <span className="bg-justice-100 text-justice-700 text-[10px] px-2 py-0.5 rounded-full">{unreadCount} novas</span>}
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-justice-600 hover:text-justice-800 font-medium flex items-center gap-1 hover:bg-justice-50 px-2 py-1 rounded transition-colors"
                            >
                                <Check size={12} />
                                Marcar todas lidas
                            </button>
                        )}
                    </div>

                    <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                                <div className="bg-gray-50 p-4 rounded-full mb-3">
                                    <Bell size={24} className="text-gray-300" />
                                </div>
                                <p className="text-sm font-medium text-gray-500">Tudo limpo por aqui!</p>
                                <p className="text-xs mt-1">Nenhuma notificação nova.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {notifications.map(notif => (
                                    <li
                                        key={notif.id}
                                        className={`group relative p-4 hover:bg-gray-50 transition-all cursor-pointer ${notif.read ? 'opacity-70 bg-white' : 'bg-blue-50/30'}`}
                                        onClick={() => handleNotificationClick(notif)}
                                    >
                                        <div className="flex gap-3 items-start">
                                            <div className={`mt-1 p-2 rounded-lg flex-shrink-0 ${notif.read ? 'bg-gray-100' : 'bg-white shadow-sm border border-gray-100'}`}>
                                                {getIcon(notif.title)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className={`text-sm font-semibold truncate pr-4 ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</p>
                                                    <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap ml-2">
                                                        {getTimeAgo(notif.created_at)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{notif.message}</p>
                                            </div>
                                            {!notif.read && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full shadow-sm shadow-blue-200" />
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
                            <button className="text-xs text-gray-500 hover:text-gray-700 font-medium py-1 px-3 hover:bg-gray-100 rounded transition-colors w-full">
                                Ver todas as notificações
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
