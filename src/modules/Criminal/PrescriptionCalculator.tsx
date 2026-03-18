import { Calendar, User, FileText, Activity, MapPin, Calculator, Copy, Check, Save, Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Utilities
const getPrazo = (anos: number, meses: number = 0, dias: number = 0) => {
    const totalAnos = (anos || 0) + (meses || 0) / 12 + (dias || 0) / 365;
    if (totalAnos === 0) return 0;
    if (totalAnos > 12) return 20;
    if (totalAnos > 8) return 16;
    if (totalAnos > 4) return 12;
    if (totalAnos > 2) return 8;
    if (totalAnos >= 1) return 4;
    return 3;
};

const safeDate = (dStr: string) => {
    if (!dStr) return null;
    const d = new Date(dStr.includes('T') ? dStr : dStr + 'T12:00:00Z');
    return isNaN(d.getTime()) ? null : d;
};

const getAge = (birthDate: string, targetDate: string) => {
    const b = safeDate(birthDate);
    const t = safeDate(targetDate);
    if (!b || !t) return null;
    let age = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) {
        age--;
    }
    return age;
};

const diffFormat = (d1: string, d2: string) => {
    const start = safeDate(d1 > d2 ? d2 : d1);
    const end = safeDate(d1 > d2 ? d1 : d2);
    if (!start || !end) return null;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diasTotal = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const anos = Math.floor(diasTotal / 365.25);
    const meses = Math.floor((diasTotal % 365.25) / 30.44);
    const dias = Math.floor((diasTotal % 365.25) % 30.44);
    return { anos, meses, dias, diasTotal, isNegative: d1 > d2 };
};

const formatDateBr = (d: string) => {
    const dt = safeDate(d);
    return dt ? dt.toLocaleDateString('pt-BR') : '---';
};

const addYearsToDate = (d: string, years: number) => {
    const date = safeDate(d);
    if (!date) return '';
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().split('T')[0];
};

