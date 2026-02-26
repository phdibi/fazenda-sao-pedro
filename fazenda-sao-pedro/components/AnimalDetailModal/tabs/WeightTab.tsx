import React, { useMemo } from 'react';
import { EditableAnimalState, WeighingType } from '../../../types';
import { TrashIcon } from '../../common/Icons';
import { formatDate, dateToInputValue } from '../../../utils/dateHelpers';
import { calcularGMDDePesagens, classificarGMD } from '../../../utils/gmdCalculations';

interface WeightTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  newWeightData: { weight: string; type: WeighingType };
  setNewWeightData: React.Dispatch<React.SetStateAction<{ weight: string; type: WeighingType }>>;
  onAddWeight: (e: React.FormEvent) => void;
  onDeleteWeight: (weightId: string) => void;
  onWeightDateChange: (weightId: string, newDateString: string) => void;
  onAutoClassifyWeights: () => void;
}

const WeightTab: React.FC<WeightTabProps> = ({
  editableAnimal,
  isEditing,
  newWeightData,
  setNewWeightData,
  onAddWeight,
  onDeleteWeight,
  onWeightDateChange,
  onAutoClassifyWeights,
}) => {
  const hasDateNascimento = !!editableAnimal.dataNascimento;
  const hasWeights = editableAnimal.historicoPesagens.length > 0;

  const gmdMetrics = useMemo(
    () => calcularGMDDePesagens(editableAnimal.historicoPesagens),
    [editableAnimal.historicoPesagens]
  );

  const hasGMDData = (gmdMetrics.diasAcompanhamento ?? 0) > 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Histórico de Pesagens</h3>
        {isEditing && (
          <button
            onClick={onAutoClassifyWeights}
            disabled={!hasDateNascimento || !hasWeights}
            className="text-xs bg-brand-accent-dark hover:bg-brand-accent text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={!hasDateNascimento ? 'Animal sem data de nascimento' : !hasWeights ? 'Nenhum peso registrado' : 'Classifica automaticamente os pesos como Desmame (~7m) e Sobreano (~18m)'}
          >
            Auto-classificar Desmame/Sobreano
          </button>
        )}
      </div>
      {hasGMDData && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* GMD Total */}
          {gmdMetrics.gmdTotal !== undefined && (
            <div className="bg-base-900 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">GMD Total</p>
              <p className={`text-lg font-bold ${classificarGMD(gmdMetrics.gmdTotal).color}`}>
                {gmdMetrics.gmdTotal.toFixed(3)} kg/d
              </p>
              <p className={`text-xs ${classificarGMD(gmdMetrics.gmdTotal).color}`}>
                {classificarGMD(gmdMetrics.gmdTotal).label}
              </p>
            </div>
          )}

          {/* GMD Último Período */}
          {gmdMetrics.gmdUltimoPeriodo !== undefined && (
            <div className="bg-base-900 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">GMD Último Período</p>
              <p className={`text-lg font-bold ${classificarGMD(gmdMetrics.gmdUltimoPeriodo).color}`}>
                {gmdMetrics.gmdUltimoPeriodo.toFixed(3)} kg/d
              </p>
              <p className={`text-xs ${classificarGMD(gmdMetrics.gmdUltimoPeriodo).color}`}>
                {classificarGMD(gmdMetrics.gmdUltimoPeriodo).label}
              </p>
            </div>
          )}

          {/* Dias desde última pesagem */}
          {gmdMetrics.diasDesdeUltimaPesagem !== undefined && (
            <div className="bg-base-900 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Última Pesagem</p>
              <p className="text-lg font-bold text-white">
                {gmdMetrics.diasDesdeUltimaPesagem}d atrás
              </p>
              {gmdMetrics.dataUltimaPesagem && (
                <p className="text-xs text-gray-400">
                  {formatDate(gmdMetrics.dataUltimaPesagem)}
                </p>
              )}
            </div>
          )}

          {/* Peso Estimado Hoje */}
          {gmdMetrics.pesoEstimadoHoje !== undefined && gmdMetrics.diasDesdeUltimaPesagem !== undefined && gmdMetrics.diasDesdeUltimaPesagem > 0 && (
            <div className="bg-base-900 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Peso Estimado Hoje</p>
              <p className="text-lg font-bold text-brand-accent">
                {gmdMetrics.pesoEstimadoHoje.toFixed(1)} kg
              </p>
              <p className="text-xs text-gray-400">
                baseado no últ. período
              </p>
            </div>
          )}
        </div>
      )}

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
                      value={dateToInputValue(entry.date)}
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
