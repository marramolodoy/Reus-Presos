import React, { useState, useEffect } from 'react';
import { Defendant, DefendantFormData } from '../types';
import { X, Save } from 'lucide-react';

interface Props {
  initialData?: Defendant;
  defendants?: Defendant[]; // Lista de réus para linkagem
  onSubmit: (data: DefendantFormData) => void;
  onCancel: () => void;
}

const emptyForm: DefendantFormData = {
  name: '',
  caseNumber: '',
  penalType: '',
  prisonType: 'Preventiva',
  arrestDate: new Date().toISOString().split('T')[0],
  lastReviewDate: new Date().toISOString().split('T')[0],
  movementType: 'Aguardando Sentença',
  lastMovementDate: new Date().toISOString().split('T')[0],
  deadline: 30,
  obs: '',
  rji: '',
  bnmp: '',
  infopen: '',
  prison: 'Cadeia Pública de Goianésia',
  hasHearing: false,
  hearingDate: '',
  linkedDefendantIds: []
};

export const DefendantForm: React.FC<Props> = ({ initialData, defendants = [], onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<DefendantFormData>(emptyForm);

  useEffect(() => {
    if (initialData) {
      const { id, ...rest } = initialData;
      setFormData(rest);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }

    if (e.target instanceof HTMLSelectElement && (e.target as HTMLSelectElement).multiple) {
      const options = Array.from((e.target as HTMLSelectElement).selectedOptions, option => option.value);
      setFormData(prev => ({ ...prev, [name]: options }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: name === 'deadline' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Editar Réu' : 'Cadastrar Novo Réu'}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Dados Pessoais e Processuais */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b border-gray-100 mb-2">
              <h3 className="text-sm font-semibold text-justice-700 uppercase tracking-wider mb-4">Dados Principais</h3>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Réu *</label>
              <input required name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" placeholder="Nome completo" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Processo nº *</label>
              <input required name="caseNumber" value={formData.caseNumber} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" placeholder="0000000-00.0000.0.00.0000" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Penal</label>
              <input name="penalType" value={formData.penalType} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" placeholder="Ex: Art. 121, Art. 157" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Prisão</label>
              <select name="prisonType" value={formData.prisonType} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none bg-white">
                <option value="Preventiva">Preventiva</option>
                <option value="Temporária">Temporária</option>
                <option value="Domiciliar">Domiciliar</option>
                <option value="Provisória">Provisória (Execução)</option>
                <option value="Definitiva">Definitiva</option>
                <option value="Cível">Cível</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Presídio</label>
              <input name="prison" value={formData.prison} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            {/* Datas Críticas */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b border-gray-100 mb-2 mt-4 ml-0">
              <h3 className="text-sm font-semibold text-justice-700 uppercase tracking-wider mb-4">Controle de Prazos</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Última Prisão</label>
              <input type="date" name="arrestDate" value={formData.arrestDate} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Última Revisão (90 dias)</label>
              <input type="date" name="lastReviewDate" value={formData.lastReviewDate} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <p className="text-xs text-gray-500">O sistema calculará automaticamente os dias preso e dias da última revisão.</p>
            </div>

            {/* Movimentação */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b border-gray-100 mb-2 mt-4 ml-0">
              <h3 className="text-sm font-semibold text-justice-700 uppercase tracking-wider mb-4">Situação Processual</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
              <input
                name="movementType"
                value={formData.movementType}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none"
                placeholder="Ex: Aguardando Sentença, Concluso, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Últ. Movimentação</label>
              <input type="date" name="lastMovementDate" value={formData.lastMovementDate} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo para Próx. Ato (Dias)</label>
              <input type="number" name="deadline" value={formData.deadline} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            {/* Audiências e Vínculos */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b border-gray-100 mb-2 mt-4 ml-0">
              <h3 className="text-sm font-semibold text-justice-700 uppercase tracking-wider mb-4">Audiências e Vínculos</h3>
            </div>

            <div className="col-span-1 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <input
                  type="checkbox"
                  name="hasHearing"
                  checked={formData.hasHearing || false}
                  onChange={handleChange}
                  className="w-4 h-4 text-justice-600 rounded border-gray-300 focus:ring-justice-500"
                />
                Tem audiência designada?
              </label>

              {formData.hasHearing && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">Data e Hora da Audiência</label>
                  <input
                    type="datetime-local"
                    name="hearingDate"
                    value={formData.hearingDate ? new Date(formData.hearingDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      // Ajuste manual para timestamp com timezone se necessário, ou apenas string ISO
                      setFormData(prev => ({ ...prev, hearingDate: e.target.value ? new Date(e.target.value).toISOString() : '' }))
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linkar com outro(s) Preso(s)</label>
              <select
                multiple
                name="linkedDefendantIds"
                value={formData.linkedDefendantIds || []}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none h-32 bg-white"
              >
                {defendants
                  .filter(d => d.id !== initialData?.id) // Não mostrar a si mesmo
                  .map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">Segure Ctrl para selecionar múltiplos</p>
            </div>

            {/* Identificadores e OBS */}
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pb-2 border-b border-gray-100 mb-2 mt-4 ml-0">
              <h3 className="text-sm font-semibold text-justice-700 uppercase tracking-wider mb-4">Identificação e Observações</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RJI</label>
              <input name="rji" value={formData.rji} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BNMP</label>
              <input name="bnmp" value={formData.bnmp} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">INFOPEN</label>
              <input name="infopen" value={formData.infopen} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações (OBS)</label>
              <textarea name="obs" value={formData.obs} onChange={handleChange} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-justice-500 outline-none" />
            </div>

          </div>
        </form>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 font-medium">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-justice-700 text-white rounded hover:bg-justice-900 flex items-center gap-2 font-medium shadow-sm">
            <Save size={18} />
            Salvar Registro
          </button>
        </div>
      </div>
    </div>
  );
};