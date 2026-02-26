import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { Plus, X, Trash2, Save, Download, Palette, FileDown, Pin, Edit, ArchiveRestore } from 'lucide-react';
import { NotesTrashModal } from './NotesTrashModal';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';

interface Note {
    id: string;
    title: string;
    content: string;
    color: string;
    position_x: number;
    position_y: number;
    created_at: string;
    author?: string;
    is_pinned?: boolean;
    deleted_at?: string | null;
    assigned_to?: string | null;
}

interface TeamMember {
    user_id: string;
    email: string;
    role: string;
}

interface NotesBoardProps {
    session: any;
}

const COLORS = [
    'bg-yellow-100 border-yellow-200',
    'bg-blue-200 border-blue-300', // Darker blue
    'bg-green-200 border-green-300', // Darker green
    'bg-red-200 border-red-300', // Darker red
    'bg-purple-200 border-purple-300', // Darker purple
    'bg-orange-200 border-orange-300',
    'bg-pink-200 border-pink-300',
    'bg-cyan-200 border-cyan-300',
    'bg-stone-300 border-stone-400', // Darker gray
    'bg-teal-200 border-teal-300',
    'bg-indigo-300 border-indigo-400',
    'bg-lime-200 border-lime-300',
    'bg-fuchsia-200 border-fuchsia-300',
    'bg-rose-200 border-rose-300',
] as const;

// Helper to check if color is a Tailwind class
const isTailwindClass = (color: string) => color.startsWith('bg-');

const COLOR_MAP: Record<string, [number, number, number]> = {
    'bg-yellow-100': [254, 249, 195],
    'bg-blue-200': [191, 219, 254],
    'bg-green-200': [187, 247, 208],
    'bg-red-200': [254, 202, 202],
    'bg-purple-200': [233, 213, 255],
    'bg-orange-200': [254, 215, 170],
    'bg-pink-200': [251, 207, 232],
    'bg-cyan-200': [165, 243, 252],
    'bg-stone-300': [214, 211, 209],
    'bg-teal-200': [153, 246, 228],
    'bg-indigo-300': [165, 180, 252],
    'bg-lime-200': [217, 249, 157],
    'bg-fuchsia-200': [245, 208, 254],
    'bg-rose-200': [254, 205, 211],
};

const getRGB = (colorStr: string): [number, number, number] => {
    if (isTailwindClass(colorStr)) {
        const bgClass = colorStr.split(' ')[0];
        return COLOR_MAP[bgClass] || [255, 255, 255];
    }

    // Handle Hex or RGB string
    // Simple hex parser
    if (colorStr.startsWith('#')) {
        const hex = colorStr.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return [r, g, b];
    }

    // Simple RGB parser
    if (colorStr.startsWith('rgb')) {
        const parts = colorStr.match(/\d+/g);
        if (parts && parts.length >= 3) {
            return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
        }
    }

    return [255, 255, 255];
};

