import React from 'react';
import { EditableAnimalState, MedicationFormState } from '../../../types';
import { TrashIcon } from '../../common/Icons';
import AudioToAction from '../../AudioToAction';
import { formatDate, dateToInputValue } from '../../../utils/dateHelpers';

interface HealthTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  medicationForm: MedicationFormState;
  onMedicationFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onAddMedicationSubmit: (e: React.FormEvent) => void;
  onDeleteMedication: (medId: string) => void;
  onMedicationDateChange: (medId: string, newDateString: string) => void;
  onDataExtracted: (data: any) => void;
}

const HealthTab: React.FC<HealthTabProps> = ({
  editableAnimal,
  isEditing,
  medicationForm,
  onMedicationFormChange,
  onAddMedicationSubmit,
  onDeleteMedication,
  onMedicationDateChange,
  onDataExtracted,
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Histórico Sanitário</h3>
      <div className="max-h-48 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
        {editableAnimal.historicoSanitario.length === 0 ? (
          <p className="text-gray-500 text-center">Nenhum registro.</p>
        ) : (
          [...editableAnimal.historicoSanitario].reverse().map((med) => (
            <div
              key={med.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-x-4 gap-y-1 text-sm p-2 border-b border-base-700"
            >
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                {isEditing ? (
                  <input
                    type="date"
                    value={dateToInputValue(new Date(med.dataAplicacao))}
                    onChange={(e) => onMedicationDateChange(med.id, e.target.value)}
                    className="bg-base-700 p-1 rounded border border-base-600 w-full sm:w-32"
                  />
                ) : (
                  <span className="w-24">{formatDate(med.dataAplicacao)}</span>
                )}
                <span className="font-bold">{med.medicamento}</span>
                <span className="text-gray-300">
                  {med.dose} {med.unidade}
                </span>
              </div>
              <div className="flex-1 text-left md:text-right text-gray-400 italic">{med.motivo}</div>
              <div className="text-right">
                {isEditing && (
                  <button
                    onClick={() => onDeleteMedication(med.id)}
                    className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400"
                    aria-label="Excluir registro sanitário"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {isEditing && (
        <>
          <AudioToAction onDataExtracted={onDataExtracted} />
          <form onSubmit={onAddMedicationSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="medicamento"
              placeholder="Medicamento"
              value={medicationForm.medicamento}
              onChange={onMedicationFormChange}
              className="bg-base-700 p-2 rounded"
              required
            />
            <input
              type="number"
              name="dose"
              placeholder="Dose"
              value={medicationForm.dose}
              onChange={onMedicationFormChange}
              className="bg-base-700 p-2 rounded"
              required
            />
            <select
              name="unidade"
              value={medicationForm.unidade}
              onChange={onMedicationFormChange}
              className="bg-base-700 p-2 rounded"
            >
              <option value="ml">ml</option>
              <option value="mg">mg</option>
              <option value="dose">dose</option>
            </select>
            <input
              type="text"
              name="motivo"
              placeholder="Motivo"
              value={medicationForm.motivo}
              onChange={onMedicationFormChange}
              className="bg-base-700 p-2 rounded col-span-1 md:col-span-2"
              required
            />
            <button
              type="submit"
              className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded"
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
