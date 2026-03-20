import React, { useState, useMemo } from 'react';
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
    // Use milliseconds to correctly handle fractional years (setFullYear truncates decimals)
    const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
    const newTime = date.getTime() + years * MS_PER_YEAR;
    return new Date(newTime).toISOString().split('T')[0];
};

export const PrescriptionCalculator: React.FC<{ session: any }> = ({ session }) => {
    const { teamOwnerId, unitId, checkPermission } = useUserRole(session);
    const hasEdit = checkPermission('criminal', 'edit');

    const [copied, setCopied] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [data, setData] = useState({
        // Bloco 1
        nome: '', dataNascimento: '', caseNumber: '',
        // Bloco 2
        infracao: '',
        penaMaxAnos: 0, penaMaxMeses: 0,
        penaAplAnos: 0, penaAplMeses: 0,
        // Bloco 3
        dataFato: '', dataDenuncia: '', dataPronuncia: '', dataConfirmacaoPronuncia: '',
        dataSentenca: '', dataInicioPena: '', dataReincidencia: '',
        // Bloco 4
        citadoEdital: false, dataSuspensao: '', novoEndereco: '',
        usePerspectiva: false
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

        // Base Prescription Terms (Ensure numbers)
        const pMaxA = parseFloat(data.penaMaxAnos as any || 0);
        const pMaxM = parseFloat(data.penaMaxMeses as any || 0);
        const pAplA = parseFloat(data.penaAplAnos as any || 0);
        const pAplM = parseFloat(data.penaAplMeses as any || 0);

        let prazoBrutoAbstrato = getPrazo(pMaxA, pMaxM);
        let prazoBrutoConcreto = (pAplA > 0 || pAplM > 0) ? getPrazo(pAplA, pAplM) : 0;
        
        let prazoAbstrato = prazoBrutoAbstrato;
        let prazoConcreto = prazoBrutoConcreto > 0 ? prazoBrutoConcreto : null;
        
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

        const dataFimSuspensao = data.citadoEdital && data.dataSuspensao ? addYearsToDate(data.dataSuspensao, prazoAbstrato) : '';
        const marcosComSuspensao = [...marcos];
        if (dataFimSuspensao && data.dataSuspensao) {
            marcosComSuspensao.push({ label: 'Suspensão (Art. 366)', date: data.dataSuspensao, isSuspension: true });
            marcosComSuspensao.push({ label: 'Retomada (Súmula 415)', date: dataFimSuspensao, isRetomada: true });
        }
        marcosComSuspensao.sort((a, b) => a.date.localeCompare(b.date));

        const analiseIntervalos = [];
        let prescrito = false;
        let diffAcumuladaDias = 0; 
        let ultimoParamLimit = prazoAbstrato;

        for (let i = 0; i < marcosComSuspensao.length - 1; i++) {
            const mStart = marcosComSuspensao[i];
            const mEnd = marcosComSuspensao[i + 1];
            
            // Interruption (Art. 117 CP): Reset the clock!
            const isInterruptive = !mStart.isSuspension && !mStart.isRetomada;
            if (isInterruptive && i > 0) {
                diffAcumuladaDias = 0;
            }

            const isSuspendedPeriod = mStart.isSuspension || (marcosComSuspensao.some(m => m.isSuspension && m.date <= mStart.date) && !mStart.isRetomada && mEnd.date <= dataFimSuspensao);
            
            let paramLimit = prazoAbstrato;
            if (prazoConcreto) {
                const isAfterDenuncia = !!data.dataDenuncia && mStart.date >= data.dataDenuncia;
                const isBefore2010 = !!data.dataFato && data.dataFato < '2010-05-05';
                const isVirtual = !!data.usePerspectiva;
                if (isAfterDenuncia || isBefore2010 || isVirtual) paramLimit = prazoConcreto;
            }

            if (data.dataReincidencia && mStart.date >= (data.dataInicioPena || '9999-12-31')) {
                paramLimit = paramLimit * 1.3333;
            }
            ultimoParamLimit = paramLimit;

            const diff = diffFormat(mStart.date, mEnd.date);
            if (!diff) continue;

            if (!isSuspendedPeriod) {
                diffAcumuladaDias += diff.diasTotal;
            }

            const anosAcumulados = diffAcumuladaDias / 365.25;
            const isPrescritoInt = !isSuspendedPeriod && anosAcumulados >= paramLimit;
            const isAlertaInt = !isSuspendedPeriod && !isPrescritoInt && anosAcumulados >= (paramLimit - 1);

            if (isPrescritoInt) prescrito = true;

            analiseIntervalos.push({
                de: mStart.label,
                ate: mEnd.label,
                dateDe: mStart.date,
                dateAte: mEnd.date,
                diff,
                acumuladoAnos: anosAcumulados,
                limite: paramLimit.toFixed(1).replace('.0', ''),
                prescreveu: isPrescritoInt,
                alerta: isAlertaInt,
                suspenso: isSuspendedPeriod
            });
        }

        // Add Future Expectation Row if not prescribed
        let projecaoPrescricaoTotal = '';
        const todayStr = new Date().toISOString().split('T')[0];

        if (!prescrito && marcosComSuspensao.length > 0) {
            const lastMarco = marcosComSuspensao[marcosComSuspensao.length - 1];
            
            // Priority limit for projection (Virtual/Intercorrente)
            let projectionLimit = prazoAbstrato;
            if (prazoConcreto) {
                const isAfterDenuncia = !!data.dataDenuncia && lastMarco.date >= data.dataDenuncia;
                const isBefore2010 = !!data.dataFato && data.dataFato < '2010-05-05';
                const isVirtual = !!data.usePerspectiva;
                if (isAfterDenuncia || isBefore2010 || isVirtual) projectionLimit = prazoConcreto;
            }
            if (data.dataReincidencia && lastMarco.date >= (data.dataInicioPena || '9999-12-31')) {
                projectionLimit = projectionLimit * 1.3333;
            }

            // RESET current accumulation for the NEXT period starting from the last milestone
            // ONLY if the last milestone was an interruption (which they all are except virtual ones)
            if (!lastMarco.isSuspension && !lastMarco.isRetomada) {
                diffAcumuladaDias = 0;
            }

            const anosAcumuladosAteAgora = diffAcumuladaDias / 365.25;
            const anosRestantes = projectionLimit - anosAcumuladosAteAgora;
            const dataProjetada = addYearsToDate(lastMarco.date, anosRestantes);
            
            if (dataProjetada) {
                const hasPrescritoByProjecao = dataProjetada <= todayStr;
                if (hasPrescritoByProjecao) prescrito = true;

                analiseIntervalos.push({
                    de: lastMarco.label,
                    ate: 'Expectativa de Prescrição Final',
                    dateDe: lastMarco.date,
                    dateAte: dataProjetada,
                    diff: { anos: Math.floor(anosRestantes), meses: Math.floor((anosRestantes % 1) * 12), dias: 0 },
                    limite: projectionLimit.toFixed(1).replace('.0', ''),
                    prescreveu: hasPrescritoByProjecao,
                    alerta: !hasPrescritoByProjecao && anosRestantes <= 1,
                    suspenso: false,
                    isExpectation: true
                });
                
                if (hasPrescritoByProjecao) {
                    projecaoPrescricaoTotal = `A prescrição se consumou (em tese) em ${formatDateBr(dataProjetada)} (PRESCRIÇÃO CONSUMADA).`;
                } else {
                    projecaoPrescricaoTotal = `A prescrição se consumará (em tese) em ${formatDateBr(dataProjetada)}, caso não haja novo marco.`;
                }
            }
        }

        // Specific Suspension Text
        let suspensaoText = '';
        if (data.citadoEdital && data.dataSuspensao) {
            suspensaoText = `O prazo máximo de suspensão da prescrição (Súmula 415/STJ) encerrará em ${formatDateBr(dataFimSuspensao)}.`;
        }

        return {
            prazoBrutoAbstrato, prazoBrutoConcreto,
            prazoAbstrato, prazoConcreto, redutorAplica, redutorMotivo,
            analiseIntervalos, prescrito, suspensaoText, projecaoPrescricaoTotal,
            dataFimSuspensao: data.citadoEdital && data.dataSuspensao ? addYearsToDate(data.dataSuspensao, prazoAbstrato) : '',
            dataConsumacao366: data.citadoEdital && data.dataSuspensao ? addYearsToDate(addYearsToDate(data.dataSuspensao, prazoAbstrato), prazoAbstrato) : ''
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
                case_number: data.caseNumber, 
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
        const pMaxA = parseFloat(data.penaMaxAnos as any || 0);
        const pMaxM = parseFloat(data.penaMaxMeses as any || 0);
        const pAplA = parseFloat(data.penaAplAnos as any || 0);
        const pAplM = parseFloat(data.penaAplMeses as any || 0);

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

            addLine("I. SÍNTESE DOS DADOS PROCESSUAIS RELEVANTES", true);
            addLine(`Acusado: ${data.nome || 'Não informado'}`);
            addLine(`Infração Penal: ${data.infracao}`);
            addLine(`Data do Fato: ${formatDateBr(data.dataFato)}`);
            addLine(`Nascimento: ${formatDateBr(data.dataNascimento)}`);
            y += 5;

            addLine("II. PRESCRIÇÃO EM ABSTRATO", true);
            addLine(`Com base na pena máxima informada (${pMaxA}a ${pMaxM}m), o prazo abstrato é de ${report.prazoAbstrato} anos.`);
            if (report.redutorAplica) {
                addLine(`(Atenção: Aplicou-se a redução do prazo pela metade - Art. 115, CP. Acusado era ${report.redutorMotivo})`);
            }
            y += 5;

            if (pAplA > 0 || pAplM > 0) {
                addLine("III. PRESCRIÇÃO EM CONCRETO (SENTENÇA)", true);
                addLine(`Prazo concretizado a partir da pena aplicada: ${report.prazoConcreto} anos.`);
                y += 5;
            }

            addLine("IV. ANÁLISE CRONOLÓGICA DOS MARCOS INTERRUPTIVOS", true);
            if (report.analiseIntervalos.length > 0) {
                const head = [["De", "Data A", "Até", "Data B", "Lapso", "Limit", "Status"]];
                const body = report.analiseIntervalos.map((i: any) => [
                    i.de, formatDateBr(i.dateDe), i.ate, formatDateBr(i.dateAte),
                    i.suspenso ? "PRAZO SUSPENSO" : (i.isExpectation ? "---" : `${i.diff.anos}a ${i.diff.meses}m ${i.diff.dias}d`), 
                    i.suspenso ? "---" : `${i.limite}a`, 
                    i.suspenso ? "SUSPENSO" : (i.prescreveu ? "PRESCRITO" : (i.isExpectation ? "PROJECAO" : (i.alerta ? "ALERTA" : "OK")))
                ]);
                autoTable(doc, { 
                    head, body, startY: y, 
                    styles: { fontSize: 7 }, 
                    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 20 }, 2: { cellWidth: 25 }, 3: { cellWidth: 20 } },
                    headStyles: { fillColor: [40, 40, 40] },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.column.index === 6) {
                            const val = data.cell.text[0];
                            if (val === 'PRESCRITO') data.cell.styles.textColor = [200, 0, 0];
                            if (val === 'ALERTA') data.cell.styles.textColor = [200, 100, 0];
                            if (val === 'PROJECAO') data.cell.styles.textColor = [100, 0, 180];
                            if (val === 'OK') data.cell.styles.textColor = [0, 120, 0];
                            if (val === 'SUSPENSO') data.cell.styles.textColor = [0, 0, 200];
                        }
                    }
                });
                y = (doc as any).lastAutoTable.finalY + 10;
            } else {
                addLine("Nenhum intervalo viavel inserido.");
                y += 5;
            }

            addLine("V. SITUAÇÃO ATUAL E DATAS CRÍTICAS", true);
            addLine(`Status global: ${report.prescrito ? 'Consumada em intervalo anterior' : (data.dataSuspensao ? 'Suspensa (Art. 366)' : 'Em curso regular')}`);
            if (data.dataSuspensao) addLine(report.suspensaoText);
            if (report.projecaoPrescricaoTotal) addLine(report.projecaoPrescricaoTotal);
            y += 5;

            if (data.citadoEdital && data.dataSuspensao) {
                addLine("VI. PROVIDÊNCIAS NA SUSPENSÃO (ART. 366 CPP)", true);
                if (data.novoEndereco) addLine(`Expeça-se mandado de citação para novo endereço do MP: ${data.novoEndereco}.`);
                else addLine(`Deverão ser feitas consultas anuais de endereço.`);
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nome Completo</label>
                            <input type="text" value={data.nome} onChange={e => handleChange('nome', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" placeholder="Ex: João da Silva" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Número do Processo</label>
                            <input type="text" value={data.caseNumber} onChange={e => handleChange('caseNumber', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" placeholder="Ex: 0000000-00.0000.8.14.0000" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Data de Nascimento</label>
                            <input type="date" value={data.dataNascimento} onChange={e => handleChange('dataNascimento', e.target.value)} className="w-full border rounded p-2 text-sm outline-none" />
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
                            <div className="mt-2 flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="usePerspectiva"
                                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    checked={data.usePerspectiva}
                                    onChange={(e) => handleChange('usePerspectiva', e.target.checked)}
                                />
                                <label htmlFor="usePerspectiva" className="text-[10px] text-green-800 font-semibold leading-tight">
                                    Prescrição Virtual (ignora vedação Art. 110 CP)
                                </label>
                            </div>
                        </div>
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
                <div className="bg-justice-900 text-white p-4 rounded-t-xl flex justify-between items-center sm:flex-row flex-col gap-3">
                    <h2 className="font-bold font-serif flex items-center gap-2"><FileText size={18}/> Relatório Analítico</h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={!report}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-white/40 text-white bg-white/10 hover:bg-white hover:text-justice-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={15}/> Baixar PDF
                        </button>
                        <button 
                            onClick={handleCopy} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border border-white/40 text-white bg-white/10 hover:bg-white hover:text-justice-900 transition-colors"
                        >
                            {copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copiado!' : 'Copiar Texto'}
                        </button>
                    </div>
                </div>
                
                <div 
                    id="report-output"
                    className="p-8 bg-white border-x border-b border-gray-200 shadow-inner flex-1 overflow-auto text-sm leading-relaxed"
                    style={{ fontFamily: '"Times New Roman", Times, serif', minHeight: '600px' }}
                >
                    {!report ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 py-20">
                            <Calculator size={48} className="mb-4 text-justice-200" />
                            <p className="font-medium text-justice-900">Aguardando dados...</p>
                            <p className="text-xs">Preencha a Infração e Pena Máxima (Bloco 2)</p>
                        </div>
                    ) : (
                        <div className="space-y-8 text-black">
                            {/* Header Centered */}
                            <div className="text-center mb-10 border-b-2 border-black pb-2">
                                <h1 className="text-xl font-bold uppercase underline">Calculadora Prescricional Criminal</h1>
                                <p className="text-xs font-semibold mt-1">RELATÓRIO DE ANÁLISE EM ABSTRATO / CONCRETO</p>
                            </div>

                            {/* Section I */}
                            <section>
                                <h3 className="font-bold border-b border-gray-100 mb-3 uppercase tracking-wider text-xs bg-gray-50 p-1.5 text-center">I. Síntese dos Dados Processuais Relevantes</h3>
                                <div className="ml-4 space-y-1">
                                    <p><strong>• Acusado:</strong> {data.nome || 'Não informado'}</p>
                                    <p><strong>• Processo:</strong> {data.caseNumber || '---'}</p>
                                    <p><strong>• Infração Penal:</strong> {data.infracao || '---'}</p>
                                    <p><strong>• Data do Fato:</strong> {formatDateBr(data.dataFato)}</p>
                                    <p><strong>• Nascimento:</strong> {formatDateBr(data.dataNascimento)}</p>
                                </div>
                            </section>

                            {/* Section II */}
                            <section>
                                <h3 className="font-bold border-b border-gray-100 mb-3 uppercase tracking-wider text-xs bg-gray-50 p-1.5 text-center">II. Prescrição em Abstrato</h3>
                                <div className="ml-4">
                                    <p>Pena Máxima: {data.penaMaxAnos} anos e {data.penaMaxMeses} meses.</p>
                                    <p>• Prazo (Art. 109 CP): <strong>{report.prazoBrutoAbstrato} anos</strong>.</p>
                                    {report.redutorAplica && (
                                        <p>• Prazo Reduzido (Art. 115 CP - Metade): <strong>{report.prazoAbstrato} anos</strong>.</p>
                                    )}
                                    {report.redutorAplica && (
                                        <div className="bg-red-50 border-l-4 border-red-500 p-3 mt-3 text-red-900 italic text-xs">
                                            <strong>NOTA ART. 115 CP:</strong> O acusado é {report.redutorMotivo}. Portanto, o prazo prescricional foi reduzido pela metade.
                                        </div>
                                    )}
                                </div>
                            </section>

                            {(data.penaAplAnos > 0 || data.penaAplMeses > 0) && (
                                <section>
                                    <h3 className="font-bold border-b border-gray-100 mb-3 uppercase tracking-wider text-xs bg-gray-50 p-1.5 text-center">III. Prescrição em Concreto</h3>
                                    <div className="ml-4">
                                        <p>Pena Aplicada: {data.penaAplAnos} anos e {data.penaAplMeses} meses.</p>
                                        <p>• Prazo (Art. 109 CP): <strong>{report.prazoBrutoConcreto} anos</strong>.</p>
                                        {report.redutorAplica && (
                                            <p>• Prazo Reduzido (Art. 115 CP - Metade): <strong>{report.prazoConcreto} anos</strong>.</p>
                                        )}
                                        <p className="mt-2 text-xs text-gray-600 italic">Este prazo regula a prescrição intercorrente e retroativa (nos termos do Art. 110, §1º do CP).</p>
                                    </div>
                                </section>
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
                                                    <th className="p-2 border-b">Data A</th>
                                                    <th className="p-2 border-b">Até (Marco B)</th>
                                                    <th className="p-2 border-b">Data B</th>
                                                    <th className="p-2 border-b">Lapso</th>
                                                    <th className="p-2 border-b text-center">Tolerância</th>
                                                    <th className="p-2 border-b text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {report.analiseIntervalos.map((interval: any, idx: number) => (
                                                    <tr key={idx} className={`border-b border-black/10 last:border-b-0 ${interval.suspenso ? 'bg-blue-50/30 font-italic text-blue-900' : (interval.isExpectation ? 'bg-gray-50 italic text-gray-500' : '')}`}>
                                                        <td className="p-2">{interval.de}</td>
                                                        <td className="p-2 font-mono text-[10px]">{formatDateBr(interval.dateDe)}</td>
                                                        <td className="p-2">{interval.ate}</td>
                                                        <td className="p-2 font-mono text-[10px]">{formatDateBr(interval.dateAte)}</td>
                                                        <td className="p-2 text-center font-medium whitespace-nowrap">
                                                            {interval.suspenso ? 'Suspenso' : (interval.isExpectation ? '---' : `${interval.diff.anos}a ${interval.diff.meses}m ${interval.diff.dias}d`)}
                                                        </td>
                                                        <td className="p-2 text-center text-gray-600 font-mono text-[10px]">{interval.suspenso ? '---' : `${interval.limite}a`}</td>
                                                        <td className={`p-2 font-bold text-center uppercase text-[10px] ${
                                                            interval.suspenso ? 'text-blue-600' : 
                                                            interval.prescreveu ? 'text-red-600' : 
                                                            interval.alerta ? (interval.isExpectation ? 'text-orange-500' : 'text-orange-500 underline') : 'text-green-700'
                                                        }`}>
                                                            {interval.suspenso ? 'SUSPENSO' : 
                                                             interval.prescreveu ? 'PRESCRITO' : 
                                                             (interval.isExpectation ? 'PROJEÇÃO' : (interval.alerta ? 'ALERTA' : 'OK'))}
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
