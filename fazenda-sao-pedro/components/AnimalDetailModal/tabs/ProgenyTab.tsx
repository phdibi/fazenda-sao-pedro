import React, { useMemo } from 'react';
import { Animal, EditableAnimalState, OffspringFormState } from '../../../types';
import { TrashIcon, SparklesIcon } from '../../common/Icons';
import { getUnifiedProgeny, calculateProgenyStats, UnifiedProgenyRecord } from '../../../utils/progenyUtils';

interface ProgenyTabProps {
  editableAnimal: EditableAnimalState;
  animal: Animal; // Animal original para busca
  allAnimals: Animal[]; // Todos os animais para busca reversa
  isEditing: boolean;
  offspringForm: OffspringFormState;
  setOffspringForm: React.Dispatch<React.SetStateAction<OffspringFormState>>;
  onAddOrUpdateOffspringSubmit: (e: React.FormEvent) => void;
  onDeleteOffspringRecord: (recordId: string) => void;
}

const ProgenyTab: React.FC<ProgenyTabProps> = ({
  editableAnimal,
  animal,
  allAnimals,
  isEditing,
  offspringForm,
  setOffspringForm,
  onAddOrUpdateOffspringSubmit,
  onDeleteOffspringRecord,
}) => {
  // Usa progênie unificada (manual + busca reversa)
  const unifiedProgeny = useMemo(() => {
    return getUnifiedProgeny(animal, allAnimals);
  }, [animal, allAnimals]);

  // Estatísticas de progênie
  const stats = useMemo(() => {
    return calculateProgenyStats(unifiedProgeny);
  }, [unifiedProgeny]);

  // Verifica se um registro é manual (pode ser deletado)
  const isManualRecord = (record: UnifiedProgenyRecord) => {
    return record.source === 'manual' && !record.id.startsWith('auto-');
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Cabeçalho com estatísticas */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Performance da Progênie</h3>
          <p className="text-sm text-gray-400">
            {stats.total} {stats.total === 1 ? 'filho registrado' : 'filhos registrados'}
          </p>
        </div>

        {/* Resumo de pesos */}
        {stats.total > 0 && (
          <div className="flex gap-4 text-sm">
            {stats.countWithBirth > 0 && (
              <div className="bg-base-700 px-3 py-2 rounded-lg">
                <span className="text-gray-400">Nasc:</span>{' '}
                <span className="text-white font-semibold">{stats.avgBirthWeight.toFixed(1)} kg</span>
                <span className="text-gray-500 text-xs ml-1">({stats.countWithBirth})</span>
              </div>
            )}
            {stats.countWithWeaning > 0 && (
              <div className="bg-base-700 px-3 py-2 rounded-lg">
                <span className="text-gray-400">Desm:</span>{' '}
                <span className="text-white font-semibold">{stats.avgWeaningWeight.toFixed(1)} kg</span>
                <span className="text-gray-500 text-xs ml-1">({stats.countWithWeaning})</span>
              </div>
            )}
            {stats.countWithYearling > 0 && (
              <div className="bg-base-700 px-3 py-2 rounded-lg">
                <span className="text-gray-400">Sobr:</span>{' '}
                <span className="text-white font-semibold">{stats.avgYearlingWeight.toFixed(1)} kg</span>
                <span className="text-gray-500 text-xs ml-1">({stats.countWithYearling})</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabela de progênie */}
      <div className="bg-base-900 p-2 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-base-700">
          <thead className="bg-base-800/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Brinco</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Nome</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Nasc. (kg)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Desm. (kg)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Peso Sobr. (kg)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Origem</th>
              {isEditing && (
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">Ações</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-700">
            {unifiedProgeny.map((record) => (
              <tr key={record.id} className={record.animalId ? 'hover:bg-base-800/50' : ''}>
                <td className="px-4 py-2 text-sm text-white font-medium">{record.brinco}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.nome || '–'}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.birthWeightKg?.toFixed(1) || '–'}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.weaningWeightKg?.toFixed(1) || '–'}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{record.yearlingWeightKg?.toFixed(1) || '–'}</td>
                <td className="px-4 py-2 text-xs">
                  {record.source === 'manual' ? (
                    <span className="text-amber-400">Manual</span>
                  ) : record.source === 'maeId' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" />
                      Automático
                    </span>
                  ) : (
                    <span className="text-blue-400 flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" />
                      Automático
                    </span>
                  )}
                </td>
                {isEditing && (
                  <td className="px-4 py-2">
                    {isManualRecord(record) ? (
                      <button
                        onClick={() => onDeleteOffspringRecord(record.id)}
                        className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400"
                        aria-label="Excluir registro de progênie"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-gray-600 text-xs italic">Vinculado</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {unifiedProgeny.length === 0 && (
              <tr>
                <td colSpan={isEditing ? 7 : 6} className="text-center text-gray-500 py-8">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">🐄</span>
                    <p>Nenhum filho registrado.</p>
                    <p className="text-xs text-gray-600">
                      Os filhos aparecem automaticamente quando você define esta matriz como mãe de outros animais.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Explicação sobre dados automáticos */}
      {unifiedProgeny.some((r) => r.source !== 'manual') && (
        <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-3 text-sm">
          <p className="text-emerald-300 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4" />
            <strong>Dados automáticos:</strong>
          </p>
          <p className="text-gray-400 mt-1">
            Os registros marcados como "Automático" são obtidos diretamente dos animais cadastrados.
            Os pesos são atualizados automaticamente quando você edita os animais filhos.
          </p>
        </div>
      )}

      {/* Formulário para adicionar registro manual */}
      {isEditing && (
        <form
          onSubmit={onAddOrUpdateOffspringSubmit}
          className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 bg-base-900 p-4 rounded-lg"
        >
          <h4 className="text-md font-semibold text-white col-span-full mb-2">
            Adicionar Registro Manual
          </h4>
          <p className="text-xs text-gray-500 col-span-full -mt-2 mb-2">
            Use apenas quando o filho não estiver cadastrado no sistema.
            Se o animal já existe, basta definir esta matriz como mãe dele.
          </p>
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
