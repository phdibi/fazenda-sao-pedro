import React from 'react';
import { EditableAnimalState, OffspringFormState } from '../../../types';
import { TrashIcon } from '../../common/Icons';

interface ProgenyTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  offspringForm: OffspringFormState;
  setOffspringForm: React.Dispatch<React.SetStateAction<OffspringFormState>>;
  onAddOrUpdateOffspringSubmit: (e: React.FormEvent) => void;
  onDeleteOffspringRecord: (recordId: string) => void;
}

const ProgenyTab: React.FC<ProgenyTabProps> = ({
  editableAnimal,
  isEditing,
  offspringForm,
  setOffspringForm,
  onAddOrUpdateOffspringSubmit,
  onDeleteOffspringRecord,
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Histórico de Performance da Progênie</h3>
      <div className="bg-base-900 p-2 rounded-lg mb-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-base-700">
          <thead className="bg-base-800/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Brinco do Filho</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Nascimento (kg)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Desmame (kg)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Sobreano (kg)</th>
              {isEditing && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-700">
            {(editableAnimal.historicoProgenie || []).map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-2 text-sm text-white">{record.offspringBrinco}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.birthWeightKg || '–'}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.weaningWeightKg || '–'}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.yearlingWeightKg || '–'}</td>
                {isEditing && (
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onDeleteOffspringRecord(record.id)}
                      className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400"
                      aria-label="Excluir registro de progênie"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {(editableAnimal.historicoProgenie || []).length === 0 && (
              <tr>
                <td colSpan={isEditing ? 5 : 4} className="text-center text-gray-500 py-4">
                  Nenhum registro de progênie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isEditing && (
        <form
          onSubmit={onAddOrUpdateOffspringSubmit}
          className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 bg-base-900 p-4 rounded-lg"
        >
          <h4 className="text-md font-semibold text-white col-span-full mb-2">Adicionar Registro de Progênie</h4>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400">Brinco do Filho</label>
            <input
              type="text"
              name="offspringBrinco"
              placeholder="Brinco"
              value={offspringForm.offspringBrinco}
              onChange={(e) => setOffspringForm((p) => ({ ...p, offspringBrinco: e.target.value }))}
              className="w-full bg-base-700 p-2 rounded"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Peso Nasc. (kg)</label>
            <input
              type="number"
              step="0.1"
              name="birthWeightKg"
              placeholder="kg"
              value={offspringForm.birthWeightKg}
              onChange={(e) => setOffspringForm((p) => ({ ...p, birthWeightKg: e.target.value }))}
              className="w-full bg-base-700 p-2 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Peso Desm. (kg)</label>
            <input
              type="number"
              step="0.1"
              name="weaningWeightKg"
              placeholder="kg"
              value={offspringForm.weaningWeightKg}
              onChange={(e) => setOffspringForm((p) => ({ ...p, weaningWeightKg: e.target.value }))}
              className="w-full bg-base-700 p-2 rounded"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Peso Sobreano (kg)</label>
            <input
              type="number"
              step="0.1"
              name="yearlingWeightKg"
              placeholder="kg"
              value={offspringForm.yearlingWeightKg}
              onChange={(e) => setOffspringForm((p) => ({ ...p, yearlingWeightKg: e.target.value }))}
              className="w-full bg-base-700 p-2 rounded"
            />
          </div>
          <div className="col-span-full flex justify-end gap-2 mt-2">
            <button
              type="submit"
              className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 px-4 rounded"
            >
              Salvar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default React.memo(ProgenyTab);