export const NotesBoard: React.FC<NotesBoardProps> = ({ session }) => {
    const { teamOwnerId, unitId } = useUserRole(session);
    const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [boardTitle, setBoardTitle] = useState(() => localStorage.getItem('notes_board_title') || 'Mural de Avisos');
    const [boardSubtitle, setBoardSubtitle] = useState(() => localStorage.getItem('notes_board_subtitle') || 'Fixe lembretes importantes');

    // Modal States
    const [editingNote, setEditingNote] = useState<Partial<Note> | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [exportOptions, setExportOptions] = useState({ pinned: true, others: true });

    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    const fetchTeamMembers = async () => {
        const { data, error } = await supabase.rpc('get_my_team');
        if (!error && data) {
            setTeamMembers(data);
        }
    };

    const handleEditTitle = () => {
        const newTitle = prompt("Novo Título:", boardTitle);
        if (newTitle) {
            setBoardTitle(newTitle);
            localStorage.setItem('notes_board_title', newTitle);
        }
    };

    const handleEditSubtitle = () => {
        const newSubtitle = prompt("Novo Subtítulo:", boardSubtitle);
        if (newSubtitle) {
            setBoardSubtitle(newSubtitle);
            localStorage.setItem('notes_board_subtitle', newSubtitle);
        }
    };

    useEffect(() => {
        fetchNotes();
        fetchTeamMembers();
        const handleClickOutside = () => setActiveColorPicker(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [session]);

    const fetchNotes = async () => {
        if (!session) return;
        const { data, error } = await supabase
            .from('sticky_notes')
            .select('*')

            .is('deleted_at', null)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });

        if (!error && data) setNotes(data);
        setLoading(false);
    };

    const handleNewNote = () => {
        setEditingNote({
            title: '',
            content: '',
            color: COLORS[0],
            author: '',
            is_pinned: false,
            assigned_to: null
        });
    };

    const deleteNote = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Mover para lixeira?')) {
            await supabase.from('sticky_notes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
            setNotes(notes.filter(n => n.id !== id));
        }
    };



    const updateNote = async (id: string, updates: Partial<Note>) => {
        setNotes(notes.map(n => n.id === id ? { ...n, ...updates } : n).sort((a, b) => {
            if (a.is_pinned === b.is_pinned) {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
        }));
        await supabase.from('sticky_notes').update(updates).eq('id', id);
    };

    const handleSaveEdit = async () => {
        if (!editingNote || !session) return;

        if (editingNote.id) {
            // Check if assigned_to changed to a new user
            const originalNote = notes.find(n => n.id === editingNote.id);
            if (editingNote.assigned_to && originalNote?.assigned_to !== editingNote.assigned_to) {
                // Create Notification
                await supabase.from('notifications').insert({
                    user_id: editingNote.assigned_to,
                    title: 'Nova Nota Atribuída',
                    message: `Você foi marcado na nota "${editingNote.title}" no Mural de Avisos.`,
                    link: '/avisos',
                    read: false
                });
            }

            // Update existing
            await updateNote(editingNote.id, {
                title: editingNote.title,
                content: editingNote.content,
                author: editingNote.author,
                color: editingNote.color,
                is_pinned: editingNote.is_pinned,
                assigned_to: editingNote.assigned_to || null
            });
        } else {
            // Create new
            const newNote = {
                title: editingNote.title || 'Sem título',
                content: editingNote.content || '',
                color: editingNote.color || COLORS[0],
                user_id: teamOwnerId || session.user.id,
                author: editingNote.author,
                is_pinned: editingNote.is_pinned || false,
                assigned_to: editingNote.assigned_to || null,
                unit_id: unitId
            };

            const { data, error } = await supabase.from('sticky_notes').insert([newNote]).select();
            if (data) {
                // Create Notification if assigned
                if (newNote.assigned_to) {
                    await supabase.from('notifications').insert({
                        user_id: newNote.assigned_to,
                        title: 'Nova Nota Atribuída',
                        message: `Você foi marcado na nota "${newNote.title}" no Mural de Avisos.`,
                        link: '/avisos',
                        read: false
                    });
                }

                setNotes(prev => {
                    const newList = [data[0], ...prev];
                    return newList.sort((a, b) => {
                        if (a.is_pinned === b.is_pinned) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
                    });
                });
            }
        }
        setEditingNote(null);
    };

    const sortNotesStart = (list: Note[]) => {
        return [...list].sort((a, b) => {
            if (a.is_pinned === b.is_pinned) {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
        });
    };

    const togglePin = async (note: Note, e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = !note.is_pinned;
        updateNote(note.id, { is_pinned: newStatus });
    };

    const downloadNotePDF = (note: Note) => {
        const doc = new jsPDF();

        // Background
        const rgb = getRGB(note.color);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.rect(0, 0, 210, 297, 'F');

        doc.setFontSize(16);
        doc.text(note.title, 10, 15);
        doc.setFontSize(12);

        const splitText = doc.splitTextToSize(note.content, 180);
        doc.text(splitText, 10, 25);

        doc.save(`nota_${note.title.replace(/\s+/g, '_')}.pdf`);
    };

    const downloadBoardPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text(boardTitle, 10, 15);
        doc.setFontSize(10);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 10, 22);

        let y = 35;

        const notesToExport = notes.filter(n => {
            if (n.is_pinned && exportOptions.pinned) return true;
            if (!n.is_pinned && exportOptions.others) return true;
            return false;
        });

        notesToExport.forEach((note, index) => {
            const rgb = getRGB(note.color);
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);

            // Calculate height needed
            doc.setFontSize(14);
            const titleHeight = 7;
            doc.setFontSize(11);
            const splitText = doc.splitTextToSize(note.content, 170);
            const contentHeight = (splitText.length * 5) + 5;
            const totalHeight = titleHeight + contentHeight + 10;

            if (y + totalHeight > 280) {
                doc.addPage();
                y = 20;
            }

            // Draw Box
            doc.rect(5, y - 5, 200, totalHeight, 'F');

            // Draw Text
            doc.setFontSize(14);
            doc.text(`${index + 1}. ${note.title} ${note.is_pinned ? '(Fixada)' : ''}`, 10, y + 2);

            doc.setFontSize(11);
            doc.text(splitText, 15, y + 10);

            // Draw Author if exists
            if (note.author) {
                const authorText = `Criado por: ${note.author}`;
                doc.setFontSize(8);
                const textWidth = doc.getTextWidth(authorText);

                // Background Pill
                doc.setFillColor(255, 255, 255);
                doc.setGState(new (doc as any).GState({ opacity: 0.6 })); // Slightly more opaque
                doc.roundedRect(13, y + totalHeight - 9, textWidth + 4, 6, 1, 1, 'F'); // Dynamic width + padding, rounded
                doc.setGState(new (doc as any).GState({ opacity: 1 }));

                // Text
                doc.setTextColor(0);
                doc.text(authorText, 15, y + totalHeight - 5);
            }

            y += totalHeight + 5; // spacing between notes
        });

        doc.save('mural_de_avisos.pdf');
        setIsExportModalOpen(false);
    };

    return (
        <div className="p-6 h-full bg-stone-100 min-h-screen relative overflow-hidden bg-dot-pattern">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1
                        className="text-3xl font-bold text-stone-800 tracking-tight font-serif cursor-pointer hover:underline decoration-stone-400 decoration-2 underline-offset-4"
                        onClick={handleEditTitle}
                        title="Clique para editar o título"
                    >
                        {boardTitle}
                    </h1>
                    <p
                        className="text-stone-500 cursor-pointer hover:text-stone-700 transition-colors"
                        onClick={handleEditSubtitle}
                        title="Clique para editar o subtítulo"
                    >
                        {boardSubtitle}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsExportModalOpen(true)} className="bg-white text-stone-700 px-4 py-2 rounded-lg shadow border border-stone-200 hover:bg-stone-50 transition-all flex items-center gap-2">
                        <FileDown size={18} /> <span className="hidden md:inline">Baixar Mural</span>
                    </button>
                    <button onClick={() => setIsTrashOpen(true)} className="bg-white text-stone-700 px-4 py-2 rounded-lg shadow border border-stone-200 hover:bg-stone-50 transition-all flex items-center gap-2" title="Lixeira">
                        <ArchiveRestore size={18} /> <span className="hidden md:inline">Lixeira</span>
                    </button>
                    <button onClick={handleNewNote} className="bg-stone-800 text-white px-4 py-2 rounded-lg shadow hover:bg-black transition-all flex items-center gap-2">
                        <Plus size={18} /> Nova Nota
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-20 overflow-y-auto max-h-[calc(100vh-150px)]">
                {notes.map(note => (
                    <div
                        key={note.id}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-4 rounded-lg shadow-md border-t-8 transform transition-transform hover:-translate-y-1 hover:shadow-lg relative group min-h-[16rem] flex flex-col ${isTailwindClass(note.color) ? note.color : 'border-t-gray-400'}`}
                        style={!isTailwindClass(note.color) ? { backgroundColor: note.color, borderColor: note.color } : undefined}
                    >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/50 rounded-lg p-1 backdrop-blur-sm z-50">
                            <div className="relative">


                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNote(note);
                                }}
                                className="p-1 text-stone-600 hover:text-stone-900 rounded hover:bg-stone-200/50"
                                title="Editar"
                            >
                                <Edit size={16} />
                            </button>
                            <button
                                onClick={(e) => togglePin(note, e)}
                                className={`p-1 rounded transition-colors ${note.is_pinned ? 'text-stone-800 bg-stone-200' : 'text-gray-400 hover:text-stone-600'}`}
                                title={note.is_pinned ? "Desafixar" : "Fixar"}
                            >
                                <Pin size={16} fill={note.is_pinned ? "currentColor" : "none"} />
                            </button>
                            <button onClick={() => downloadNotePDF(note)} className="p-1 text-blue-600 hover:text-blue-800 rounded" title="Baixar PDF"><Download size={16} /></button>
                            <button onClick={(e) => deleteNote(note.id, e)} className="p-1 text-red-500 hover:text-red-700 rounded" title="Excluir"><Trash2 size={16} /></button>
                        </div>

                        <h3 className="font-bold text-lg mb-2 text-gray-800 break-words">{note.title}</h3>
                        <div className="flex-1 text-sm text-gray-700 leading-relaxed custom-scrollbar overflow-y-auto whitespace-pre-wrap min-h-[100px] break-words">
                            {note.content}
                        </div>

                        <div className="mt-2 text-right opacity-50 flex justify-between items-end">
                            <div className="flex flex-col items-start gap-1">
                                {note.is_pinned && <Pin size={12} className="text-stone-500 inline mr-1" fill="currentColor" />}
                                {note.assigned_to && (
                                    <div className="bg-black/10 px-2 py-0.5 rounded text-[10px] font-bold text-stone-800">
                                        Para: {teamMembers.find(m => m.user_id === note.assigned_to)?.email.split('@')[0] || 'Unknown'}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="bg-white/40 px-2 py-1 rounded-md backdrop-blur-sm">
                                    <div className="text-[10px] text-black font-bold font-mono">
                                        {note.author && `Criado por: ${note.author}`}
                                    </div>
                                    <div className="text-[10px] text-black font-bold font-mono text-right">
                                        {new Date(note.created_at).toLocaleDateString('pt-BR')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))
                }
            </div >

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-96 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-lg">Baixar Mural em PDF</h3>
                            <button onClick={() => setIsExportModalOpen(false)}><X size={20} /></button>
                        </div>
                        <div className="flex flex-col gap-3 mb-6">
                            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded border">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.pinned}
                                    onChange={e => setExportOptions(prev => ({ ...prev, pinned: e.target.checked }))}
                                    className="w-5 h-5 text-stone-800 rounded focus:ring-stone-500"
                                />
                                <span>Notas Fixadas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded border">
                                <input
                                    type="checkbox"
                                    checked={exportOptions.others}
                                    onChange={e => setExportOptions(prev => ({ ...prev, others: e.target.checked }))}
                                    className="w-5 h-5 text-stone-800 rounded focus:ring-stone-500"
                                />
                                <span>Demais Notas</span>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                            <button onClick={downloadBoardPDF} className="px-4 py-2 bg-stone-800 text-white rounded hover:bg-stone-900 flex items-center gap-2">
                                <Download size={16} /> Baixar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingNote && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                    <div className={`bg-white p-6 rounded-lg shadow-xl w-full max-w-lg animate-in zoom-in-95 duration-200 border-t-8 ${editingNote.color && isTailwindClass(editingNote.color) ? editingNote.color : ''} border-t-stone-800`}
                        style={editingNote.color && !isTailwindClass(editingNote.color) ? { borderColor: editingNote.color } : undefined}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-xl">{editingNote.id ? 'Editar Nota' : 'Nova Nota'}</h3>
                            <button onClick={() => setEditingNote(null)}><X size={20} /></button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                                <input
                                    className="w-full border rounded-lg p-2 text-lg font-bold outline-none ring-offset-2 focus:ring-2 ring-stone-400"
                                    value={editingNote.title || ''}
                                    onChange={e => setEditingNote({ ...editingNote, title: e.target.value })}
                                    placeholder="Digite o título..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                                <textarea
                                    className="w-full border rounded-lg p-2 min-h-[150px] outline-none ring-offset-2 focus:ring-2 ring-stone-400"
                                    value={editingNote.content || ''}
                                    onChange={e => setEditingNote({ ...editingNote, content: e.target.value })}
                                    placeholder="Digite o conteúdo da nota..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Criado por</label>
                                    <input
                                        className="w-full border rounded-lg p-2 outline-none focus:ring-2 ring-stone-400"
                                        value={editingNote.author || ''}
                                        onChange={e => setEditingNote({ ...editingNote, author: e.target.value })}
                                        placeholder="Nome do autor"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Atribuir a</label>
                                    <select
                                        className="w-full border rounded-lg p-2 outline-none focus:ring-2 ring-stone-400 bg-white"
                                        value={editingNote.assigned_to || ''}
                                        onChange={e => setEditingNote({ ...editingNote, assigned_to: e.target.value || null })}
                                    >
                                        <option value="">Ninguém</option>
                                        {teamMembers.map(member => (
                                            <option key={member.user_id} value={member.user_id}>
                                                {member.email.split('@')[0]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer p-2 border rounded hover:bg-gray-50 flex-1">
                                    <input
                                        type="checkbox"
                                        checked={editingNote.is_pinned || false}
                                        onChange={e => setEditingNote({ ...editingNote, is_pinned: e.target.checked })}
                                        className="w-4 h-4 text-stone-800 rounded focus:ring-stone-500"
                                    />
                                    <span className="flex items-center gap-1 text-sm"><Pin size={14} /> Fixar Nota</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                                <div className="flex gap-2 items-center h-[42px]">
                                    {COLORS.slice(0, 5).map(c => (
                                        <button
                                            key={c}
                                            className={`w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform ${isTailwindClass(c) ? c : ''} ${editingNote.color === c ? 'ring-2 ring-offset-2 ring-black' : ''}`}
                                            style={!isTailwindClass(c) ? { backgroundColor: c } : undefined}
                                            onClick={() => setEditingNote({ ...editingNote, color: c })}
                                        />
                                    ))}
                                    <div className="relative ml-2">
                                        <button
                                            className="text-xs underline text-gray-500"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveColorPicker('modal');
                                            }}
                                        >
                                            Mais cores
                                        </button>
                                        {activeColorPicker === 'modal' && (
                                            <div
                                                className="absolute left-0 bottom-full mb-2 bg-white shadow-xl border rounded-lg p-3 z-50 w-64 flex flex-col gap-2"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="grid grid-cols-7 gap-1">
                                                    {COLORS.map(c => (
                                                        <button
                                                            key={c}
                                                            className={`w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform ${isTailwindClass(c) ? c : ''}`}
                                                            style={!isTailwindClass(c) ? { backgroundColor: c } : undefined}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingNote({ ...editingNote, color: c });
                                                                setActiveColorPicker(null);
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="border-t pt-2">
                                                    <label className="text-xs text-gray-500 block mb-1">Cor Personalizada (Hex/RGB):</label>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex gap-2 items-center">
                                                            <input
                                                                type="color"
                                                                className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                                                                onChange={(e) => setEditingNote({ ...editingNote, color: e.target.value })}
                                                                value={editingNote.color && !isTailwindClass(editingNote.color) && editingNote.color.startsWith('#') ? editingNote.color : '#ffffff'}
                                                            />
                                                            <input
                                                                type="text"
                                                                placeholder="#RRGGBB"
                                                                className="flex-1 text-xs border rounded px-2 py-1"
                                                                value={editingNote.color && !isTailwindClass(editingNote.color) && editingNote.color.startsWith('#') ? editingNote.color : ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setEditingNote({ ...editingNote, color: val });
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-[10px] text-gray-400 w-8">RGB:</label>
                                                            <input
                                                                type="text"
                                                                placeholder="255, 255, 255"
                                                                className="flex-1 text-xs border rounded px-2 py-1"
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    // Simple validation or just formatting
                                                                    setEditingNote({ ...editingNote, color: `rgb(${val})` });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6 border-t pt-4">
                            <button onClick={() => setEditingNote(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                            <button onClick={handleSaveEdit} className="px-4 py-2 bg-stone-800 text-white rounded hover:bg-stone-900 flex items-center gap-2">
                                <Save size={18} /> {editingNote.id ? 'Salvar Alterações' : 'Criar Nota'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {
                notes.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-stone-400 border-2 border-dashed border-stone-300 rounded-xl m-10">
                        <Plus size={48} className="mb-4 text-stone-300" />
                        <p className="font-medium">O mural está vazio</p>
                        <p className="text-sm">Adicione uma nota para começar</p>
                    </div>
                )
            }
            {/* Trash Modal */}
            <NotesTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                session={session}
                onRestore={fetchNotes}
            />
        </div >
    );
};
