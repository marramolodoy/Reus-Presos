import React, { useState, useMemo } from 'react';
import { Scale, Info, Plus, FileText, Minus, AlertTriangle, Calculator, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

// Utility for formatting time
const daysToTime = (totalDays: number) => {
    const years = Math.floor(totalDays / 360);
    const rem1 = totalDays % 360;
    const months = Math.floor(rem1 / 30);
    const days = Math.round(rem1 % 30);
    return { years, months, days };
};

const timeToDays = (years: number, months: number, days: number) => {
    return (years * 360) + (months * 30) + days;
};

const formatTime = (years: number, months: number, days: number) => {
    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
    if (parts.length === 0) return '0 dias';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
    return `${parts[0]}, ${parts[1]} e ${parts[2]}`;
};

interface Fração {
    id: string;
    num: number;
    den: number;
}

export const DosimetryCalculator: React.FC = () => {
    // 1. Pena em Abstrato
    const [minPena, setMinPena] = useState({ years: 0, months: 0, days: 0 });
    const [maxPena, setMaxPena] = useState({ years: 0, months: 0, days: 0 });
    const [minMulta, setMinMulta] = useState(10);
    const [maxMulta, setMaxMulta] = useState(360);

    // 2. Fase 1 - Circunstâncias Judiciais
    const judiciaisList = [
        'Culpabilidade', 'Antecedentes', 'Conduta social', 'Personalidade',
        'Motivos', 'Circunstâncias', 'Consequências', 'Comportamento da vítima'
    ];
    const [circunstancias, setCircunstancias] = useState<Record<string, boolean>>(
        judiciaisList.reduce((acc, curr) => ({ ...acc, [curr]: false }), {})
    );

    // 3. Fase 2 - Agravantes e Atenuantes
    const [agravantes, setAgravantes] = useState(0);
    const [atenuantes, setAtenuantes] = useState(0);

    // 4. Fase 3 - Causas de Aumento e Diminuição
    const [aumentos, setAumentos] = useState<Fração[]>([]);
    const [diminuicoes, setDiminuicoes] = useState<Fração[]>([]);

    // 5. Detração
    const [temDetracao, setTemDetracao] = useState(false);
    const [detracaoModo, setDetracaoModo] = useState<'manual' | 'datas'>('datas');
    const [detracaoTempo, setDetracaoTempo] = useState({ years: 0, months: 0, days: 0 });
    const [dataPrisao, setDataPrisao] = useState('');
    const [dataSoltura, setDataSoltura] = useState('');

    // 6. Benefícios Legais (Perfil do Crime)
    const [isCulposo, setIsCulposo] = useState(false);
    const [hasViolencia, setHasViolencia] = useState(false);
    const [isReincidente, setIsReincidente] = useState(false);
    const [isViolenciaDomestica, setIsViolenciaDomestica] = useState(false);

    const minDias = useMemo(() => timeToDays(minPena.years, minPena.months, minPena.days), [minPena]);
    const maxDias = useMemo(() => timeToDays(maxPena.years, maxPena.months, maxPena.days), [maxPena]);

    // --------- CÁLCULOS FASE 1 ---------
    const numeroNegativas = Object.values(circunstancias).filter(Boolean).length;
    
    // (Pena Máxima - Pena Mínima)/8
    const pesoPPLCircunstancia = maxDias > minDias ? (maxDias - minDias) / 8 : 0;
    const pesoMultaCircunstancia = maxMulta > minMulta ? (maxMulta - minMulta) / 8 : 0;

    let penaBaseDias = minDias + (numeroNegativas * pesoPPLCircunstancia);
    if (penaBaseDias > maxDias) penaBaseDias = maxDias;
    
    let multaBase = minMulta + (numeroNegativas * pesoMultaCircunstancia);
    if (multaBase > maxMulta) multaBase = maxMulta;

    // --------- CÁLCULOS FASE 2 ---------
    // Jurisprudência (STJ): 1/6 da pena-base para cada agravante ou atenuante
    const fracaoSextoPPL = penaBaseDias / 6;
    const fracaoSextoMulta = multaBase / 6;

    let penaIntDias = penaBaseDias + (agravantes * fracaoSextoPPL) - (atenuantes * fracaoSextoPPL);
    let multaInt = multaBase + (agravantes * fracaoSextoMulta) - (atenuantes * fracaoSextoMulta);

    // Súmula 231 do STJ
    let hasSumula231PPL = false;
    if (penaIntDias < minDias) { penaIntDias = minDias; hasSumula231PPL = true; }
    if (penaIntDias > maxDias) { penaIntDias = maxDias; hasSumula231PPL = true; }
    
    if (multaInt < minMulta) multaInt = minMulta;
    if (multaInt > maxMulta) multaInt = maxMulta;

    // --------- CÁLCULOS FASE 3 ---------
    let penaDefDias = penaIntDias;
    let multaDef = multaInt;

    // Aumentos
    aumentos.forEach(f => {
        penaDefDias += penaDefDias * (f.num / f.den);
        multaDef += multaDef * (f.num / f.den);
    });

    // Diminuições
    diminuicoes.forEach(f => {
        penaDefDias -= penaDefDias * (f.num / f.den);
        multaDef -= multaDef * (f.num / f.den);
    });

    penaDefDias = Math.floor(penaDefDias);
    multaDef = Math.floor(multaDef);

    // --------- CÁLCULOS DETRAÇÃO ---------
    let detracaoDias = 0;
    if (temDetracao) {
        if (detracaoModo === 'manual') {
            detracaoDias = timeToDays(detracaoTempo.years, detracaoTempo.months, detracaoTempo.days);
        } else if (detracaoModo === 'datas' && dataPrisao) {
            const d1 = new Date(dataPrisao);
            const d2 = dataSoltura ? new Date(dataSoltura) : new Date();
            const diffTime = Math.abs(d2.getTime() - d1.getTime());
            detracaoDias = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
    }
    
    let penaRestanteDias = Math.max(0, penaDefDias - detracaoDias);

    const baseResult = daysToTime(penaBaseDias);
    const intResult = daysToTime(penaIntDias);
    const defResult = daysToTime(penaDefDias);
    const detracaoResult = daysToTime(detracaoDias);
    const restanteResult = daysToTime(penaRestanteDias);

    // Sugestão de Regime Inicial
    const finalYearsFloat = penaRestanteDias / 360;
    let suggRegime = '';
    if (finalYearsFloat > 8) suggRegime = 'Fechado';
    else if (finalYearsFloat > 4 && finalYearsFloat <= 8) suggRegime = 'Semiaberto (Aberto possível dependendo do art. 33, §2º "b")';
    else if (finalYearsFloat > 0) suggRegime = 'Aberto (Avaliar substituição art. 44 CP)';
    else suggRegime = 'Isento/Cumprida';

    // --------- ANÁLISE BENEFÍCIOS (Arts. 44 e 77 CP) ---------
    const analiseBeneficios = useMemo(() => {
        let result = { cabePRD: false, prdMsg: '', cabeSursis: false, sursisMsg: '' };

        if ((isCulposo || penaDefDias <= 1440) && (!hasViolencia || isCulposo) && !isReincidente && penaDefDias > 0) {
            result.cabePRD = true;
            if (penaDefDias <= 360) {
                if (isViolenciaDomestica) {
                    result.prdMsg = 'Substituição por 1 (UMA) restritiva de direitos.\n*Lei Maria da Penha:* Veda pecuniária.';
                } else {
                    result.prdMsg = 'Substituição por 1 (UMA) restritiva ou Multa.';
                }
            } else {
                if (isViolenciaDomestica) {
                    result.prdMsg = `2 (DUAS) restritivas: PSC (${penaDefDias}h) e Limitação FS.`;
                } else {
                    result.prdMsg = `2 (DUAS) restritivas: PSC (${penaDefDias}h) e Pecuniária/Multa.`;
                }
            }
        }

        if (!result.cabePRD && penaDefDias <= 720 && !isReincidente && penaDefDias > 0) {
            result.cabeSursis = true;
            result.sursisMsg = 'Cabe Suspensão Condicional da Pena (Sursis). Prazo de 2 a 4 anos.';
        }

        return result;
    }, [penaDefDias, isCulposo, hasViolencia, isReincidente, isViolenciaDomestica]);

    const handleAddFracao = (type: 'aumento' | 'diminuicao') => {
        const id = Math.random().toString(36).substring(7);
        if (type === 'aumento') setAumentos([...aumentos, { id, num: 1, den: 3 }]);
        else setDiminuicoes([...diminuicoes, { id, num: 1, den: 3 }]);
    };
    
    const parseNumber = (value: string) => {
        const n = parseInt(value, 10);
        return isNaN(n) || n < 0 ? 0 : n;
    };

    return (
        <div className="p-2 md:p-4 fade-in h-full overflow-y-auto w-full max-w-7xl mx-auto space-y-4">
            <div className="flex items-center gap-2 mb-1">
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600 shadow-sm"><Scale size={18} /></div>
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Calculadora de Dosimetria Penal</h2>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Sistema Trifásico • Art. 68 CP</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* LADO DE CONTROLES (8 COLUNAS) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    
                    {/* ETAPA 0: CONFIGURAÇÕES INICIAIS (ABSTRATO + PERFIL) */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                            
                            {/* PARÂMETROS LEGAIS */}
                            <div className="md:pr-4">
                                <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-2 uppercase tracking-wide">
                                    <Info size={14} className="text-blue-500" /> Pena em Abstrato
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Mínima (A/M/D)</label>
                                        <div className="grid grid-cols-3 gap-1">
                                            <input type="number" min="0" placeholder="A" className="p-1 px-2 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none" value={minPena.years || ''} onChange={e => setMinPena({...minPena, years: parseNumber(e.target.value)})} />
                                            <input type="number" min="0" placeholder="M" className="p-1 px-2 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none" value={minPena.months || ''} onChange={e => setMinPena({...minPena, months: parseNumber(e.target.value)})} />
                                            <input type="number" min="0" placeholder="D" className="p-1 px-2 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none" value={minPena.days || ''} onChange={e => setMinPena({...minPena, days: parseNumber(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Máxima (A/M/D)</label>
                                        <div className="grid grid-cols-3 gap-1">
                                            <input type="number" min="0" placeholder="A" className="p-1 px-2 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none" value={maxPena.years || ''} onChange={e => setMaxPena({...maxPena, years: parseNumber(e.target.value)})} />
                                            <input type="number" min="0" placeholder="M" className="p-1 px-2 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none" value={maxPena.months || ''} onChange={e => setMaxPena({...maxPena, months: parseNumber(e.target.value)})} />
                                            <input type="number" min="0" placeholder="D" className="p-1 px-2 border rounded text-xs text-center focus:ring-1 focus:ring-blue-500 outline-none" value={maxPena.days || ''} onChange={e => setMaxPena({...maxPena, days: parseNumber(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Dias-Multa Mín</label>
                                        <input type="number" min="0" className="p-1 px-2 border rounded text-xs w-full focus:ring-1 focus:ring-blue-500 outline-none" value={minMulta || ''} onChange={e => setMinMulta(parseNumber(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Dias-Multa Máx</label>
                                        <input type="number" min="0" className="p-1 px-2 border rounded text-xs w-full focus:ring-1 focus:ring-blue-500 outline-none" value={maxMulta || ''} onChange={e => setMaxMulta(parseNumber(e.target.value))} />
                                    </div>
                                </div>
                            </div>

                            {/* PERFIL DO CRIME */}
                            <div className="md:pl-4 pt-2 md:pt-0">
                                <h3 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-2 uppercase tracking-wide">
                                    <Info size={14} className="text-blue-500" /> Perfil Inicial
                                </h3>
                                <div className="grid grid-cols-1 gap-1.5">
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-2 py-1.5 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                                        <input type="checkbox" className="accent-blue-600 size-3" checked={isCulposo} onChange={e => setIsCulposo(e.target.checked)} />
                                        <span className="text-[11px] font-semibold text-gray-700">Crime Culposo</span>
                                    </label>
                                    <label className={`flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded border transition-colors ${isCulposo ? 'bg-gray-200 border-gray-200 opacity-50' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
                                        <input type="checkbox" className="accent-red-600 size-3" checked={hasViolencia} disabled={isCulposo} onChange={e => setHasViolencia(e.target.checked)} />
                                        <span className="text-[11px] font-semibold text-gray-700">Violência ou Grave Ameaça</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-2 py-1.5 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                                        <input type="checkbox" className="accent-orange-600 size-3" checked={isReincidente} onChange={e => setIsReincidente(e.target.checked)} />
                                        <span className="text-[11px] font-semibold text-gray-700">Reincidente em Crime Doloso</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-pink-50 px-2 py-1.5 rounded border border-pink-100 hover:bg-pink-100 transition-colors">
                                        <input type="checkbox" className="accent-pink-600 size-3" checked={isViolenciaDomestica} onChange={e => setIsViolenciaDomestica(e.target.checked)} />
                                        <span className="text-[11px] font-semibold text-pink-900">Violência Doméstica / Maria da Penha</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FASE 1 - PENA BASE */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-tight">1ª Fase - Circunstâncias Judiciais (Art. 59)</h3>
                                {pesoPPLCircunstancia > 0 && (
                                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-black border border-amber-200 uppercase animate-in fade-in zoom-in duration-300">
                                        Valor: +{formatTime(daysToTime(pesoPPLCircunstancia).years, daysToTime(pesoPPLCircunstancia).months, daysToTime(pesoPPLCircunstancia).days)} por negativa
                                    </span>
                                )}
                            </div>
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm">
                                {numeroNegativas}/8 NEGATIVAS
                            </span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {judiciaisList.map(circ => (
                                <label key={circ} className={`flex items-center gap-2 p-1.5 border rounded-lg cursor-pointer transition-all ${circunstancias[circ] ? 'bg-red-50 border-red-200 shadow-sm ring-1 ring-red-100' : 'hover:bg-gray-50 border-gray-100'}`}>
                                    <input type="checkbox" className="accent-red-600 size-3" checked={circunstancias[circ]} 
                                        onChange={() => setCircunstancias({...circunstancias, [circ]: !circunstancias[circ]})} />
                                    <span className={`text-[10px] leading-tight ${circunstancias[circ] ? 'text-red-700 font-bold' : 'text-gray-600'}`}>{circ}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FASE 2 & 3 - TIGHT GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* FASE 2 */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                            <h3 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-tight">2ª Fase - Agravantes e Atenuantes</h3>
                            <div className="flex justify-between items-center bg-gray-50 p-2 px-3 rounded-lg border border-gray-100">
                                <div className="flex-1 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Agravantes (+)</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <button onClick={() => setAgravantes(Math.max(0, agravantes - 1))} className="text-gray-400 hover:text-red-500 transition-colors"><Minus size={14}/></button>
                                        <span className="font-bold text-lg w-6 text-gray-700">{agravantes}</span>
                                        <button onClick={() => setAgravantes(agravantes + 1)} className="text-gray-400 hover:text-green-500 transition-colors"><Plus size={14}/></button>
                                    </div>
                                </div>
                                <div className="w-px h-8 bg-gray-200 mx-4" />
                                <div className="flex-1 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Atenuantes (-)</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <button onClick={() => setAtenuantes(Math.max(0, atenuantes - 1))} className="text-gray-400 hover:text-red-500 transition-colors"><Minus size={14}/></button>
                                        <span className="font-bold text-lg w-6 text-gray-700">{atenuantes}</span>
                                        <button onClick={() => setAtenuantes(atenuantes + 1)} className="text-gray-400 hover:text-green-500 transition-colors"><Plus size={14}/></button>
                                    </div>
                                </div>
                            </div>
                            {hasSumula231PPL && (
                                <div className="mt-2 text-[9px] text-orange-700 bg-orange-50 p-1.5 rounded border border-orange-100 font-medium italic flex items-center gap-1">
                                    <AlertTriangle size={10} /> Súmula 231 STJ aplicada (limites legais).
                                </div>
                            )}
                        </div>

                        {/* FASE 3 */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-green-500">
                            <h3 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-tight">3ª Fase - Causas de Aum/Dim</h3>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 bg-gray-50 border-gray-200 hover:bg-green-50" onClick={() => handleAddFracao('aumento')}><Plus size={12} className="mr-1 text-green-600"/> Aumento</Button>
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 bg-gray-50 border-gray-200 hover:bg-red-50" onClick={() => handleAddFracao('diminuicao')}><Minus size={12} className="mr-1 text-red-600"/> Diminuição</Button>
                            </div>
                            <div className="mt-2 space-y-1.5 max-h-[85px] overflow-y-auto pr-1 thin-scrollbar">
                                {[...aumentos, ...diminuicoes].length === 0 && (
                                    <div className="text-[10px] text-gray-300 italic text-center py-2">Nenhuma causa adicionada</div>
                                )}
                                {[...aumentos, ...diminuicoes].map((f, i) => {
                                    const isAum = aumentos.includes(f);
                                    return (
                                        <div key={f.id} className={`flex items-center gap-2 p-1 px-2 border rounded-md text-[11px] ${isAum ? 'bg-blue-50/50 border-blue-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                                            <span className={`font-bold text-xs ${isAum ? 'text-blue-600' : 'text-emerald-600'}`}>{isAum ? '+' : '-'}</span>
                                            <input type="number" className="w-9 p-0.5 border rounded text-center bg-white focus:ring-1 focus:ring-blue-300 outline-none" value={f.num || 1} onChange={e => {
                                                const list = isAum ? [...aumentos] : [...diminuicoes];
                                                const idx = list.findIndex(item => item.id === f.id);
                                                list[idx].num = parseNumber(e.target.value);
                                                isAum ? setAumentos(list) : setDiminuicoes(list);
                                            }} />
                                            <span className="text-gray-400">/</span>
                                            <input type="number" className="w-9 p-0.5 border rounded text-center bg-white focus:ring-1 focus:ring-blue-300 outline-none" value={f.den || 1} onChange={e => {
                                                const list = isAum ? [...aumentos] : [...diminuicoes];
                                                const idx = list.findIndex(item => item.id === f.id);
                                                list[idx].den = Math.max(1, parseNumber(e.target.value));
                                                isAum ? setAumentos(list) : setDiminuicoes(list);
                                            }} />
                                            <button onClick={() => isAum ? setAumentos(aumentos.filter(a => a.id !== f.id)) : setDiminuicoes(diminuicoes.filter(a => a.id !== f.id))} className="ml-auto text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* DETRAÇÃO COMPACTA */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-tight">Detração Civil (Para fixação de regime)</h3>
                            <input type="checkbox" className="accent-purple-600 size-3.5 cursor-pointer" checked={temDetracao} onChange={e => setTemDetracao(e.target.checked)} />
                        </div>
                        {temDetracao && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                    <button className={`flex-1 text-[10px] py-1 rounded-md transition-all ${detracaoModo === 'datas' ? 'bg-white shadow-sm font-bold text-purple-700 ring-1 ring-gray-100' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setDetracaoModo('datas')}>Datas</button>
                                    <button className={`flex-1 text-[10px] py-1 rounded-md transition-all ${detracaoModo === 'manual' ? 'bg-white shadow-sm font-bold text-purple-700 ring-1 ring-gray-100' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setDetracaoModo('manual')}>Período</button>
                                </div>
                                {detracaoModo === 'datas' ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Entrada</label>
                                            <input type="date" className="p-1 px-2 border rounded text-xs bg-white focus:ring-1 focus:ring-purple-400 outline-none" value={dataPrisao} onChange={e => setDataPrisao(e.target.value)} title="Data da Prisão" />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Soltura</label>
                                            <input type="date" className="p-1 px-2 border rounded text-xs bg-white focus:ring-1 focus:ring-purple-400 outline-none" value={dataSoltura} onChange={e => setDataSoltura(e.target.value)} title="Data da Soltura" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-bold text-gray-400 text-center uppercase">Anos</label>
                                            <input type="number" className="p-1 border rounded text-xs text-center bg-white focus:ring-1 focus:ring-purple-400 outline-none" value={detracaoTempo.years || ''} onChange={e => setDetracaoTempo({...detracaoTempo, years: parseNumber(e.target.value)})} />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-bold text-gray-400 text-center uppercase">Meses</label>
                                            <input type="number" className="p-1 border rounded text-xs text-center bg-white focus:ring-1 focus:ring-purple-400 outline-none" value={detracaoTempo.months || ''} onChange={e => setDetracaoTempo({...detracaoTempo, months: parseNumber(e.target.value)})} />
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                            <label className="text-[9px] font-bold text-gray-400 text-center uppercase">Dias</label>
                                            <input type="number" className="p-1 border rounded text-xs text-center bg-white focus:ring-1 focus:ring-purple-400 outline-none" value={detracaoTempo.days || ''} onChange={e => setDetracaoTempo({...detracaoTempo, days: parseNumber(e.target.value)})} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* PAINEL DE RESULTADOS (STICKY) */}
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden sticky top-4 ring-1 ring-slate-800">
                        <div className="p-3.5 bg-slate-800/80 border-b border-slate-700 backdrop-blur-sm">
                            <h3 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <Calculator className="text-blue-400" size={16} /> Resumo da Pena
                            </h3>
                        </div>
                        
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/30 p-2 rounded-lg border border-slate-800">
                                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-tight">1ª Fase: Base</p>
                                    <p className="text-xs text-white font-bold leading-tight">{formatTime(baseResult.years, baseResult.months, baseResult.days)}</p>
                                </div>
                                <div className="bg-slate-800/30 p-2 rounded-lg border border-slate-800">
                                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1 tracking-tight">2ª Fase: Interm.</p>
                                    <p className="text-xs text-white font-bold leading-tight">{formatTime(intResult.years, intResult.months, intResult.days)}</p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700 p-4 rounded-xl shadow-inner group transition-all">
                                <p className="text-emerald-400 text-[10px] font-black uppercase mb-1.5 tracking-widest group-hover:tracking-widest transition-all">Pena Definitiva</p>
                                <div className="text-2xl font-black text-white mb-1 tabular-nums">{formatTime(defResult.years, defResult.months, defResult.days)}</div>
                                <p className="text-xs text-slate-400 border-b border-slate-700/50 pb-3 mb-3 font-medium">{multaDef} dias-multa</p>
                                
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] text-blue-400 uppercase font-black tracking-tighter mb-0.5">Sugestão de Regime</p>
                                        <p className="text-sm text-blue-200 font-black leading-tight">{suggRegime}</p>
                                    </div>

                                    {temDetracao && detracaoDias > 0 && (
                                        <div className="pt-2 border-t border-slate-800 flex flex-col gap-1">
                                            <div className="flex justify-between items-center text-[10px] text-slate-400">
                                                <span>Detraídos:</span>
                                                <span className="text-purple-400 font-bold">-{detracaoDias} dias</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-slate-200">
                                                <span className="font-medium">Saldo Final:</span>
                                                <span className="font-black text-emerald-400">{formatTime(restanteResult.years, restanteResult.months, restanteResult.days)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* BENEFÍCIOS COMPACTOS */}
                            {(analiseBeneficios.cabePRD || analiseBeneficios.cabeSursis) && (
                                <div className="space-y-2 pt-2 border-t border-slate-800/50">
                                    {analiseBeneficios.cabePRD && (
                                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-2.5 rounded-lg border-l-4">
                                            <h4 className="text-emerald-400 text-[9px] font-black uppercase mb-1 flex items-center gap-1.5">
                                                <FileText size={10} /> Substituição Art. 44
                                            </h4>
                                            <p className="text-[11px] text-emerald-100/90 leading-snug font-medium italic">
                                                {analiseBeneficios.prdMsg.split('\n')[0]}
                                            </p>
                                        </div>
                                    )}
                                    {analiseBeneficios.cabeSursis && (
                                        <div className="bg-sky-900/20 border border-sky-500/30 p-2.5 rounded-lg border-l-4">
                                            <h4 className="text-sky-400 text-[9px] font-black uppercase mb-1 flex items-center gap-1.5">
                                                <AlertTriangle size={10} /> Sursis Art. 77
                                            </h4>
                                            <p className="text-[11px] text-sky-100/90 leading-snug font-medium italic">
                                                {analiseBeneficios.sursisMsg.split('.')[0]}.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
