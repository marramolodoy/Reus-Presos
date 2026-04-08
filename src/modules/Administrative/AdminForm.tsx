import React, { useState } from 'react';
import { Upload, X, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { AdministrativeDocument } from '../../types';
import { useUserRole } from '../../hooks/useUserRole';

interface AdminFormProps {
    onClose: () => void;
    onSuccess: () => void;
    session: any;
    initialData?: AdministrativeDocument;
}

export const AdminForm: React.FC<AdminFormProps> = ({ onClose, onSuccess, session, initialData }) => {
    const { teamOwnerId, unitId } = useUserRole(session);
    const [availableOptions, setAvailableOptions] = useState<{ next: string, gaps: string[] }>({ next: '...', gaps: [] });
    const [selectedNumberMode, setSelectedNumberMode] = useState<'next' | 'gap'>('next');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        number: initialData?.number || 'Carregando...',
        subject: initialData?.subject || '',
        date: initialData?.date || new Date().toISOString().split('T')[0],
        issuer: (initialData?.issuer || 'Secretaria') as 'Secretaria' | 'Gabinete',
        documentType: initialData?.documentType || 'Ofício',
    });
    const [file, setFile] = useState<File | null>(null);

    const fetchNextNumber = async (issuer: string, type: string) => {
        setLoading(true);
        try {
            // 1. Fetch TOTAL documents (including deleted) to find the True Max
            // This ensures "Sequential" respects history
            const { data: allDocs, error: allError } = await supabase
                .from('administrative_documents')
                .select('number, deleted_at')
                .eq('issuer', issuer)
                .eq('document_type', type);

            if (allError) throw allError;

            // 2. Calculate Sets
            const allNumbers = new Set(allDocs?.map(d => parseInt(d.number)).filter(n => !isNaN(n)));
            const activeNumbers = new Set(allDocs
                ?.filter(d => !d.deleted_at)
                .map(d => parseInt(d.number))
                .filter(n => !isNaN(n))
            );

            // 3. Find Max Values
            const maxTotal = allNumbers.size > 0 ? Math.max(...Array.from(allNumbers)) : 0;
            // const maxActive = activeNumbers.size > 0 ? Math.max(...Array.from(activeNumbers)) : 0;

            // 4. Find Gaps
            // A gap is any number from 1 to maxTotal that is NOT in activeNumbers
            const gaps: string[] = [];
            for (let i = 1; i <= maxTotal; i++) {
                if (!activeNumbers.has(i)) {
                    gaps.push(i.toString().padStart(2, '0'));
                }
            }

            // 5. Determine Next Sequential Number
            // This is strictly based on Max Total History
            const nextNum = (maxTotal + 1).toString().padStart(2, '0');

            setAvailableOptions({ next: nextNum, gaps });

            // 6. Set Initial Selection
            if (gaps.length > 0) {
                // Default to gap or next? User choice.
                // Let's default to GAP if available, as they probably want to fill it?
                // Or default to NEXT if they just want new stuff?
                // Let's default to GAP if selectedNumberMode is 'gap', else next.
                // But we need to initialize selectedNumberMode if it matches neither
                if (selectedNumberMode === 'gap') {
                    setFormData(prev => ({ ...prev, number: gaps[0] }));
                } else {
                    setFormData(prev => ({ ...prev, number: nextNum }));
                }
            } else {
                setFormData(prev => ({ ...prev, number: nextNum }));
            }

        } catch (err) {
            console.error('Error fetching next number:', err);
            setFormData(prev => ({ ...prev, number: '01' }));
        } finally {
            setLoading(false);
        }
    };

    // Effect to update number when mode changes or options change
    React.useEffect(() => {
        if (availableOptions.gaps.length > 0 && selectedNumberMode === 'gap') {
            setFormData(prev => ({ ...prev, number: availableOptions.gaps[0] }));
        } else {
            setFormData(prev => ({ ...prev, number: availableOptions.next }));
        }
    }, [selectedNumberMode, availableOptions]);

    // Fetch number logic handling both creation and editing
    React.useEffect(() => {
        if (!initialData) {
            // New document: always fetch next number
            fetchNextNumber(formData.issuer, formData.documentType);
        } else {
            // Editing existing document
            const hasChanged = formData.issuer !== initialData.issuer || formData.documentType !== initialData.documentType;

            if (hasChanged) {
                // If type/issuer changed, get next number for the NEW category
                fetchNextNumber(formData.issuer, formData.documentType);
            } else {
                // If mistakenly changed and reverted, restore original number
                setFormData(prev => ({ ...prev, number: initialData.number }));
            }
        }
    }, [formData.issuer, formData.documentType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let filePath = initialData?.filePath || null;

            if (file) {
                // Upload new file
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const { error: uploadError, data } = await supabase.storage
                    .from('documents')
                    .upload(`${session.user.id}/${fileName}`, file);

                if (uploadError) throw uploadError;

                // Delete old file if exists and we are replacing it
                if (initialData?.filePath) {
                    await supabase.storage.from('documents').remove([initialData.filePath]);
                }

                filePath = data.path;
            }

            if (initialData) {
                // Update existing
                const { error: dbError } = await supabase
                    .from('administrative_documents')
                    .update({
                        number: formData.number,
                        subject: formData.subject,
                        date: formData.date,
                        issuer: formData.issuer,
                        document_type: formData.documentType,
                        file_path: filePath
                    })
                    .eq('id', initialData.id);

                if (dbError) throw dbError;
            } else {
                // Insert new
                const { error: dbError } = await supabase
                    .from('administrative_documents')
                    .insert([{
                        number: formData.number,
                        subject: formData.subject,
                        date: formData.date,
                        issuer: formData.issuer,
                        document_type: formData.documentType,
                        file_path: filePath,
                        user_id: session.user.id,
                        unit_id: unitId
                    }]);

                if (dbError) throw dbError;
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            alert('Erro ao salvar documento: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFile = async () => {
        if (!initialData?.filePath) return;
        if (!confirm('Tem certeza que deseja apagar o arquivo anexo?')) return;

        setLoading(true);
        try {
            // Remove from Storage
            const { error: storageError } = await supabase.storage.from('documents').remove([initialData.filePath]);
            if (storageError) console.error('Error removing from storage:', storageError); // Soft error

            // Update DB record
            const { error: dbError } = await supabase
                .from('administrative_documents')
                .update({ file_path: null })
                .eq('id', initialData.id);

            if (dbError) throw dbError;

            // Update Local State
            setFile(null);
            // We can't easily update initialData inside the parent without refetching, 
            // but we can trigger success to refresh list.
            // For this modal state, we'll just hide the file UI.
            initialData.filePath = undefined; // Hacky local update for UI reflection or force close

            onSuccess(); // Refresh parent list
            alert('Arquivo removido com sucesso!');
        } catch (error: any) {
            alert('Erro ao remover arquivo: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-gray-50 border-b p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800">{initialData ? 'Editar Documento' : 'Novo Documento'}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>

                            {/* Gaps Selection UI */}
                            {!initialData && availableOptions.gaps.length > 0 && (
                                <div className="mb-2 flex gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedNumberMode('gap')}
                                        className={`px-2 py-1 rounded border ${selectedNumberMode === 'gap' ? 'bg-orange-100 border-orange-300 text-orange-800 font-bold' : 'bg-gray-50 text-gray-600'}`}
                                    >
                                        Usar Vago #{availableOptions.gaps[0]}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedNumberMode('next')}
                                        className={`px-2 py-1 rounded border ${selectedNumberMode === 'next' ? 'bg-blue-100 border-blue-300 text-blue-800 font-bold' : 'bg-gray-50 text-gray-600'}`}
                                    >
                                        Sequencial #{availableOptions.next}
                                    </button>
                                </div>
                            )}

                            <input
                                type="text"
                                required
                                readOnly
                                className={`w-full p-2 border rounded focus:outline-none cursor-not-allowed ${selectedNumberMode === 'gap' ? 'bg-orange-50 text-orange-800 font-bold border-orange-200' : 'bg-gray-100 text-gray-600'}`}
                                value={formData.number}
                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none bg-white"
                                value={formData.documentType}
                                onChange={e => setFormData({ ...formData, documentType: e.target.value })}
                            >
                                <option value="Ofício">Ofício</option>
                                <option value="Portaria">Portaria</option>
                                <option value="Ato Administrativo">Ato Administrativo</option>
                                <option value="Memorando">Memorando</option>
                                <option value="Outros">Outros</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                            <input
                                type="date"
                                required
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assunto</label>
                        <input
                            type="text"
                            required
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none"
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                        <select
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-justice-200 outline-none bg-white"
                            value={formData.issuer}
                            onChange={e => setFormData({ ...formData, issuer: e.target.value as any })}
                        >
                            <option value="Secretaria">Secretaria</option>
                            <option value="Gabinete">Gabinete</option>
                        </select>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                        <input
                            type="file"
                            accept="application/pdf"
                            id="file-upload"
                            className="hidden"
                            onChange={e => setFile(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                            <Upload className="text-gray-400" size={32} />
                            <span className="text-sm text-gray-600 font-medium">
                                {file ? file.name : (initialData?.filePath ? 'Substituir PDF atual' : 'Clique para selecionar o PDF')}
                            </span>
                            <span className="text-xs text-gray-400">PDF até 10MB {initialData?.filePath && '(Atual mantido se não selecionar novo)'}</span>
                        </label>

                        {initialData?.filePath && !file && (
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); handleRemoveFile(); }}
                                className="mt-2 text-xs text-red-600 hover:text-red-800 flex items-center justify-center gap-1 w-full p-2 hover:bg-red-50 rounded transition-colors"
                            >
                                <Trash2 size={12} /> Remover Arquivo Atual
                            </button>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-justice-600 text-white px-4 py-2 rounded-lg hover:bg-justice-700 flex items-center gap-2 text-sm shadow-sm disabled:opacity-50"
                        >
                            <Save size={16} />
                            {loading ? 'Salvando...' : 'Salvar Documento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
