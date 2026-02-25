import React from 'react';
import { EditableAnimalState, Sexo, BiometricType } from '../../../types';
import { BiometricFormState } from '../../../types/forms';
import { TrashIcon } from '../../common/Icons';
import { formatDate, dateToInputValue } from '../../../utils/dateHelpers';

interface BiometryTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  biometricForm: BiometricFormState;
  setBiometricForm: React.Dispatch<React.SetStateAction<BiometricFormState>>;
  onAddBiometric: (e: React.FormEvent) => void;
  onDeleteBiometric: (recordId: string) => void;
  onBiometricDateChange: (recordId: string, newDateString: string) => void;
}

// ============================================
// CONFIGURAÇÃO DE LABELS E VALIDAÇÃO
// ============================================

const BIOMETRIC_LABELS: Record<BiometricType, { label: string; unit: string; min: number; max: number; placeholder: string }> = {
  ribeyeArea: {
    label: 'Área de Olho de Lombo (AOL)',
    unit: 'cm²',
    min: 20,
    max: 150,
    placeholder: 'Ex: 65.5',
  },
  fatThickness: {
    label: 'Espessura de Gordura Subcutânea (EGS)',
    unit: 'mm',
    min: 0.5,
    max: 30,
    placeholder: 'Ex: 5.2',
  },
  scrotalCircumference: {
    label: 'Perímetro Escrotal (PE)',
    unit: 'cm',
    min: 15,
    max: 50,
    placeholder: 'Ex: 36.0',
  },
};

const METHOD_LABELS: Record<string, string> = {
  ultrasound: 'Ultrassom',
  manual: 'Fita Métrica',
};

