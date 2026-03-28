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
    
    // Applying same logic for fine, usually limits apply although not as rigidly debated as PPL in STJ.
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
            // Calcula diff e corrige timestamp da timezone para dia puro
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

    // Sugestão de Regime (baseado na pena restante conforme art. 387, § 2º, CPP)
    const finalYearsFloat = penaRestanteDias / 360;
    let suggRegime = '';
    if (finalYearsFloat > 8) suggRegime = 'Fechado';
    else if (finalYearsFloat > 4 && finalYearsFloat <= 8) suggRegime = 'Semiaberto (Aberto possível dependendo do art. 33, §2º "b")';
    else if (finalYearsFloat > 0) suggRegime = 'Aberto (Avaliar substituição art. 44 CP)';
    else suggRegime = 'Isento/Cumprida';

    // --------- ANÁLISE BENEFÍCIOS (Arts. 44 e 77 CP) ---------
    const analiseBeneficios = useMemo(() => {
        let result = { cabePRD: false, prdMsg: '', cabeSursis: false, sursisMsg: '' };

        // Art. 44 (Substituição PRD) incide sobre a condenação imposta (definitiva não detraída)
        // Requisitos: Pena <= 4 anos (1440 dias), sem violência ou culposo (qualquer pena), réu não reincidente doloso.
        if ((isCulposo || penaDefDias <= 1440) && (!hasViolencia || isCulposo) && !isReincidente && penaDefDias > 0) {
            result.cabePRD = true;
            if (penaDefDias <= 360) {
                if (isViolenciaDomestica) {
                    result.prdMsg = 'Substituição por 1 (UMA) restritiva de direitos.\n*ATENÇÃO:* A Lei Maria da Penha (Art. 17) VEDA o pagamento isolado de multa ou prestação pecuniária. Sugere-se Prestação de Serviços à Comunidade (limitado a tarefas proporcionais) ou Limitação de fim de semana.';
                } else {
                    result.prdMsg = 'Substituição por 1 (UMA) restritiva de direitos (ex: Prestação Pecuniária) OU 1 (UMA) Multa.';
                }
            } else {
                if (isViolenciaDomestica) {
                    result.prdMsg = `Substituição por 2 (DUAS) restritivas de direitos, sendo o sugerido:\n1) Prestação de Serviços à Comunidade (${penaDefDias} horas - Art. 46, §3º);\n2) Limitação de Fim de Semana.\n*ATENÇÃO:* Excluída a Prestação Pecuniária por vedação expressa no art. 17 da Lei 11.340/06.`;
                } else {
                    result.prdMsg = `Substituição por 2 (DUAS) restritivas de direitos, sendo o mais usual:\n1) Prestação de Serviços à Comunidade (${penaDefDias} horas, executadas em no mín. 1 hora/dia - Art. 46, §3º);\n2) Prestação Pecuniária.\n*(Ou 1 PRD + 1 Multa)*`;
                }
            }
        }

        // Art. 77 (Sursis). Aplicável se pena <= 2 anos (720 dias) e somente se NÃO couber PRD (Art. 77, III).
        if (!result.cabePRD && penaDefDias <= 720 && !isReincidente && penaDefDias > 0) {
            result.cabeSursis = true;
            if (isViolenciaDomestica) {
                result.sursisMsg = 'Restritiva inviabilizada pela Súmula 588 STJ/Violência. Suspensão Condicional da Pena (Sursis) MANTIDA. Prazo de 2 a 4 anos (Art. 77 CP), devendo fixar a Prestação de Serviços ou Limitação de Fim de Semana no primeiro ano (*VEDADA prestação pecuniária - Art. 17 Maria da Penha*).';
            } else {
                result.sursisMsg = 'Restritiva inviabilizada (ex: houve violência), porém cabe Suspensão Condicional da Pena (Sursis). Prazo de 2 a 4 anos (Art. 77 CP), mediante prestação de serviços ou fixação equivalente no primeiro ano (Sursis Simples - Art. 78, §1º).';
            }
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
        <div className="p-4 md:p-6 fade-in h-full overflow-y-auto w-full max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg"><Scale className="text-blue-600 size-6" /></div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Calculadora de Dosimetria Penal</h2>
                    <p className="text-sm text-gray-500">Ferramenta para cálculo da pena privativa de liberdade e dias-multa com base no sistema trifásico (Art. 68 CP).</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LADO DE CONTROLES (7 COLUNAS) */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    
                    {/* PARÂMETROS LEGAIS */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Info size={18} className="text-blue-500" /> Pena em Abstrato do Tipo Penal
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Pena Privativa Mínima</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" min="0" placeholder="Anos" className="p-2 border rounded-md w-full text-center" value={minPena.years || ''} onChange={e => setMinPena({...minPena, years: parseNumber(e.target.value)})} title="Anos" />
                                    <input type="number" min="0" placeholder="Meses" className="p-2 border rounded-md w-full text-center" value={minPena.months || ''} onChange={e => setMinPena({...minPena, months: parseNumber(e.target.value)})} title="Meses" />
                                    <input type="number" min="0" placeholder="Dias" className="p-2 border rounded-md w-full text-center" value={minPena.days || ''} onChange={e => setMinPena({...minPena, days: parseNumber(e.target.value)})} title="Dias" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Pena Privativa Máxima</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" min="0" placeholder="Anos" className="p-2 border rounded-md w-full text-center" value={maxPena.years || ''} onChange={e => setMaxPena({...maxPena, years: parseNumber(e.target.value)})} />
                                    <input type="number" min="0" placeholder="Meses" className="p-2 border rounded-md w-full text-center" value={maxPena.months || ''} onChange={e => setMaxPena({...maxPena, months: parseNumber(e.target.value)})} />
                                    <input type="number" min="0" placeholder="Dias" className="p-2 border rounded-md w-full text-center" value={maxPena.days || ''} onChange={e => setMaxPena({...maxPena, days: parseNumber(e.target.value)})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Dias-Multa Mínima</label>
                                <input type="number" min="0" className="p-2 border rounded-md w-full" value={minMulta || ''} onChange={e => setMinMulta(parseNumber(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Dias-Multa Máxima</label>
                                <input type="number" min="0" className="p-2 border rounded-md w-full" value={maxMulta || ''} onChange={e => setMaxMulta(parseNumber(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* PERFIL DO CRIME (BENEFÍCIOS) */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Info size={18} className="text-blue-500" /> Perfil Inicial da Denúncia (P/ Sursis e PRD)
                        </h3>
                        <div className="flex flex-col md:flex-row gap-6 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded border hover:bg-gray-100 flex-1">
                                <input type="checkbox" className="accent-blue-600 size-4" checked={isCulposo} 
                                    onChange={e => setIsCulposo(e.target.checked)} />
                                <span className="text-sm font-semibold text-gray-700">Crime Culposo?</span>
                            </label>
                            
                            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded border flex-1 ${isCulposo ? 'bg-gray-200 opacity-50 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100'}`}>
                                <input type="checkbox" className="accent-red-600 size-4" checked={hasViolencia} disabled={isCulposo}
                                    onChange={e => setHasViolencia(e.target.checked)} />
                                <span className="text-sm font-semibold text-gray-700">Violência ou Grave Ameaça?</span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded border hover:bg-gray-100 flex-1">
                                <input type="checkbox" className="accent-orange-600 size-4" checked={isReincidente} 
                                    onChange={e => setIsReincidente(e.target.checked)} />
                                <span className="text-sm font-semibold text-gray-700">Reincidente em Crime Doloso?</span>
                            </label>
                        </div>
                        <div className="flex flex-col md:flex-row gap-6">
                            <label className="flex items-center gap-2 cursor-pointer bg-pink-50 p-2 rounded border border-pink-200 hover:bg-pink-100 flex-1">
                                <input type="checkbox" className="accent-pink-600 size-4" checked={isViolenciaDomestica} 
                                    onChange={e => setIsViolenciaDomestica(e.target.checked)} />
                                <span className="text-sm font-semibold text-pink-900">Violência Doméstica / Maria da Penha?</span>
                            </label>
                            <div className="flex-1"></div>
                            <div className="flex-1"></div>
                        </div>
                    </div>

                    {/* FASE 1 - PENA BASE */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">1ª Fase - Circunstâncias Judiciais (Art. 59 CP)</h3>
                            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                {numeroNegativas} Negativas
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Assinale as circunstâncias consideradas desfavoráveis. Cada uma aumenta o equivalente a 1/8 do intervalo da pena abstrata
                            {maxDias > minDias && (
                                <span className="font-semibold text-indigo-600 ml-1">
                                    {(maxDias - minDias) / 8 > 0 ? 
                                        `(+ ${formatTime(daysToTime((maxDias - minDias) / 8).years, daysToTime((maxDias - minDias) / 8).months, daysToTime((maxDias - minDias) / 8).days)} por desfavorável)` 
                                        : ''}
                                </span>
                            )}.
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {judiciaisList.map(circ => (
                                <label key={circ} className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${circunstancias[circ] ? 'bg-red-50 border-red-300' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" className="mt-1 accent-red-600" checked={circunstancias[circ]} 
                                        onChange={() => setCircunstancias({...circunstancias, [circ]: !circunstancias[circ]})} />
                                    <span className={`text-sm ${circunstancias[circ] ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>{circ}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FASE 2 - AGRAVANTES E ATENUANTES */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">2ª Fase - Agravantes e Atenuantes</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">A jurisprudência estabelece a fração ideal de 1/6 da pena base para cada circunstância atenuante ou agravante.</p>
                        
                        <div className="flex gap-8">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Adicionar Agravantes (+)</label>
                                <div className="flex bg-gray-100 rounded-lg overflow-hidden border">
                                    <button onClick={() => setAgravantes(Math.max(0, agravantes - 1))} className="p-2 hover:bg-gray-200"><Minus size={16}/></button>
                                    <input type="number" readOnly className="w-16 bg-transparent text-center font-bold outline-none" value={agravantes} />
                                    <button onClick={() => setAgravantes(agravantes + 1)} className="p-2 hover:bg-gray-200"><Plus size={16}/></button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Adicionar Atenuantes (-)</label>
                                <div className="flex bg-gray-100 rounded-lg overflow-hidden border">
                                    <button onClick={() => setAtenuantes(Math.max(0, atenuantes - 1))} className="p-2 hover:bg-gray-200"><Minus size={16}/></button>
                                    <input type="number" readOnly className="w-16 bg-transparent text-center font-bold outline-none" value={atenuantes} />
                                    <button onClick={() => setAtenuantes(atenuantes + 1)} className="p-2 hover:bg-gray-200"><Plus size={16}/></button>
                                </div>
                            </div>
                        </div>
                        {hasSumula231PPL && (
                            <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <p><strong>Súmula 231 STJ:</strong> A pena provisória foi ajustada aos limites legais abstratos (não pode ficar aquém do mínimo nem além do máximo).</p>
                            </div>
                        )}
                    </div>

                    {/* FASE 3 - CAUSAS DE AUMENTO E DIMINUIÇÃO */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-green-500">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">3ª Fase - Causas de Aumento e Diminuição</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">As frações incidem progressivamente em cascata sobre o resultado da 2ª Fase.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* AUMENTOS */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">Causas de Aumento (+)</label>
                                    <Button variant="outline" size="sm" onClick={() => handleAddFracao('aumento')}><Plus size={14}/> Add</Button>
                                </div>
                                <div className="space-y-2">
                                    {aumentos.length === 0 && <div className="text-xs text-gray-400 italic">Nenhum aumento adicionado</div>}
                                    {aumentos.map((f, i) => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 bg-gray-50 border rounded-md">
                                            <span className="text-xs font-bold text-gray-500 w-4">#{i+1}</span>
                                            <input type="number" min="1" className="w-12 p-1 border rounded text-center" value={f.num} onChange={e => {
                                                const newAumentos = [...aumentos]; newAumentos[i].num = parseNumber(e.target.value); setAumentos(newAumentos);
                                            }} />
                                            <span className="text-gray-500">/</span>
                                            <input type="number" min="1" className="w-12 p-1 border rounded text-center" value={f.den} onChange={e => {
                                                const newAumentos = [...aumentos]; newAumentos[i].den = Math.max(1, parseNumber(e.target.value)); setAumentos(newAumentos);
                                            }} />
                                            <button onClick={() => setAumentos(aumentos.filter(a => a.id !== f.id))} className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* DIMINUIÇÕES */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-semibold text-gray-700">Causas de Diminuição (-)</label>
                                    <Button variant="outline" size="sm" onClick={() => handleAddFracao('diminuicao')}><Plus size={14}/> Add</Button>
                                </div>
                                <div className="space-y-2">
                                    {diminuicoes.length === 0 && <div className="text-xs text-gray-400 italic">Nenhuma diminuição adicionada</div>}
                                    {diminuicoes.map((f, i) => (
                                        <div key={f.id} className="flex items-center gap-2 p-2 bg-gray-50 border rounded-md">
                                            <span className="text-xs font-bold text-gray-500 w-4">#{i+1}</span>
                                            <input type="number" min="1" className="w-12 p-1 border rounded text-center" value={f.num} onChange={e => {
                                                const newAum = [...diminuicoes]; newAum[i].num = parseNumber(e.target.value); setDiminuicoes(newAum);
                                            }} />
                                            <span className="text-gray-500">/</span>
                                            <input type="number" min="1" className="w-12 p-1 border rounded text-center" value={f.den} onChange={e => {
                                                const newAum = [...diminuicoes]; newAum[i].den = Math.max(1, parseNumber(e.target.value)); setDiminuicoes(newAum);
                                            }} />
                                            <button onClick={() => setDiminuicoes(diminuicoes.filter(a => a.id !== f.id))} className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* DETRAÇÃO PARA REGIME (ART. 387, §2º, CPP) */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">4ª Etapa (Fixação de Regime) - Detração</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            O Art. 387, § 2º, do CPP prevê o abatimento do tempo de prisão provisória para fins de fixação do regime inicial de cumprimento da pena.
                        </p>
                        
                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                            <input type="checkbox" className="accent-purple-600 size-4" checked={temDetracao} onChange={e => setTemDetracao(e.target.checked)} />
                            <span className="text-sm font-semibold text-gray-700">O réu esteve preso cautelarmente no curso do processo?</span>
                        </label>

                        {temDetracao && (
                            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="flex gap-4 mb-4 border-b border-purple-200 pb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="detracaoModo" className="accent-purple-600" checked={detracaoModo === 'datas'} onChange={() => setDetracaoModo('datas')} />
                                        <span className="text-sm font-semibold text-purple-900">Calcular por Datas</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="detracaoModo" className="accent-purple-600" checked={detracaoModo === 'manual'} onChange={() => setDetracaoModo('manual')} />
                                        <span className="text-sm font-semibold text-purple-900">Período Manual (A/M/D)</span>
                                    </label>
                                </div>

                                {detracaoModo === 'datas' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                                        <div>
                                            <label className="block text-sm font-semibold text-purple-800 mb-2">Data da Prisão</label>
                                            <input type="date" className="p-2 border rounded-md w-full bg-white" value={dataPrisao} onChange={e => setDataPrisao(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-purple-800 mb-2">Data da Soltura <span className="text-xs font-normal">(Deixe em branco p/ Hoje)</span></label>
                                            <input type="date" className="p-2 border rounded-md w-full bg-white" value={dataSoltura} onChange={e => setDataSoltura(e.target.value)} />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <label className="block text-sm font-semibold text-purple-800 mb-2">Tempo a ser detraído:</label>
                                        <div className="grid grid-cols-3 gap-2 max-w-sm">
                                            <input type="number" min="0" placeholder="Anos" className="p-2 border rounded-md text-center bg-white" value={detracaoTempo.years || ''} onChange={e => setDetracaoTempo({...detracaoTempo, years: parseNumber(e.target.value)})} title="Anos" />
                                            <input type="number" min="0" placeholder="Meses" className="p-2 border rounded-md text-center bg-white" value={detracaoTempo.months || ''} onChange={e => setDetracaoTempo({...detracaoTempo, months: parseNumber(e.target.value)})} title="Meses" />
                                            <input type="number" min="0" placeholder="Dias" className="p-2 border rounded-md text-center bg-white" value={detracaoTempo.days || ''} onChange={e => setDetracaoTempo({...detracaoTempo, days: parseNumber(e.target.value)})} title="Dias" />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* PAINEL DE RESULTADOS (5 COLUNAS) */}
                <div className="lg:col-span-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden sticky top-6">
                        <div className="p-4 bg-slate-800 border-b border-slate-700">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Calculator className="text-blue-400" size={18} />
                                Resumo da Pena
                            </h3>
                        </div>
                        
                        <div className="p-5 space-y-6">
                            
                            {/* Result 1 */}
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Pena Base (1ª Fase)</p>
                                <div className="flex flex-col gap-1">
                                    <div className="text-lg text-white">{formatTime(baseResult.years, baseResult.months, baseResult.days)}</div>
                                    <div className="text-sm text-slate-400">{Math.round(multaBase)} dias-multa</div>
                                </div>
                            </div>

                            <div className="h-px bg-slate-700 w-full" />

                            {/* Result 2 */}
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Pena Intermediária (2ª Fase)</p>
                                <div className="flex flex-col gap-1">
                                    <div className="text-lg text-white">{formatTime(intResult.years, intResult.months, intResult.days)}</div>
                                    <div className="text-sm text-slate-400">{Math.round(multaInt)} dias-multa</div>
                                </div>
                            </div>

                            <div className="h-px bg-slate-700 w-full" />

                            {/* Result 3 */}
                            <div>
                                <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">Pena Definitiva</p>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-white mb-2">
                                        {formatTime(defResult.years, defResult.months, defResult.days)}
                                    </div>
                                    <div className="text-slate-300 font-medium pb-2 border-b border-slate-700 mb-4">
                                        {multaDef} dias-multa
                                    </div>

                                    {temDetracao && detracaoDias > 0 && (
                                        <div className="bg-slate-900 border border-purple-800 p-3 rounded-md mb-4">
                                            <p className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-1">Detração</p>
                                            <p className="text-sm text-slate-300">- {formatTime(detracaoResult.years, detracaoResult.months, detracaoResult.days)}</p>
                                            <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800">
                                                Restante: <span className="text-white font-medium">{formatTime(restanteResult.years, restanteResult.months, restanteResult.days)}</span>
                                            </p>
                                        </div>
                                    )}

                                    <div className="">
                                        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Sugestão de Regime Inicial</p>
                                        <p className="text-blue-300 font-semibold">{suggRegime}</p>
                                        {temDetracao && detracaoDias > 0 && (
                                            <p className="text-[10px] text-slate-500 mt-1">*Regime calculado com base no saldo remanescente (Art. 387, § 2º, CPP).</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Benefícios Legais Card */}
                            {(analiseBeneficios.cabePRD || analiseBeneficios.cabeSursis) && (
                                <div className="mt-6 space-y-3">
                                    {analiseBeneficios.cabePRD && (
                                        <div className="bg-emerald-900/30 border border-emerald-800 p-4 rounded-lg">
                                            <h4 className="text-emerald-400 font-bold uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
                                                <AlertTriangle size={14} /> Substituição Art. 44 CP
                                            </h4>
                                            <p className="text-sm text-emerald-100 whitespace-pre-line leading-relaxed">
                                                {analiseBeneficios.prdMsg}
                                            </p>
                                        </div>
                                    )}

                                    {analiseBeneficios.cabeSursis && (
                                        <div className="bg-sky-900/30 border border-sky-800 p-4 rounded-lg">
                                            <h4 className="text-sky-400 font-bold uppercase tracking-wider text-xs mb-2 flex items-center gap-2">
                                                <AlertTriangle size={14} /> Sursis (Art. 77 CP)
                                            </h4>
                                            <p className="text-sm text-sky-100 whitespace-pre-line leading-relaxed">
                                                {analiseBeneficios.sursisMsg}
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
