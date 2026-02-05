import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SeizedAsset } from '../../types';
import { useUserRole } from '../../hooks/useUserRole';
import { Plus, Search, Archive, Edit, Trash2, MapPin, User, Download, ArchiveRestore, Clock, CheckCircle } from 'lucide-react';
import { SeizedAssetsForm } from './SeizedAssetsForm';
import { SeizedAssetsTrashModal } from './SeizedAssetsTrashModal';
import { SeizedAssetsExportModal } from './SeizedAssetsExportModal';

export const SeizedAssetsDashboard: React.FC<{ session: any }> = ({ session }) => {
    const [assets, setAssets] = useState<SeizedAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<SeizedAsset | undefined>(undefined);
    const { teamOwnerId } = useUserRole(session);

    // New States
    const [showConcluded, setShowConcluded] = useState(false);
    const [sortBy, setSortBy] = useState('created_desc');
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);

    const fetchAssets = async () => {
        if (!session) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('seized_assets')
            .select('*')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching assets:', error);
        } else {
            setAssets((data || []).map((d: any) => ({
                id: d.id,
                processNumber: d.process_number,
                partyName: d.party_name,
                possibleOwner: d.possible_owner,
                description: d.description,
                location: d.location,
                destinationStatus: d.destination_status,
                isConcluded: d.is_concluded,
                concludedAt: d.concluded_at,
                seizureDate: d.seizure_date,
                hasCourtCase: d.has_court_case,
                user_id: d.user_id
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAssets();
    }, [session, teamOwnerId]);

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja mover este item para a lixeira?')) return;

        const { error } = await supabase
            .from('seized_assets')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            alert('Erro ao excluir: ' + error.message);
        } else {
            fetchAssets();
        }
    };

    const handleToggleConclusion = async (asset: SeizedAsset) => {
        const newStatus = !asset.isConcluded;
        const { error } = await supabase
            .from('seized_assets')
            .update({
                is_concluded: newStatus,
                concluded_at: newStatus ? new Date().toISOString() : null
            })
            .eq('id', asset.id);

        if (error) alert('Erro ao atualizar status: ' + error.message);
        else fetchAssets();
    };

    const filteredAssets = assets
        .filter(a => {
            const matchesSearch =
                a.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.processNumber && a.processNumber.includes(searchTerm)) ||
                (a.possibleOwner && a.possibleOwner.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = showConcluded ? a.isConcluded : !a.isConcluded;

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'created_desc': return 0; // Already sorted by fetch (approx, ignoring ID based sort here) - actually we should rely on array index or explicit date if available. JS sorts in place.
                case 'party_asc': return a.partyName.localeCompare(b.partyName);
                case 'location_asc': return a.location.localeCompare(b.location);
                default: return 0;
            }
        });

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-2 h-8 bg-orange-600 rounded-full block"></span>
                        Bens Apreendidos
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Controle de objetos, armas e valores apreendidos.</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setIsExportOpen(true)}
                        className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <Download size={20} />
                    </button>
                    <button
                        onClick={() => setIsTrashOpen(true)}
                        className="bg-white text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <ArchiveRestore size={20} />
                    </button>
                    <button
                        onClick={() => { setEditingAsset(undefined); setIsFormOpen(true); }}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2 shadow-sm font-medium transition-colors"
                    >
                        <Plus size={20} /> Novo Bem
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 mb-6 sticky top-20 z-10">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setShowConcluded(false)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!showConcluded ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Pendentes
                    </button>
                    <button
                        onClick={() => setShowConcluded(true)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${showConcluded ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Concluídos
                    </button>
                </div>

                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-100 outline-none text-gray-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-orange-200 outline-none shadow-sm cursor-pointer"
                >
                    <option value="created_desc">Mais Recentes</option>
                    <option value="party_asc">Nome da Parte (A-Z)</option>
                    <option value="location_asc">Localização</option>
                </select>
            </div>

            {/* Content */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                    <div className="col-span-full text-center py-12 text-gray-500">Carregando...</div>
                ) : filteredAssets.length === 0 ? (
                    <div className="col-span-full p-12 bg-white rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                        Nenhum bem apreendido encontrado com os filtros atuais.
                    </div>
                ) : (
                    filteredAssets.map(asset => (
                        <div key={asset.id} className={`bg-white p-5 rounded-xl shadow-sm border transition-all group relative ${asset.isConcluded ? 'border-gray-200 opacity-75' : 'border-gray-100 hover:shadow-md'}`}>
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/80 p-1 rounded backdrop-blur-sm">
                                <button
                                    onClick={() => handleToggleConclusion(asset)}
                                    className={`p-1.5 rounded ${asset.isConcluded ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100 hover:text-green-600'}`}
                                    title={asset.isConcluded ? "Reabrir" : "Concluir"}
                                >
                                    <CheckCircle size={16} />
                                </button>
                                <button onClick={() => { setEditingAsset(asset); setIsFormOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                                    <Edit size={16} />
                                </button>
                                <button onClick={() => handleDelete(asset.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-start gap-3 mb-3">
                                <div className={`p-2 rounded-lg ${asset.isConcluded ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-600'}`}>
                                    <Archive size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 line-clamp-1" title={asset.partyName}>{asset.partyName}</h3>
                                    {asset.possibleOwner && (
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <User size={12} /> Prop.: {asset.possibleOwner}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600 mb-3">
                                <p className="bg-gray-50 p-2 rounded text-xs line-clamp-3 min-h-[3rem] italic">
                                    "{asset.description}"
                                </p>

                                <div className="flex justify-between items-center text-xs">
                                    <span className="flex items-center gap-1 text-gray-500" title="Localização">
                                        <MapPin size={14} /> {asset.location}
                                    </span>
                                    <div className="flex gap-2">
                                        {asset.seizureDate && (
                                            <span className="flex items-center gap-1 text-gray-500" title="Data da Apreensão">
                                                <Clock size={12} /> {new Date(asset.seizureDate).toLocaleDateString()}
                                            </span>
                                        )}
                                        {asset.hasCourtCase && asset.processNumber ? (
                                            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-700">
                                                {asset.processNumber}
                                            </span>
                                        ) : (
                                            !asset.hasCourtCase && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[10px] font-medium border border-orange-100">
                                                Depol
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t flex justify-between items-center">
                                <span className={`text-xs px-2 py-1 rounded-full font-bold ${asset.destinationStatus === 'Aguardando' ? 'bg-yellow-100 text-yellow-700' :
                                    asset.destinationStatus === 'Encaminhado' ? 'bg-blue-100 text-blue-700' :
                                        asset.destinationStatus === 'Devolvido' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {asset.destinationStatus}
                                </span>
                                {asset.isConcluded && (
                                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                        <CheckCircle size={10} /> Concluído
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isFormOpen && (
                <SeizedAssetsForm
                    session={session}
                    initialData={editingAsset}
                    onClose={() => setIsFormOpen(false)}
                    onSuccess={fetchAssets}
                />
            )}

            <SeizedAssetsTrashModal
                isOpen={isTrashOpen}
                onClose={() => setIsTrashOpen(false)}
                session={session}
                onRestore={fetchAssets}
            />

            <SeizedAssetsExportModal
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                assets={assets}
            />
        </div>
    );
};
