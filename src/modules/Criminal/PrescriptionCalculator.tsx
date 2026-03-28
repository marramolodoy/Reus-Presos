import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Download, AlertCircle, Plus, Trash, HelpCircle, Save, FolderOpen } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { useUserRole } from '../../hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip } from 'react-tooltip';

interface PrescriptionMilestone {
  id: string;
  name: string;
  date: string;       // Data do marco (ex: Data do Fato)
  description: string;
  type: 'initial' | 'interruption' | 'suspension' | 'end_suspension';
  isMinorOrSenior?: boolean; // Menor de 21 ou Maior de 70 (Reduz pela metade)
}

interface SavedCalculation {
    id?: string;
    description: string;
    max_penalty_years: number;
    max_penalty_months: number;
    max_penalty_days: number;
    milestones: PrescriptionMilestone[];
    user_id?: string;
    unit_id?: string;
}

export const PrescriptionCalculator: React.FC<{session: any}> = ({ session }) => {
  const { unitId, user_id } = useUserRole(session);
  const [description, setDescription] = useState('Cálculo CP - Processo X');
  const [maxPenalty, setMaxPenalty] = useState({ years: 0, months: 0, days: 0 });
  const [milestones, setMilestones] = useState<PrescriptionMilestone[]>([
    { id: '1', name: 'Data do Fato', date: '', description: '', type: 'initial', isMinorOrSenior: false }
  ]);
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([]);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);

  // Standard Prescriptive Terms (Art. 109, CP)
  const getPrescriptiveTerm = (years: number, months: number, days: number): number => {
    const totalDays = (years * 365) + (months * 30) + days;
    const yearsFloat = totalDays / 365;

    if (totalDays === 0) return 0;
    if (yearsFloat < 1) return 3;
    if (yearsFloat >= 1 && yearsFloat < 2) return 4;
    if (yearsFloat >= 2 && yearsFloat <= 4) return 8;
    if (yearsFloat > 4 && yearsFloat <= 8) return 12;
    if (yearsFloat > 8 && yearsFloat <= 12) return 16;
    if (yearsFloat > 12) return 20;
    return 0;
  };

  const addMilestone = () => {
    setMilestones([...milestones, {
      id: Math.random().toString(36).substr(2, 9),
      name: 'Recebimento Denúncia',
      date: '',
      description: '',
      type: 'interruption'
    }]);
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const updateMilestone = (id: string, field: keyof PrescriptionMilestone, value: any) => {
    setMilestones(milestones.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // ----- MAIN CALCULATION ENGINE -----
  const report = useMemo(() => {
    const baseTerm = getPrescriptiveTerm(maxPenalty.years, maxPenalty.months, maxPenalty.days);
    
    // Sort milestones chronologically
    const sorted = [...milestones]
        .filter(m => m.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sorted.length === 0 || baseTerm === 0) return null;

    let isSuspended = false;
    let accumulatedDays = 0; // The continuous clock timer
    let prescriptionDate: Date | null = null;
    let lastActiveDate = new Date(sorted[0].date); // Track when the clock started/restarted

    const events: any[] = [];
    const initialMilestone = sorted.find(m => m.type === 'initial');
    const hasMinorSenior = sorted.some(m => m.isMinorOrSenior);
    const finalTerm = hasMinorSenior ? baseTerm / 2 : baseTerm;
    const prescriptiveDaysTarget = finalTerm * 365.25;

    // Initialize prescription Date based on the first event
    prescriptionDate = new Date(lastActiveDate);
    prescriptionDate.setFullYear(prescriptionDate.getFullYear() + finalTerm);


    for (let i = 0; i < sorted.length; i++) {
        const currentEvent = sorted[i];
        const currentDate = new Date(currentEvent.date);

        // Calculate days elapsed since the "last Active Date"
        let daysSinceLast = 0;
        if (!isSuspended) {
            daysSinceLast = (currentDate.getTime() - lastActiveDate.getTime()) / (1000 * 3600 * 24);
            accumulatedDays += daysSinceLast;
        }

        // Check if Prescription occurred BEFORE this event happened
        if (!isSuspended && accumulatedDays >= prescriptiveDaysTarget) {
            // It prescribed! The date it prescribed was (prescriptiveDaysTarget - previous_accumulated) days after lastActiveDate
            const daysToPrescribe = prescriptiveDaysTarget - (accumulatedDays - daysSinceLast);
            const exactPrescriptionDate = new Date(lastActiveDate);
            exactPrescriptionDate.setDate(exactPrescriptionDate.getDate() + Math.round(daysToPrescribe));
            
             events.push({
                type: 'prescription_reached',
                date: exactPrescriptionDate,
                message: `⚠️ Prescrição Ocorreu! (${finalTerm} anos atingidos)`
            });
            prescriptionDate = exactPrescriptionDate;
            break; // Stop evaluating further events, it's already dead
        }

        // Process the current event
        if (currentEvent.type === 'initial') {
            events.push({
                ...currentEvent,
                accumulatedYears: (accumulatedDays / 365.25).toFixed(2),
                status: 'Início da contagem'
            });
            lastActiveDate = currentDate;

        } else if (currentEvent.type === 'interruption') {
            events.push({
                ...currentEvent,
                accumulatedYears: (accumulatedDays / 365.25).toFixed(2),
                status: 'Prazo Zerado (Interrupção)'
            });
            accumulatedDays = 0; // Reset the clock
            lastActiveDate = currentDate;
            // Update projected prescription date
            prescriptionDate = new Date(lastActiveDate);
            prescriptionDate.setFullYear(prescriptionDate.getFullYear() + finalTerm);

        } else if (currentEvent.type === 'suspension') {
             events.push({
                ...currentEvent,
                accumulatedYears: (accumulatedDays / 365.25).toFixed(2),
                status: 'Contagem Pausada (Suspensão)'
            });
            isSuspended = true;
            lastActiveDate = currentDate; // Set point of suspension

        } else if (currentEvent.type === 'end_suspension') {
            events.push({
                ...currentEvent,
                accumulatedYears: (accumulatedDays / 365.25).toFixed(2),
                status: 'Contagem Retomada'
            });
            if (isSuspended) {
                 isSuspended = false;
                 lastActiveDate = currentDate; // Clock resumes from today
                 // Update projected prescription date, factoring in the accumulated days before suspension
                 const remainingDays = prescriptiveDaysTarget - accumulatedDays;
                 prescriptionDate = new Date(currentDate);
                 prescriptionDate.setDate(prescriptionDate.getDate() + Math.round(remainingDays));
            }
        }
    }

    // Final check for the period AFTER the last listed event up to TODAY
    const today = new Date();
    if (!isSuspended && events.length > 0 && !events.some(e => e.type === 'prescription_reached')) {
         const daysSinceLast = (today.getTime() - lastActiveDate.getTime()) / (1000 * 3600 * 24);
         const currentAccumulated = accumulatedDays + daysSinceLast;

         if (currentAccumulated >= prescriptiveDaysTarget) {
            const daysToPrescribe = prescriptiveDaysTarget - accumulatedDays;
            const exactPrescriptionDate = new Date(lastActiveDate);
            exactPrescriptionDate.setDate(exactPrescriptionDate.getDate() + Math.round(daysToPrescribe));
            
             events.push({
                type: 'prescription_reached',
                date: exactPrescriptionDate,
                message: `⚠️ Prescrição Ocorreu! (${finalTerm} anos atingidos)`
            });
         }
    }


    const remainingDays = prescriptiveDaysTarget - accumulatedDays;
    let projectedDate = null;
    if (!isSuspended && !events.some(e => e.type === 'prescription_reached')) {
        projectedDate = new Date(lastActiveDate);
        projectedDate.setDate(projectedDate.getDate() + remainingDays);
    }

    return {
      baseTerm,
      finalTerm,
      isSuspended,
      prescriptionDate: projectedDate,
      events,
      hasMinorSenior,
      accumulatedDays
    };
  }, [milestones, maxPenalty]);

  // DB Sync Functions (Save / Load)
   const fetchCalculations = async () => {
    if (!unitId) return;
    const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('unit_id', unitId)
        .eq('calc_type', 'prescription')
        .order('created_at', { ascending: false });

    if (!error && data) {
         setSavedCalculations(data.map(d => ({
            id: d.id,
            description: d.description,
            max_penalty_years: d.calc_data.maxPenalty.years,
            max_penalty_months: d.calc_data.maxPenalty.months,
            max_penalty_days: d.calc_data.maxPenalty.days,
            milestones: d.calc_data.milestones
         })));
    }
  };

  const handleSaveCalculation = async () => {
      if (!description.trim() || !unitId || !user_id) {
          alert("Adicione uma descrição para salvar e certifique-se de estar logado.");
          return;
      }

      const payload = {
          unit_id: unitId,
          user_id: user_id,
          calc_type: 'prescription',
          description,
          calc_data: { maxPenalty, milestones }
      };

      const { error } = await supabase.from('calculations').insert([payload]);
      
      if (error) {
          alert('Erro ao salvar cálculo: ' + error.message);
      } else {
          alert('Cálculo salvo com sucesso!');
          fetchCalculations();
      }
  };

  const loadCalculation = (calc: SavedCalculation) => {
      setDescription(calc.description);
      setMaxPenalty({ years: calc.max_penalty_years, months: calc.max_penalty_months, days: calc.max_penalty_days });
      setMilestones(calc.milestones);
      setIsLoadModalOpen(false);
  };

  const deleteCalculation = async (id: string) => {
      if(!confirm("Tem certeza que deseja excluir este cálculo salvo?")) return;
      const { error } = await supabase.from('calculations').delete().eq('id', id);
      if(error) alert('Erro: ' + error.message);
      else fetchCalculations();
  };

  // PDF Download
  const generatePDF = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Relatório de Cálculo Prescricional (Pena em Abstrato)', 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Descrição: ${description}`, 14, 30);
    doc.text(`Pena Máxima Base: ${maxPenalty.years}a ${maxPenalty.months}m ${maxPenalty.days}d`, 14, 38);
    doc.text(`Prazo Prescricional Aplicável: ${report.finalTerm} anos ${report.hasMinorSenior ? '(Reduzido 1/2)' : ''}`, 14, 46);
    
    // Status text
    let statusTxt = 'Status: O Prazo está correndo normalmente.';
    if(report.isSuspended) statusTxt = 'Status: SUSPENSO (Art. 366 CPP). O prazo está congelado.';
    if(report.events.some(e => e.type === 'prescription_reached')) statusTxt = 'Status: PRESCREVEU! Verifique a data no relatório abaixo.';
    doc.setTextColor(report.isSuspended || report.events.some(e => e.type === 'prescription_reached') ? 200 : 0, 0, 0);
    doc.text(statusTxt, 14, 54);
    doc.setTextColor(0,0,0);

    const body = report.events.map(e => [
      format(new Date(e.date), 'dd/MM/yyyy'),
      e.name || e.message,
      e.type === 'interruption' ? 'Zerou' : e.type === 'suspension' ? 'Pausou' : e.type.includes('prescription') ? 'PRESCREVEU' : '...',
      Math.floor(e.accumulatedYears) + ' anos' || '-'
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Data', 'Marco / Evento', 'Ação no Prazo', 'Anos Decorridos Acumulados']],
      body: body,
      theme: 'grid'
    });

    if (report.prescriptionDate) {
        doc.text(`Projeção da Prescrição: ${format(report.prescriptionDate, 'dd/MM/yyyy')}`, 14, (doc as any).lastAutoTable.finalY + 15);
    }
    
    doc.save(`Prescricao_${description}.pdf`);
  };

  return (
    <div className="fade-in p-4 md:p-6 max-w-5xl mx-auto space-y-6">
       {/* LOAD MODAL */}
       {isLoadModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl">
                    <h2 className="text-xl font-bold mb-4">Carregar Cálculos Salvos</h2>
                    
                    <div className="max-h-96 overflow-y-auto w-full mb-4">
                        {savedCalculations.length === 0 ? <p className="text-gray-500">Nenhum cálculo salvo na unidade.</p> : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2">Descrição</th>
                                        <th className="px-4 py-2">Pena</th>
                                        <th className="px-4 py-2 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedCalculations.map(c => (
                                        <tr key={c.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium">{c.description}</td>
                                            <td className="px-4 py-2">{c.max_penalty_years}a {c.max_penalty_months}m</td>
                                            <td className="px-4 py-2 text-right flex justify-end gap-2">
                                                <Button size="sm" onClick={() => loadCalculation(c)}>Carregar</Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => deleteCalculation(c.id!)}>X</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    
                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => setIsLoadModalOpen(false)}>Fechar</Button>
                    </div>
                </div>
            </div>
        )}


      <div className="flex justify-between items-center mb-6">
           <div>
               <h2 className="text-2xl font-bold text-gray-800">Cálculo Prescricional (Pena Máxima)</h2>
               <p className="text-sm text-gray-500">Art. 109, Código Penal - Prescrição da Pretensão Punitiva</p>
           </div>
           <div className="flex gap-2">
               <Button variant="outline" onClick={() => { fetchCalculations(); setIsLoadModalOpen(true); }} leftIcon={FolderOpen}>
                   Carregar
               </Button>
               <Button variant="primary" onClick={handleSaveCalculation} leftIcon={Save}>
                   Salvar
               </Button>
           </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-gray-50 rounded-t-lg border-b">
            <CardTitle className="text-lg">Dados do Crime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
             <div>
                 <label className="block text-sm font-medium text-gray-700">Identificador/Processo</label>
                 <input 
                    type="text" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="mt-1 w-full border rounded p-2 focus:ring-justice-500 focus:border-justice-500" 
                    placeholder="Ex: Proc 12345-67 - Réu João"
                 />
             </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                Pena Máxima em Abstrato
                <HelpCircle size={14} className="text-gray-400" data-tooltip-id="pena-tip" />
                <Tooltip id="pena-tip" place="top">Insira a pena máxima prevista na lei para o crime (Art 109, CP).</Tooltip>
              </label>
              <div className="flex gap-2 mt-1">
                <input type="number" placeholder="Anos" className="w-full border rounded p-2" min="0" value={maxPenalty.years || ''} onChange={e => setMaxPenalty({...maxPenalty, years: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="Meses" className="w-full border rounded p-2" min="0" value={maxPenalty.months || ''} onChange={e => setMaxPenalty({...maxPenalty, months: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="Dias" className="w-full border rounded p-2" min="0" value={maxPenalty.days || ''} onChange={e => setMaxPenalty({...maxPenalty, days: parseInt(e.target.value) || 0})} />
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 border border-blue-100 flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5" />
                <div>
                   <strong>Prazo Legal (Art 109): </strong>
                    {report?.baseTerm ? `${report.baseTerm} anos` : 'Defina a pena para calcular.'} <br/>
                    {report?.hasMinorSenior && <span className="text-xs font-bold text-red-600 block mt-1">ATENÇÃO: Prazo Reduzido pela Metade (Art 115 CP) Ativado nos marcos temporais. O prazo aplicado será de {report.finalTerm} anos.</span>}
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-gray-50 rounded-t-lg border-b flex justify-between flex-row items-center">
            <CardTitle className="text-lg">Marcos Temporais</CardTitle>
            <Button size="sm" variant="outline-primary" onClick={addMilestone} leftIcon={Plus}>Adicionar Marco</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[400px] overflow-auto">
              {milestones.map((milestone, idx) => (
                <div key={milestone.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row gap-3">
                     <div className="flex-1">
                         <input type="date" className="w-full border rounded p-2 text-sm" value={milestone.date} onChange={e => updateMilestone(milestone.id, 'date', e.target.value)} />
                     </div>
                     <div className="flex-[2]">
                          <select className="w-full border rounded p-2 text-sm" value={milestone.name} onChange={e => updateMilestone(milestone.id, 'name', e.target.value)}>
                            {idx === 0 && <option value="Data do Fato">Data do Fato</option>}
                            {idx > 0 && (
                                <>
                                <optgroup label="Causas Interruptivas (Zerem o prazo)">
                                    <option value="Recebimento Denúncia">Recebimento da Denúncia</option>
                                    <option value="Publicação Pronúncia">Publicação da Pronúncia</option>
                                    <option value="Acórdão Confirmatório Pronúncia">Acórdão Confirmatório de Pronúncia</option>
                                    <option value="Publicação Sentença Condenatória">Publicação de Sentença Condenatória</option>
                                    <option value="Início Cumprimento Pena">Início Cumprimento Pena</option>
                                    <option value="Reincidência">Reincidência</option>
                                </optgroup>
                                <optgroup label="Causas Suspensivas (Pausam o prazo)">
                                    <option value="Citação Edital (Art 366 CPP)">Art 366 CPP (Citação Edital)</option>
                                    <option value="Questão Prejudicial">Resolução de Questão Prejudicial</option>
                                    <option value="Cumprindo Pena Estrangeiro">Cumprindo Pena no Estrangeiro</option>
                                </optgroup>
                                <optgroup label="Retomada de Prazo">
                                    <option value="Fim da Suspensão">Fim da Suspensão / Prisão do Réu</option>
                                </optgroup>
                                </>
                            )}
                          </select>
                     </div>
                     <div className="flex items-center gap-2">
                          <select className="border rounded p-2 text-sm w-32 bg-gray-50" value={milestone.type} onChange={e => updateMilestone(milestone.id, 'type', e.target.value)}>
                              <option value="initial">Início</option>
                              <option value="interruption">Interrompe</option>
                              <option value="suspension">Suspende</option>
                              <option value="end_suspension">Retoma</option>
                          </select>
                          {idx > 0 && (
                             <button onClick={() => removeMilestone(milestone.id)} className="text-red-500 hover:text-red-700 p-2"><Trash size={16} /></button>
                          )}
                     </div>
                  </div>
                  
                  {/* ART 115 CHECKBOX FOR INITIAL DATE */}
                  {idx === 0 && (
                      <div className="mt-2 text-sm text-gray-600 flex items-center">
                          <input type="checkbox" id="minor" checked={milestone.isMinorOrSenior} onChange={e => updateMilestone(milestone.id, 'isMinorOrSenior', e.target.checked)} className="mr-2" />
                          <label htmlFor="minor" className="cursor-pointer">
                              Aplicar Art. 115 CP (Menor de 21 na data do fato ou maior de 70 na sentença)
                          </label>
                      </div>
                  )}
                </div>
              ))}
            </div>
            {milestones.length === 0 && <div className="p-8 text-center text-gray-500">Adicione os marcos processuais acima.</div>}
          </CardContent>
        </Card>
      </div>

      {report && (
        <Card className={`shadow-sm border-t-4 ${report.events.some(e => e.type === 'prescription_reached') ? 'border-red-500' : report.isSuspended ? 'border-orange-400' : 'border-green-500'}`}>
              <CardContent className="p-6">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-bold">Relatório de Análise</h3>
                        <p className={`font-bold mt-1 ${report.events.some(e => e.type === 'prescription_reached') ? 'text-red-600 font-bold uppercase' : report.isSuspended ? 'text-orange-600' : 'text-green-600'}`}>
                            Status: {report.events.some(e => e.type === 'prescription_reached') ? 'PRESCREVEU O PROCESSO' : report.isSuspended ? 'PROCESSO SUSPENSO (Prazos Congelados)' : 'Prazos Correndo Normalmente'}
                        </p>
                    </div>
                    <Button variant="outline" onClick={generatePDF} leftIcon={Download}>Download PDF</Button>
                 </div>

                 <div className="relative border-l-2 border-gray-200 ml-4 pl-6 space-y-6">
                    {report.events.map((evt, idx) => (
                        <div key={idx} className="relative">
                            <div className={`absolute -left-[35px] w-4 h-4 rounded-full border-2 border-white ${evt.type.includes('prescription') ? 'bg-red-500 w-5 h-5 -left-[37px] animate-pulse' : evt.type === 'interruption' ? 'bg-blue-500' : evt.type === 'suspension' ? 'bg-orange-500' : evt.type === 'end_suspension' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <div className="flex flex-col md:flex-row md:items-baseline gap-2">
                                <span className={`font-bold ${evt.type.includes('prescription') ? 'text-red-600' : ''}`}>{format(new Date(evt.date), 'dd/MM/yyyy')}</span>
                                <span className="text-gray-800 font-medium">{evt.name || evt.message}</span>
                            </div>
                            {!evt.type.includes('prescription') && (
                                <div className="text-sm text-gray-500 mt-1 flex gap-4">
                                    <span className="font-mono bg-gray-100 px-1 rounded">{evt.status}</span>
                                </div>
                            )}
                        </div>
                    ))}

                    {!report.events.some(e => e.type === 'prescription_reached') && report.prescriptionDate && (
                         <div className="relative pt-4 border-t border-dashed">
                             <div className="absolute -left-[35px] w-4 h-4 rounded-full border-2 border-white bg-red-800 opacity-50"></div>
                             <p className="font-bold text-red-800 opacity-80">Projeção Futura da Prescrição (se não houver interrupção)</p>
                             <p className="text-lg text-red-600 font-mono font-bold">{format(report.prescriptionDate, 'dd/MM/yyyy')}</p>
                         </div>
                    )}
                 </div>
              </CardContent>
        </Card>
      )}

    </div>
  );
};
