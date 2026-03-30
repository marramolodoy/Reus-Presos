import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Gavel, Stethoscope, Clock, CheckCircle, Calendar, LayoutGrid, List, Plus, Tag, X, Trash2, Lock, AlertCircle, Baby, User, Edit2 } from 'lucide-react';
import { PendingSchedule } from '../../types';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';

interface ScheduleCalendarProps {
    schedules: PendingSchedule[];
    onItemClick: (item: PendingSchedule) => void;
    currentTab: 'hearing' | 'expertise';
    session: any;
}

type ViewMode = 'month' | 'week' | 'day';

interface DayTag {
    id: string;
    date: string; // YYYY-MM-DD
    label: string;
    color: string;
}

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({ schedules, onItemClick, currentTab, session }) => {
    const { unitId } = useUserRole(session);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<ViewMode>('month');

    // Tag State
    const [tags, setTags] = useState<DayTag[]>([]);
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [selectedDateForTag, setSelectedDateForTag] = useState<Date | null>(null);
    const [newTagLabel, setNewTagLabel] = useState('');
    const [editingTagId, setEditingTagId] = useState<string | null>(null);

    // Fetch Tags
    const fetchTags = async () => {
        if (!session) return;
        const { data, error } = await supabase.from('calendar_day_tags').select('*');
        if (data) setTags(data);
    };

    useEffect(() => {
        fetchTags();
    }, [currentDate, session]); // Re-fetch when month changes

    const handleOpenAddTag = (date: Date) => {
        setSelectedDateForTag(date);
        setNewTagLabel('');
        setEditingTagId(null);
        setIsTagModalOpen(true);
    };

    const handleOpenEditTag = (tag: DayTag, e: React.MouseEvent) => {
        e.stopPropagation();
        // Parse date carefully to avoid timezone shifts on just "YYYY-MM-DD"
        // Creating date from string + time sets it correctly relative to local if needed, 
        // but let's just use the string for display/logic where possible.
        // For the modal "selectedDate" display:
        const parts = tag.date.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        setSelectedDateForTag(d);
        setNewTagLabel(tag.label);
        setEditingTagId(tag.id);
        setIsTagModalOpen(true);
    };

    const handleSaveTag = async () => {
        if (!selectedDateForTag || !newTagLabel.trim() || !session) return;

        const dateStr = selectedDateForTag.toISOString().split('T')[0];

        if (editingTagId) {
            // Update
            const { error } = await supabase
                .from('calendar_day_tags')
                .update({ label: newTagLabel })
                .eq('id', editingTagId);

            if (error) alert('Erro ao atualizar: ' + error.message);
        } else {
            // Insert
            const payload = {
                date: dateStr,
                label: newTagLabel,
                user_id: session.user.id,
                unit_id: unitId,
                color: 'blue'
            };
            const { error } = await supabase.from('calendar_day_tags').insert([payload]);
            if (error) alert('Erro ao adicionar: ' + error.message);
        }

        setNewTagLabel('');
        setEditingTagId(null);
        setIsTagModalOpen(false);
        fetchTags();
    };

    const handleDeleteTag = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('Excluir etiqueta?')) return;

        const { error } = await supabase.from('calendar_day_tags').delete().eq('id', id);
        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            fetchTags();
        }
    };

    // Filter by Month/Year/Day
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const navigate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (view === 'month') {
            newDate.setMonth(month + (direction === 'next' ? 1 : -1));
        } else if (view === 'week') {
            newDate.setDate(day + (direction === 'next' ? 7 : -7));
        } else {
            newDate.setDate(day + (direction === 'next' ? 1 : -1));
        }
        setCurrentDate(newDate);
    };

    const getStartOfWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day; // adjust when day is sunday
        return new Date(d.setDate(diff));
    };

    const getItemsForDay = (date: Date) => {
        return schedules.filter(s => {
            if (!s.scheduledDate) return false;
            const sDate = new Date(s.scheduledDate);
            return sDate.getDate() === date.getDate() &&
                sDate.getMonth() === date.getMonth() &&
                sDate.getFullYear() === date.getFullYear() &&
                s.type === currentTab &&
                s.status !== 'resolved';
        }).sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime());
    };

    const getTagsForDay = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return tags.filter(t => t.date === dateStr);
    };

    const ScheduleItem: React.FC<{ item: PendingSchedule }> = ({ item }) => {
        let bgClass = '';
        let borderClass = '';
        let textClass = '';

        if (item.completionStatus === 'completed') {
            bgClass = 'bg-green-100 hover:bg-green-200';
            borderClass = 'border-green-200';
            textClass = 'text-green-900';
        } else if (item.completionStatus === 'partial') {
            bgClass = 'bg-orange-100 hover:bg-orange-200';
            borderClass = 'border-orange-200';
            textClass = 'text-orange-900';
        } else if (item.completionStatus === 'pending' || !item.completionStatus) {
            bgClass = 'bg-red-50 hover:bg-red-100';
            borderClass = 'border-red-200';
            textClass = 'text-red-900';
        }

        const isReuPreso = item.tags?.includes('Réu Preso');
        const isUrgente = item.tags?.includes('Urgente');
        const isMenor = item.tags?.includes('Menor');
        const isIdoso = item.tags?.includes('Idoso');

        return (
            <button
                onClick={() => onItemClick(item)}
                className={`text-xs text-left p-1.5 rounded border shadow-sm transition-all hover:scale-[1.02] flex flex-col gap-0.5 mb-1 w-full ${bgClass} ${borderClass} ${textClass} relative`}
            >
                <div className="font-bold flex justify-between items-center w-full">
                    <span className="flex items-center gap-1">
                        {new Date(item.scheduledDate!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {isReuPreso && <Lock size={12} className="text-red-600 fill-red-100" />}
                    </span>
                    <div className="flex gap-0.5">
                        {isUrgente && <AlertCircle size={10} className="text-orange-600" />}
                        {isMenor && <Baby size={10} className="text-blue-600" />}
                        {isIdoso && <User size={10} className="text-purple-600" />}
                        {item.type === 'hearing' ? <Gavel size={10} /> : <Stethoscope size={10} />}
                    </div>
                </div>
                <div className="truncate w-full font-medium text-[10px] leading-tight" title={item.processNumber}>
                    {item.processNumber}
                </div>
                <div className="truncate w-full opacity-75" title={item.subject}>
                    {item.subject}
                </div>
            </button>
        );
    };

    const renderMonth = () => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const days = [];

        // Empty cells
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[8rem] bg-gray-50/50 border-r border-b border-gray-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const items = getItemsForDay(date);
            const dayTags = getTagsForDay(date);
            const isToday = new Date().toDateString() === date.toDateString();

            days.push(
                <div key={d} className={`min-h-[8rem] border-r border-b border-gray-100 p-1 md:p-2 overflow-y-auto custom-scrollbar hover:bg-gray-50 transition-colors group relative ${isToday ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                        <button
                            onClick={() => { setCurrentDate(date); setView('day'); }}
                            className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors ${isToday ? 'text-blue-600' : 'text-gray-700'}`}
                            title="Ver Dia"
                        >
                            {d}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenAddTag(date); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                            title="Adicionar Etiqueta"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Tags */}
                    {dayTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                            {dayTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={(e) => handleOpenEditTag(tag, e)}
                                    className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded flex items-center gap-1 group/tag hover:bg-indigo-200 transition-colors"
                                >
                                    {tag.label}
                                    <div onClick={(e) => handleDeleteTag(tag.id, e)} className="hidden group-hover/tag:block text-indigo-900 hover:text-red-600 p-0.5 rounded-full hover:bg-indigo-300">
                                        <X size={8} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div>{items.map(item => <ScheduleItem key={item.id} item={item} />)}</div>
                </div>
            );
        }
        return <div className="grid grid-cols-7 border-l border-t border-gray-100">{days}</div>;
    };

    const renderWeek = () => {
        const startOfWeek = getStartOfWeek(currentDate);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);
            const items = getItemsForDay(date);
            const dayTags = getTagsForDay(date);
            const isToday = new Date().toDateString() === date.toDateString();

            days.push(
                <div key={i} className={`flex-1 border-r border-gray-200 min-h-[300px] flex flex-col ${isToday ? 'bg-blue-50/30' : ''}`}>
                    <div className={`p-2 border-b font-medium text-center relative group ${isToday ? 'text-blue-600 bg-blue-50' : 'text-gray-600 bg-gray-50'}`}>
                        <div>{weekDays[date.getDay()]} {date.getDate()}</div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenAddTag(date); }}
                            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                        >
                            <Plus size={14} />
                        </button>
                        {/* Tags in Week Header */}
                        {dayTags.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                                {dayTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={(e) => handleOpenEditTag(tag, e)}
                                        className="text-[9px] px-1 py-0.5 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200"
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-2 flex-1 overflow-y-auto space-y-2">
                        {items.length > 0 ? items.map(item => <ScheduleItem key={item.id} item={item} />) : <div className="text-xs text-gray-400 text-center mt-4">-</div>}
                    </div>
                </div>
            );
        }
        return <div className="flex border border-gray-200 rounded-lg overflow-hidden h-[600px]">{days}</div>;
    };

    const renderDay = () => {
        const items = getItemsForDay(currentDate);
        const dayTags = getTagsForDay(currentDate);
        const isToday = new Date().toDateString() === currentDate.toDateString();

        return (
            <div className="border border-gray-200 rounded-lg overflow-hidden h-full bg-white flex flex-col">
                <div className={`p-4 border-b text-center font-bold text-lg relative ${isToday ? 'text-blue-600 bg-blue-50' : 'text-gray-800 bg-gray-50'}`}>
                    {weekDays[currentDate.getDay()]}, {currentDate.getDate()} de {monthNames[currentDate.getMonth()]}

                    <button
                        onClick={() => { handleOpenAddTag(currentDate); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                        title="Adicionar Etiqueta"
                    >
                        <Tag size={18} />
                    </button>
                </div>

                {/* Tags Section */}
                {dayTags.length > 0 && (
                    <div className="p-2 bg-gray-50 border-b flex flex-wrap justify-center gap-2">
                        {dayTags.map(tag => (
                            <span key={tag.id} className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full flex items-center gap-2 font-medium">
                                {tag.label}
                                <button onClick={(e) => handleOpenEditTag(tag, e)} className="text-indigo-600 hover:text-indigo-900"><Edit2 size={10} /></button>
                                <button onClick={(e) => handleDeleteTag(tag.id, e)} className="text-indigo-900 hover:text-red-600">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="p-4 flex-1 overflow-y-auto">
                    {items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <Clock size={48} className="mb-4 opacity-20" />
                            <p>Nenhum agendamento para este dia.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-w-3xl mx-auto">
                            {items.map(item => (
                                <div key={item.id} onClick={() => onItemClick(item)} className={`flex gap-4 p-4 border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer bg-white group hover:border-blue-300 relative overflow-hidden`}>

                                    {/* Status Stripe */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 
                                        ${item.completionStatus === 'completed' ? 'bg-green-500' :
                                            item.completionStatus === 'partial' ? 'bg-orange-500' :
                                                'bg-red-500'}`}>
                                    </div>

                                    <div className={`flex flex-col items-center justify-center min-w-[5rem] px-2 py-1 rounded-lg ml-2 ${item.type === 'hearing' ? 'bg-cyan-50 text-cyan-800' : 'bg-purple-50 text-purple-800'}`}>
                                        <span className="text-lg font-bold">{new Date(item.scheduledDate!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <div className="text-[10px] uppercase font-bold tracking-wider">{item.type === 'hearing' ? 'Audiência' : 'Perícia'}</div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{item.subject}</h4>
                                                {item.tags?.includes('Réu Preso') && <Lock size={14} className="text-red-600" />}
                                                {item.tags?.includes('Urgente') && <AlertCircle size={14} className="text-orange-600" />}
                                            </div>
                                            <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{item.processNumber}</div>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{item.obs || 'Sem observações'}</p>
                                        <div className="flex gap-2 mt-3">
                                            {item.tags?.map(t => <span key={t} className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100">{t}</span>)}
                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 uppercase">{item.competence}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200 flex flex-col h-full animate-fade-in relative">
            {/* Tag Modal */}
            {isTagModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                    <div className="bg-white p-4 rounded-lg shadow-xl border w-72 animate-scale-in">
                        <h3 className="font-bold text-gray-800 mb-3">{editingTagId ? 'Editar Etiqueta' : 'Adicionar Etiqueta'}</h3>
                        <p className="text-xs text-gray-500 mb-3">Para o dia {selectedDateForTag?.toLocaleDateString('pt-BR')}</p>
                        <input
                            autoFocus
                            type="text"
                            className="w-full p-2 border rounded mb-3 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                            placeholder="Ex: Feriado, Sem Pauta..."
                            value={newTagLabel}
                            onChange={(e) => setNewTagLabel(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTag()}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsTagModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                            <button onClick={handleSaveTag} className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded font-bold">Salvar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Calendar Header */}
            <div className={`p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 ${currentTab === 'hearing' ? 'bg-cyan-50/50' : 'bg-purple-50/50'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${currentTab === 'hearing' ? 'bg-cyan-100 text-cyan-700' : 'bg-purple-100 text-purple-700'}`}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 capitalize">
                            {view === 'month' && `${monthNames[month]} ${year}`}
                            {view === 'day' && `${currentDate.getDate()} de ${monthNames[month]}`}
                            {view === 'week' && `Semana de ${monthNames[month]}`}
                        </h2>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">{view === 'month' ? 'Visualização Mensal' : view === 'week' ? 'Visualização Semanal' : 'Visualização Diária'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <button onClick={() => setView('month')} className={`p-2 rounded transition-all ${view === 'month' ? 'bg-gray-100 text-black font-bold shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="Mês"><LayoutGrid size={18} /></button>
                    <button onClick={() => setView('week')} className={`p-2 rounded transition-all ${view === 'week' ? 'bg-gray-100 text-black font-bold shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="Semana"><List size={18} className="rotate-90" /></button>
                    <button onClick={() => setView('day')} className={`p-2 rounded transition-all ${view === 'day' ? 'bg-gray-100 text-black font-bold shadow-sm' : 'text-gray-500 hover:text-gray-700'}`} title="Dia"><List size={18} /></button>
                </div>

                <div className="flex items-center gap-1 bg-white rounded-full border shadow-sm px-2 py-1">
                    <button onClick={() => navigate('prev')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={20} className="text-gray-600" /></button>
                    <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold text-blue-600 hover:text-blue-800 px-3 py-1 hover:bg-blue-50 rounded-full transition-colors">HOJE</button>
                    <button onClick={() => navigate('next')} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight size={20} className="text-gray-600" /></button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-hidden p-4">
                {view === 'month' && (
                    <>
                        <div className="grid grid-cols-7 mb-2">
                            {weekDays.map(day => (
                                <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase tracking-wide">{day}</div>
                            ))}
                        </div>
                        {renderMonth()}
                    </>
                )}
                {view === 'week' && renderWeek()}
                {view === 'day' && renderDay()}
            </div>
        </div>
    );
};
