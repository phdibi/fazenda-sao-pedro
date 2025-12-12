import React from 'react';
import { EditableAnimalState, WeighingType } from '../../../types';
import { TrashIcon } from '../../common/Icons';
import { formatDate, dateToInputValue } from '../../../utils/dateHelpers';

interface WeightTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  newWeightData: { weight: string; type: WeighingType };
  setNewWeightData: React.Dispatch<React.SetStateAction<{ weight: string; type: WeighingType }>>;
  onAddWeight: (e: React.FormEvent) => void;
  onDeleteWeight: (weightId: string) => void;
  onWeightDateChange: (weightId: string, newDateString: string) => void;
}

const WeightTab: React.FC<WeightTabProps> = ({
  editableAnimal,
  isEditing,
  newWeightData,
  setNewWeightData,
  onAddWeight,
  onDeleteWeight,
  onWeightDateChange,
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-white mb-4">Histórico de Pesagens</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="max-h-60 overflow-y-auto bg-base-900 p-2 rounded-lg">
          {editableAnimal.historicoPesagens.length === 0 ? (
            <p className="text-gray-500 text-center">Nenhum registro.</p>
          ) : (
            [...editableAnimal.historicoPesagens].reverse().map((entry) => (
              <div key={entry.id} className="flex justify-between items-center p-2 border-b border-base-700">
                <div className="flex-1 flex items-center gap-2">
                  {isEditing ? (
                    <input
                      type="date"
                      value={dateToInputValue(new Date(entry.date))}
                      onChange={(e) => onWeightDateChange(entry.id, e.target.value)}
                      className="bg-base-700 p-1 rounded border border-base-600 w-32"
                    />
                  ) : (
                    <span>{formatDate(entry.date)}</span>
                  )}
                  {entry.type && entry.type !== WeighingType.None && (
                    <span className="ml-2 text-xs bg-brand-accent-dark text-white/90 px-2 py-0.5 rounded-full">
                      {entry.type}
                    </span>
                  )}
                </div>
                <span className="font-bold w-20 text-right">{entry.weightKg} kg</span>
                <div className="w-10 text-right">
                  {isEditing && (
                    <button
                      onClick={() => onDeleteWeight(entry.id)}
                      className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400"
                      aria-label="Excluir pesagem"
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
          <form onSubmit={onAddWeight} className="bg-base-900 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Adicionar Nova Pesagem</h4>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-400">Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newWeightData.weight}
                  onChange={(e) => setNewWeightData((p) => ({ ...p, weight: e.target.value }))}
                  className="w-full bg-base-700 p-2 rounded"
                  placeholder="Novo peso em kg"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-400">Tipo de Pesagem</label>
                <select
                  value={newWeightData.type}
                  onChange={(e) => setNewWeightData((p) => ({ ...p, type: e.target.value as WeighingType }))}
                  className="w-full bg-base-700 p-2 rounded"
                >
                  {Object.values(WeighingType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="mt-3 w-full bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded"
            >
              Registrar Pesagem
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default React.memo(WeightTab);