const BiometryTab: React.FC<BiometryTabProps> = ({
  editableAnimal,
  isEditing,
  biometricForm,
  setBiometricForm,
  onAddBiometric,
  onDeleteBiometric,
  onBiometricDateChange,
}) => {
  const isMale = editableAnimal.sexo === Sexo.Macho;
  const records = editableAnimal.historicoBiometria || [];

  // Filtra tipos disponíveis por sexo (PE só para machos)
  const availableTypes: BiometricType[] = isMale
    ? ['ribeyeArea', 'fatThickness', 'scrotalCircumference']
    : ['ribeyeArea', 'fatThickness'];

  // Validação do valor atual do form
  const currentConfig = BIOMETRIC_LABELS[biometricForm.type];
  const numericValue = parseFloat(biometricForm.value);
  const isValueValid = !isNaN(numericValue) && numericValue >= currentConfig.min && numericValue <= currentConfig.max;
  const hasValue = biometricForm.value.trim() !== '';

  return (
    <div className="mt-6">
      {/* Histórico de Medições */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Histórico de Biometria</h3>

        <div className="max-h-64 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
          {records.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhuma medição registrada.</p>
          ) : (
            [...records].reverse().map((record) => {
              const config = BIOMETRIC_LABELS[record.type];
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between text-sm p-3 border-b border-base-700 last:border-0"
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    {/* Data */}
                    <div>
                      {isEditing ? (
                        <input
                          type="date"
                          value={dateToInputValue(record.date)}
                          onChange={(e) => onBiometricDateChange(record.id, e.target.value)}
                          className="bg-base-700 p-1 rounded border border-base-600 text-white text-xs w-full"
                        />
                      ) : (
                        <span className="text-gray-300">{formatDate(record.date)}</span>
                      )}
                    </div>

                    {/* Tipo */}
                    <div>
                      <span className="text-white font-medium">{config?.label || record.type}</span>
                    </div>

                    {/* Valor */}
                    <div>
                      <span className="text-brand-primary-light font-bold text-lg">
                        {record.value.toFixed(1)}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">{config?.unit}</span>
                    </div>

                    {/* Método + notas */}
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded-full">
                        {METHOD_LABELS[record.method || 'manual']}
                      </span>
                      {record.notes && (
                        <span className="text-gray-500 text-xs truncate max-w-[100px]" title={record.notes}>
                          {record.notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botão deletar */}
                  {isEditing && (
                    <button
                      onClick={() => onDeleteBiometric(record.id)}
                      className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400 ml-2 flex-shrink-0"
                      aria-label="Excluir medição biométrica"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Formulário de nova medição */}
      {isEditing && (
        <form onSubmit={onAddBiometric} className="bg-base-800 p-4 rounded-lg space-y-4">
          <h4 className="text-sm font-semibold text-white">Nova Medição Biométrica</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo de medição */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tipo de Medição</label>
              <select
                value={biometricForm.type}
                onChange={(e) =>
                  setBiometricForm((prev) => ({
                    ...prev,
                    type: e.target.value as BiometricType,
                    // Ajusta método padrão: PE geralmente é medido com fita
                    method: e.target.value === 'scrotalCircumference' ? 'manual' : 'ultrasound',
                  }))
                }
                className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white text-sm w-full"
              >
                {availableTypes.map((type) => (
                  <option key={type} value={type}>
                    {BIOMETRIC_LABELS[type].label} ({BIOMETRIC_LABELS[type].unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Valor ({currentConfig.unit})
              </label>
              <input
                type="number"
                step="0.1"
                min={currentConfig.min}
                max={currentConfig.max}
                value={biometricForm.value}
                onChange={(e) =>
                  setBiometricForm((prev) => ({ ...prev, value: e.target.value }))
                }
                placeholder={currentConfig.placeholder}
                className={`bg-base-700 border rounded-lg px-3 py-2 text-white text-sm w-full ${
                  hasValue && !isValueValid
                    ? 'border-red-500'
                    : 'border-base-600'
                }`}
              />
              {hasValue && !isValueValid && (
                <p className="text-red-400 text-xs mt-1">
                  Faixa válida: {currentConfig.min} - {currentConfig.max} {currentConfig.unit}
                </p>
              )}
            </div>

            {/* Data */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Data da Medição</label>
              <input
                type="date"
                value={dateToInputValue(biometricForm.date)}
                onChange={(e) => {
                  const parsed = new Date(e.target.value + 'T00:00:00');
                  if (!isNaN(parsed.getTime())) {
                    setBiometricForm((prev) => ({ ...prev, date: parsed }));
                  }
                }}
                className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white text-sm w-full"
              />
            </div>

            {/* Método */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Método</label>
              <select
                value={biometricForm.method}
                onChange={(e) =>
                  setBiometricForm((prev) => ({
                    ...prev,
                    method: e.target.value as 'ultrasound' | 'manual',
                  }))
                }
                className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white text-sm w-full"
              >
                <option value="ultrasound">Ultrassom</option>
                <option value="manual">Fita Métrica / Manual</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Observações (opcional)</label>
            <input
              type="text"
              value={biometricForm.notes}
              onChange={(e) =>
                setBiometricForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Ex: Medição pré-abate, ultrassom entre 12-13ª costela"
              className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white text-sm w-full"
            />
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={!hasValue || !isValueValid}
            className="bg-brand-primary hover:bg-brand-primary-dark text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Adicionar Medição
          </button>
        </form>
      )}

      {/* Card informativo sobre Stayability */}
      <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-blue-400 text-xl">📊</span>
          <div>
            <p className="text-sm font-medium text-blue-300">Sobre o DEP de Permanência (Stayability)</p>
            <p className="text-xs text-blue-200/80 mt-1">
              O DEP de Permanência é calculado <strong>automaticamente</strong> com base na idade e status
              das matrizes do rebanho. Vacas com 6+ anos que permanecem ativas contribuem positivamente.
              Não é necessário inserir dados manualmente para este trait.
            </p>
          </div>
        </div>
      </div>

      {/* Legenda de referência */}
      <div className="mt-4 bg-base-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Referência de Valores</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-400">
          <div>
            <p className="font-semibold text-white mb-1">AOL (Olho de Lombo)</p>
            <p>Raças britânicas: 55-85 cm²</p>
            <p>Medido por ultrassom entre 12ª-13ª costela</p>
          </div>
          <div>
            <p className="font-semibold text-white mb-1">EGS (Gordura Subcutânea)</p>
            <p>Ideal acabamento: 3-6 mm</p>
            <p>Medido por ultrassom na garupa (P8)</p>
          </div>
          {isMale && (
            <div>
              <p className="font-semibold text-white mb-1">PE (Perímetro Escrotal)</p>
              <p>Touros jovens (18m): 30-38 cm</p>
              <p>Touros adultos: 34-42 cm</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BiometryTab;
