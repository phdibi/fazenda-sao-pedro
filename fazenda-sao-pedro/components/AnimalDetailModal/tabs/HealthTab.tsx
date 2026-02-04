import React from 'react';
import { EditableAnimalState, MedicationFormState, MedicationItemFormState } from '../../../types';
import { TrashIcon, PlusIcon } from '../../common/Icons';
import AudioToAction from '../../AudioToAction';
import { formatDate, dateToInputValue } from '../../../utils/dateHelpers';

interface HealthTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  medicationForm: MedicationFormState;
  onMedicationFormChange: (field: keyof MedicationFormState, value: any) => void;
  onMedicationItemChange: (itemId: string, field: keyof MedicationItemFormState, value: any) => void;
  onAddMedicationItem: () => void;
  onRemoveMedicationItem: (itemId: string) => void;
  onAddMedicationSubmit: (e: React.FormEvent) => void;
  onDeleteMedication: (medId: string) => void;
  onMedicationDateChange: (medId: string, newDateString: string) => void;
  onDataExtracted: (data: any) => void;
}

/**
 * Formata a lista de medicamentos para exibição
 */
const formatMedications = (med: any): string => {
  // Se tem medicamentos[] (novo formato)
  if (med.medicamentos && Array.isArray(med.medicamentos) && med.medicamentos.length > 0) {
    return med.medicamentos
      .map((m: any) => `${m.medicamento} (${m.dose} ${m.unidade})`)
      .join(', ');
  }
  // Fallback para formato legado
  if (med.medicamento) {
    return `${med.medicamento} (${med.dose || 0} ${med.unidade || 'ml'})`;
  }
  return 'Medicamento não informado';
};

const HealthTab: React.FC<HealthTabProps> = ({
  editableAnimal,
  isEditing,
  medicationForm,
  onMedicationFormChange,
  onMedicationItemChange,
  onAddMedicationItem,
  onRemoveMedicationItem,
  onAddMedicationSubmit,
  onDeleteMedication,
  onMedicationDateChange,
  onDataExtracted,
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Historico Sanitario</h3>

      {/* Lista de registros existentes */}
      <div className="max-h-64 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
        {editableAnimal.historicoSanitario.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Nenhum registro.</p>
        ) : (
          [...editableAnimal.historicoSanitario].reverse().map((med) => (
            <div
              key={med.id}
              className="flex flex-col gap-2 text-sm p-3 border-b border-base-700 last:border-b-0"
            >
              {/* Linha superior: Data e Motivo */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <input
                      type="date"
                      value={dateToInputValue(new Date(med.dataAplicacao))}
                      onChange={(e) => onMedicationDateChange(med.id, e.target.value)}
                      className="bg-base-700 p-1 rounded border border-base-600 text-sm w-32"
                    />
                  ) : (
                    <span className="text-gray-400 font-medium">
                      {formatDate(med.dataAplicacao)}
                    </span>
                  )}
                  <span className="text-brand-primary-light font-semibold">
                    {med.motivo}
                  </span>
                </div>
                {isEditing && (
                  <button
                    onClick={() => onDeleteMedication(med.id)}
                    className="p-1.5 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400 transition-colors"
                    aria-label="Excluir registro sanitario"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Linha inferior: Medicamentos */}
              <div className="text-white pl-2 border-l-2 border-base-600">
                {formatMedications(med)}
              </div>

              {/* Responsavel */}
              {med.responsavel && (
                <div className="text-xs text-gray-500 italic">
                  Responsavel: {med.responsavel}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Formulario de adicao (modo edicao) */}
      {isEditing && (
        <>
          <AudioToAction onDataExtracted={onDataExtracted} />

          <form onSubmit={onAddMedicationSubmit} className="mt-4 space-y-4">
            {/* Cabecalho: Motivo e Responsavel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Motivo do tratamento *</label>
                <input
                  type="text"
                  placeholder="Ex: Vermifugacao, Vacinacao..."
                  value={medicationForm.motivo}
                  onChange={(e) => onMedicationFormChange('motivo', e.target.value)}
                  className="w-full bg-base-700 p-2 rounded text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Responsavel</label>
                <input
                  type="text"
                  placeholder="Nome do responsavel"
                  value={medicationForm.responsavel}
                  onChange={(e) => onMedicationFormChange('responsavel', e.target.value)}
                  className="w-full bg-base-700 p-2 rounded text-sm"
                />
              </div>
            </div>

            {/* Lista de medicamentos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-300 font-medium">
                  Medicamentos ({medicationForm.medicamentos.length})
                </label>
                <button
                  type="button"
                  onClick={onAddMedicationItem}
                  className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary-light transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Adicionar medicamento
                </button>
              </div>

              {medicationForm.medicamentos.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-base-800 rounded-lg p-3 border border-base-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      Medicamento {index + 1}
                    </span>
                    {medicationForm.medicamentos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveMedicationItem(item.id)}
                        className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                        aria-label="Remover medicamento"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nome do medicamento *"
                      value={item.medicamento}
                      onChange={(e) => onMedicationItemChange(item.id, 'medicamento', e.target.value)}
                      className="bg-base-700 p-2 rounded text-sm col-span-1 sm:col-span-1"
                      required={index === 0}
                    />
                    <input
                      type="number"
                      placeholder="Dose"
                      value={item.dose}
                      onChange={(e) => onMedicationItemChange(item.id, 'dose', e.target.value)}
                      className="bg-base-700 p-2 rounded text-sm"
                      step="0.1"
                      min="0"
                    />
                    <select
                      value={item.unidade}
                      onChange={(e) => onMedicationItemChange(item.id, 'unidade', e.target.value)}
                      className="bg-base-700 p-2 rounded text-sm"
                    >
                      <option value="ml">ml</option>
                      <option value="mg">mg</option>
                      <option value="dose">dose</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Botao de submit */}
            <button
              type="submit"
              disabled={!medicationForm.motivo || medicationForm.medicamentos.every(m => !m.medicamento)}
              className="w-full bg-brand-primary hover:bg-brand-primary-light disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold p-3 rounded transition-colors"
            >
              Adicionar Registro
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default React.memo(HealthTab);