export const PrescriptionCalculator: React.FC<{ session: any }> = ({ session }) => {
    const { teamOwnerId, unitId, checkPermission } = useUserRole(session);
    const hasEdit = checkPermission('criminal', 'edit');

    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [data, setData] = useState({
        // Bloco 1
        nome: '', dataNascimento: '',
        // Bloco 2
        infracao: '',
        penaMaxAnos: 0, penaMaxMeses: 0,
        penaAplAnos: 0, penaAplMeses: 0,
        regime: '',
        // Bloco 3
        dataFato: '', dataDenuncia: '', dataPronuncia: '', dataConfirmacaoPronuncia: '',
        dataSentenca: '', dataInicioPena: '', dataReincidencia: '',
        // Bloco 4
        citadoEdital: false, dataSuspensao: '', novoEndereco: ''
    });

    const handleChange = (field: string, value: any) => setData(p => ({ ...p, [field]: value }));

    const handleCopy = () => {
        const el = document.getElementById('report-output');
        if (el) {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            document.execCommand('copy');
            sel?.removeAllRanges();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Calculate Logic
    const report = useMemo(() => {
        if (!data.infracao || (data.penaMaxAnos === 0 && data.penaMaxMeses === 0)) return null;

        // Base Prescription Terms
        let prazoAbstrato = getPrazo(data.penaMaxAnos, data.penaMaxMeses);
        let prazoConcreto = data.penaAplAnos || data.penaAplMeses ? getPrazo(data.penaAplAnos, data.penaAplMeses) : null;
        
        let prazoAtivo = prazoConcreto || prazoAbstrato;

        // Age Reduction (Art 115)
        let redutorAplica = false;
        let redutorMotivo = '';
        const ageFato = getAge(data.dataNascimento, data.dataFato);
        const ageSentenca = getAge(data.dataNascimento, data.dataSentenca);

        if (ageFato !== null && ageFato < 21) {
            redutorAplica = true;
            redutorMotivo = `menor de 21 anos na data do fato (${ageFato} anos)`;
        } else if (ageSentenca !== null && ageSentenca > 70) {
            redutorAplica = true;
            redutorMotivo = `maior de 70 anos na data da sentença (${ageSentenca} anos)`;
        }

        if (redutorAplica) {
            prazoAbstrato = prazoAbstrato / 2;
            if (prazoConcreto) prazoConcreto = prazoConcreto / 2;
            prazoAtivo = prazoAtivo / 2;
        }

        // Intervals Analysis
        const marcos = [];
        if (data.dataFato) marcos.push({ label: 'Data do Fato', date: data.dataFato });
        if (data.dataDenuncia) marcos.push({ label: 'Recebimento da Denúncia', date: data.dataDenuncia });
        if (data.dataPronuncia) marcos.push({ label: 'Pronúncia', date: data.dataPronuncia });
        if (data.dataConfirmacaoPronuncia) marcos.push({ label: 'Confirmação Pron.', date: data.dataConfirmacaoPronuncia });
        if (data.dataSentenca) marcos.push({ label: 'Publicação da Sentença', date: data.dataSentenca });
        if (data.dataInicioPena) marcos.push({ label: 'Início do Cumprimento', date: data.dataInicioPena });
        if (data.dataReincidencia) marcos.push({ label: 'Reincidência', date: data.dataReincidencia });

        const analiseIntervalos = [];
        let prescrito = false;
        let dataPrescricao = '';

        for (let i = 0; i < marcos.length - 1; i++) {
            const paramLimit = (marcos[i+1].date <= (data.dataSentenca || '9999-12-31') && prazoConcreto) ? prazoConcreto : prazoAbstrato;
            
            // Note: Lei 12.234/2010 forbids retroactivity before Denuncia. We should notice it, but for simplicity, we use the rule requested implicitly.
            const diff = diffFormat(marcos[i].date, marcos[i+1].date);
            if (!diff) continue;

            const hasPrescribed = diff.diasTotal > (paramLimit * 365.25);
            if (hasPrescribed) prescrito = true;

            analiseIntervalos.push({
                de: marcos[i].label,
                ate: marcos[i+1].label,
                diff,
                limite: paramLimit,
                prescreveu: hasPrescribed
            });
        }

        // Suspensions (Art. 366 CPP)
        let suspensaoText = '';
        let projecaoPrescricaoTotal = '';
        if (data.citadoEdital && data.dataSuspensao) {
            const dataFimSuspensao = addYearsToDate(data.dataSuspensao, prazoAbstrato);
            suspensaoText = `O prazo máximo de suspensão da prescrição (Súmula 415/STJ) encerrará em ${formatDateBr(dataFimSuspensao)}.`;
            const dataConsumacao366 = addYearsToDate(dataFimSuspensao, prazoAtivo);
            projecaoPrescricaoTotal = `A prescrição total / art. 366 se consumará em ${formatDateBr(dataConsumacao366)}.`;
        } else if (marcos.length > 0) {
            const ultimoMarco = marcos[marcos.length - 1].date;
            projecaoPrescricaoTotal = `A prescrição total se consumará em ${formatDateBr(addYearsToDate(ultimoMarco, prazoAtivo))}, caso não haja novo marco.`;
        }

        return {
            prazoAbstrato, prazoConcreto, redutorAplica, redutorMotivo,
            analiseIntervalos, prescrito, suspensaoText, projecaoPrescricaoTotal,
            dataFimSuspensao: data.citadoEdital && data.dataSuspensao ? addYearsToDate(data.dataSuspensao, prazoAbstrato) : '',
            dataConsumacao366: data.citadoEdital && data.dataSuspensao ? addYearsToDate(addYearsToDate(data.dataSuspensao, prazoAbstrato), prazoAtivo) : ''
        };

    }, [data]);

    const handleSaveSuspended = async () => {
        if (!hasEdit) return alert('Você não tem permissão para editar.');
        if (!data.nome) return alert('Digite o Nome do Réu no Bloco 1.');
        if (!data.dataSuspensao || !report?.dataConsumacao366) return alert('Preencha os dados de suspensão.');

        setIsSaving(true);
        try {
            const { error } = await supabase.from('suspended_cases').insert([{
                name: data.nome,
                case_number: '', 
                penal_type: data.infracao,
                suspension_date: data.dataSuspensao,
                prescription_date: report.dataConsumacao366,
                obs: data.novoEndereco ? `Novo endereço pelo MP: ${data.novoEndereco}` : 'Gerado via Calculadora',
                user_id: teamOwnerId || session?.user?.id,
                unit_id: unitId
            }]);
            
            if (error) throw error;
            alert('Processo Suspenso adicionado com sucesso à Lista!');
        } catch (error: any) {
            alert('Erro ao salvar processo suspenso: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPDF = () => {
        if (!report) return;
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            doc.setFontSize(14);
            doc.text("CALCULADORA PRESCRICIONAL CRIMINAL", 14, 15);
            doc.setFontSize(10);
            doc.text("Relatório de Análise em Abstrato / Concreto", 14, 21);
            
            let y = 30;
            const addLine = (text: string, bold = false) => {
                doc.setFont("helvetica", bold ? "bold" : "normal");
                const lines = doc.splitTextToSize(text, 180);
                doc.text(lines, 14, y);
                y += lines.length * 5;
                if (y > 280) { doc.addPage(); y = 20; }
            };

            addLine("I. SINTESE DOS DADOS PROCESSUAIS RELEVANTES", true);
            addLine(`Acusado: ${data.nome || 'Nao informado'}`);
            addLine(`Infracao Penal: ${data.infracao}`);
            addLine(`Data do Fato: ${formatDateBr(data.dataFato)}`);
            addLine(`Nascimento: ${formatDateBr(data.dataNascimento)}`);
            y += 5;

            addLine("II. PRESCRICAO EM ABSTRATO", true);
            addLine(`Com base na pena maxima informada (${data.penaMaxAnos}a ${data.penaMaxMeses}m), o prazo abstrato e de ${report.prazoAbstrato} anos.`);
            if (report.redutorAplica) {
                addLine(`(Atencao: Aplicou-se a reducao do prazo pela metade - Art. 115, CP. Acusado era ${report.redutorMotivo})`);
            }
            y += 5;

            if (data.penaAplAnos > 0 || data.penaAplMeses > 0) {
                addLine("III. PRESCRICAO EM CONCRETO (SENTENCA)", true);
                addLine(`Prazo concretizado a partir da pena aplicada: ${report.prazoConcreto} anos.`);
                y += 5;
            }

            addLine("IV. ANALISE CRONOLOGICA DOS MARCOS INTERRUPTIVOS", true);
            if (report.analiseIntervalos.length > 0) {
                const head = [["De", "Ate", "Lapso Calculado", "Limite", "Status"]];
                const body = report.analiseIntervalos.map((i: any) => [
                    i.de, i.ate, `${i.diff.anos}a ${i.diff.meses}m ${i.diff.dias}d`, `${i.limite} anos`, i.prescreveu ? "PRESCRITO" : "Ok"
                ]);
                autoTable(doc, { 
                    head, body, startY: y, 
                    styles: { fontSize: 8 }, 
                    headStyles: { fillColor: [40, 40, 40] } 
                });
                y = (doc as any).lastAutoTable.finalY + 10;
            } else {
                addLine("Nenhum intervalo viavel inserido.");
                y += 5;
            }

            addLine("V. SITUACAO ATUAL E DATAS CRITICAS", true);
            addLine(`Status global: ${report.prescrito ? 'Consumada em intervalo anterior' : (data.dataSuspensao ? 'Suspensa (Art. 366)' : 'Em curso regular')}`);
            if (data.dataSuspensao) addLine(report.suspensaoText.replace(/ç|ã/g, 'c').replace(/õ/g, 'o'));
            if (report.projecaoPrescricaoTotal) addLine(report.projecaoPrescricaoTotal.replace(/ç|ã/g, 'c').replace(/õ/g, 'o'));
            y += 5;

            if (data.citadoEdital && data.dataSuspensao) {
                addLine("VI. PROVIDENCIAS NA SUSPENSAO (ART. 366 CPP)", true);
                if (data.novoEndereco) addLine(`Expeça-se mandado de citacao para novo endereco do MP: ${data.novoEndereco}.`);
                else addLine(`Deverao ser feitas consultas anuais de endereco.`);
            }

            doc.save(`Calculo_Prescricional_${data.nome ? data.nome.replace(/\s+/g, '_') : 'Relatorio'}.pdf`);
        } catch(e) {
            console.error(e);
            alert("Erro ao gerar PDF.");
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 p-4">
            
            {/* FORM COLUMN */}
            <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-justice-900 border-b pb-2">
                    <Calculator size={20} /> Entradas da Calculadora
                </h2>

                {/* Bloco 1 */}
                <section className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><User size={16}/> Bloco 1: Acusado</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nome Compledo</label>
                            <input type="text" value={data.nome} onChange={e => handleChange('nome', e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-justice-500 outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Data de Nascimento</label>
                            <input type="date" value={data.dataNascimento} onChange={e => handleChange('dataNascimento', e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-justice-500 outline-none" />
                        </div>
                    </div>
                </section>

                {/* Bloco 2 */}
                <section className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FileText size={16}/> Bloco 2: Tipo Penal</h3>
                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Infração Penal (Ex: Art. 155, CP)</label>
                        <input type="text" value={data.infracao} onChange={e => handleChange('infracao', e.target.value)} className="w-full border rounded p-2 text-sm focus:ring-1 focus:ring-justice-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="border border-red-100 bg-red-50 p-3 rounded-lg">
                            <label className="block text-xs font-bold text-red-800 mb-2">Pena MÁXIMA (Abstrato)</label>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Anos" value={data.penaMaxAnos || ''} onChange={e => handleChange('penaMaxAnos', parseInt(e.target.value))} className="w-1/2 border rounded p-1 text-sm outline-none" min="0"/>
                                <input type="number" placeholder="Meses" value={data.penaMaxMeses || ''} onChange={e => handleChange('penaMaxMeses', parseInt(e.target.value))} className="w-1/2 border rounded p-1 text-sm outline-none" min="0" max="11"/>
                            </div>
                        </div>
                        <div className="border border-green-100 bg-green-50 p-3 rounded-lg">
                            <label className="block text-xs font-bold text-green-800 mb-2">Pena APLICADA (Concreto)</label>
                            <div className="flex gap-2">
                                <input type="number" placeholder="Anos" value={data.penaAplAnos || ''} onChange={e => handleChange('penaAplAnos', parseInt(e.target.value))} className="w-1/2 border rounded p-1 text-sm outline-none" min="0"/>
                                <input type="number" placeholder="Meses" value={data.penaAplMeses || ''} onChange={e => handleChange('penaAplMeses', parseInt(e.target.value))} className="w-1/2 border rounded p-1 text-sm outline-none" min="0" max="11"/>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Regime Inicial</label>
                        <select value={data.regime} onChange={e => handleChange('regime', e.target.value)} className="w-full border rounded p-2 text-sm outline-none">
                            <option value="">Selecione...</option>
                            <option value="Aberto">Aberto</option>
                            <option value="Semiaberto">Semiaberto</option>
                            <option value="Fechado">Fechado</option>
                        </select>
                    </div>
                </section>

                {/* Bloco 3 */}
                <section className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Activity size={16}/> Bloco 3: Marcos Interruptivos (Art. 117)</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Data do Fato</label>
                            <input type="date" value={data.dataFato} onChange={e => handleChange('dataFato', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Recebimento da Denúncia</label>
                            <input type="date" value={data.dataDenuncia} onChange={e => handleChange('dataDenuncia', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Publicação da Sentença</label>
                            <input type="date" value={data.dataSentenca} onChange={e => handleChange('dataSentenca', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Início da Pena / Trânsito</label>
                            <input type="date" value={data.dataInicioPena} onChange={e => handleChange('dataInicioPena', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                        </div>
                        
                        <div className="col-span-2 pt-2 border-t mt-2">
                            <p className="text-xs text-gray-400 mb-2 italic">Apenas se aplicável (Júri / Execução):</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Pronúncia</label>
                                    <input type="date" value={data.dataPronuncia} onChange={e => handleChange('dataPronuncia', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Confirmação Pronúncia</label>
                                    <input type="date" value={data.dataConfirmacaoPronuncia} onChange={e => handleChange('dataConfirmacaoPronuncia', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bloco 4 */}
                <section className="mb-6">
                    <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><MapPin size={16}/> Bloco 4: Suspensão (Art. 366 CPP)</h3>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                        <input type="checkbox" checked={data.citadoEdital} onChange={e => handleChange('citadoEdital', e.target.checked)} className="rounded text-justice-600 focus:ring-justice-500" />
                        Acusado citado por edital sem comparecimento?
                    </label>
                    
                    {data.citadoEdital && (
                        <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded border">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Data da Suspensão (Art. 366)</label>
                                <input type="date" value={data.dataSuspensao} onChange={e => handleChange('dataSuspensao', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Novo endereço fornecido pelo MP?</label>
                                <input type="text" placeholder="Se sim, cole o endereço..." value={data.novoEndereco} onChange={e => handleChange('novoEndereco', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
                            </div>
                        </div>
                    )}
                    
                    {data.citadoEdital && data.dataSuspensao && report?.dataConsumacao366 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <Button 
                                variant="primary" 
                                className="w-full justify-center bg-red-600 hover:bg-red-700 text-white" 
                                leftIcon={Save}
                                disabled={isSaving}
                                onClick={handleSaveSuspended}
                            >
                                {isSaving ? 'Salvando...' : 'Salvar na Lista de Suspensos'}
                            </Button>
                        </div>
                    )}
                </section>

            </div>

            {/* REPORT COLUMN */}
            <div className="w-full md:w-1/2 flex flex-col">
                <div className="bg-justice-900 text-white p-4 rounded-t-xl flex justify-between items-center sm:flex-row flex-col gap-2">
                    <h2 className="font-bold font-serif flex items-center gap-2"><FileText size={18}/> Relatório Analítico</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="text-white border-white hover:bg-white hover:text-justice-900 h-8 flex items-center gap-1" disabled={!report}>
                            <Download size={14}/> Baixar PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopy} className="text-white border-white hover:bg-white hover:text-justice-900 h-8 flex items-center gap-1">
                            {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copiado!' : 'Copiar Texto'}
                        </Button>
                    </div>
                </div>
                
                <div 
                    id="report-output" 
                    className="bg-white border-x border-b border-gray-200 rounded-b-xl p-8 flex-1 overflow-y-auto text-sm leading-relaxed" 
                    style={{ fontFamily: '"Century Gothic", CenturyGothic, sans-serif', fontSize: '11pt', maxHeight: 'calc(100vh - 160px)' }}
                >
                    {!report ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                            <Calculator size={48} className="mb-4" />
                            <p>Preencha os dados à esquerda (Infração e Pena Máxima)</p>
                            <p>para gerar a análise prescricional automaticamente.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 text-gray-800 isolate">
                            
                            <div className="text-center mb-8 border-b-2 border-gray-900 pb-2">
                                <h1 className="font-bold uppercase text-lg">CALCULADORA PRESCRICIONAL CRIMINAL</h1>
                                <p className="text-xs uppercase text-gray-500">Relatório de Análise em Abstrato / Concreto</p>
                            </div>

                            <div>
                                <p className="font-bold uppercase mb-2">I. Síntese dos Dados Processuais Relevantes</p>
                                <ul className="list-disc pl-5">
                                    <li><strong>Acusado:</strong> {data.nome || 'Não informado'}</li>
                                    <li><strong>Infração Penal:</strong> {data.infracao}</li>
                                    <li><strong>Data do Fato:</strong> {formatDateBr(data.dataFato)}</li>
                                    <li><strong>Nascimento:</strong> {formatDateBr(data.dataNascimento)}</li>
                                </ul>
                            </div>

                            <div>
                                <p className="font-bold uppercase mb-2">II. Prescrição em Abstrato</p>
                                <p>Com base na pena máxima em abstrato informada ({data.penaMaxAnos} anos e {data.penaMaxMeses} meses), o prazo prescricional aplicável, nos termos do art. 109 do CP, é de <strong>{report.prazoAbstrato} anos</strong>.</p>
                                {report.redutorAplica && (
                                    <p className="text-red-700 bg-red-50 p-2 border-l-2 border-red-500 mt-2 text-xs">Atenção: O acusado é {report.redutorMotivo}. Aplicou-se a redução do prazo pela metade (Art. 115, CP).</p>
                                )}
                            </div>

                            {(data.penaAplAnos > 0 || data.penaAplMeses > 0) && (
                                <div>
                                    <p className="font-bold uppercase mb-2">III. Prescrição em Concreto (Sentença)</p>
                                    <p>Considerando a pena concretamente aplicada ({data.penaAplAnos} anos e {data.penaAplMeses} meses), o prazo prescricional regulador passa a ser de <strong>{report.prazoConcreto} anos</strong>, aplicável inclusive retroativamente aos marcos anteriores à sentença (respeitado o art. 110, §1º do CP para fatos posteriores a 2010).</p>
                                </div>
                            )}

                            <div>
                                <p className="font-bold uppercase mb-2">IV. Análise Cronológica dos Marcos Interruptivos</p>
                                {report.analiseIntervalos.length === 0 ? (
                                    <p className="text-gray-500 italic">Insira os marcos na coluna ao lado para verificar lapsos temporais.</p>
                                ) : (
                                    <div className="border border-gray-200 rounded overflow-hidden">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 border-b">De (Marco A)</th>
                                                    <th className="p-2 border-b">Até (Marco B)</th>
                                                    <th className="p-2 border-b">Lapso</th>
                                                    <th className="p-2 border-b text-center">Tolerância</th>
                                                    <th className="p-2 border-b text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.analiseIntervalos.map((interval: any, idx) => (
                                                    <tr key={idx} className="border-b last:border-b-0">
                                                        <td className="p-2">{interval.de}</td>
                                                        <td className="p-2">{interval.ate}</td>
                                                        <td className="p-2">{interval.diff.anos}a {interval.diff.meses}m {interval.diff.dias}d</td>
                                                        <td className="p-2 text-center text-gray-500">{interval.limite} anos</td>
                                                        <td className={`p-2 font-bold text-center uppercase ${interval.prescreveu ? 'text-red-600' : 'text-green-600'}`}>
                                                            {interval.prescreveu ? 'Prescrito' : 'Ok'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div>
                                <p className="font-bold uppercase mb-2">V. Situação Atual e Datas Críticas</p>
                                <p>
                                    <strong>Status global:</strong> {' '}
                                    <span className={`font-bold uppercase ${report.prescrito ? 'text-red-600' : 'text-blue-600'}`}>
                                        {report.prescrito ? 'Consumada em intervalo anterior' : (data.dataSuspensao ? 'Suspensa (Art. 366)' : 'Em curso regular')}
                                    </span>
                                </p>
                                <ul className="list-disc pl-5 mt-2">
                                    {data.dataSuspensao && <li>{report.suspensaoText}</li>}
                                    {report.projecaoPrescricaoTotal && <li>{report.projecaoPrescricaoTotal}</li>}
                                </ul>
                            </div>

                            {data.citadoEdital && data.dataSuspensao && (
                                <div>
                                    <p className="font-bold uppercase mb-2">VI. Providências na Suspensão (Art. 366 CPP)</p>
                                    {data.novoEndereco ? (
                                        <p className="bg-blue-50 border-l-4 border-blue-500 p-3 italic">
                                            Constatado novo endereço fornecido pelo MP: "Expeça-se mandado de citação para o endereço indicado ({data.novoEndereco}), sem necessidade de nova conclusão dos autos."
                                        </p>
                                    ) : (
                                        <p className="bg-yellow-50 border-l-4 border-yellow-500 p-3 text-xs">
                                            Deverão ser adotadas anualmente as seguintes providências, independentemente de nova conclusão: a) solicitar ao MP a busca de endereços nos sistemas (SENAD, RFB, INSS, etc.); b) expedir citação para eventual endereço localizado; c) registrar o resultado.
                                        </p>
                                    )}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
