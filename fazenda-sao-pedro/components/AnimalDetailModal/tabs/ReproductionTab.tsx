import React from 'react';
import { EditableAnimalState, PregnancyRecord, PregnancyType } from '../../../types';
import { TrashIcon } from '../../common/Icons';
import { formatDate, dateToInputValue } from '../../../utils/dateHelpers';

interface ReproductionTabProps {
  editableAnimal: EditableAnimalState;
  isEditing: boolean;
  pregnancyForm: Omit<PregnancyRecord, 'id'>;
  setPregnancyForm: React.Dispatch<React.SetStateAction<Omit<PregnancyRecord, 'id'>>>;
  abortionDate: string;
  setAbortionDate: React.Dispatch<React.SetStateAction<string>>;
  onAddPregnancySubmit: (e: React.FormEvent) => void;
  onDeletePregnancyRecord: (recordId: string) => void;
  onAddAbortionSubmit: (e: React.FormEvent) => void;
  onDeleteAbortionRecord: (recordId: string) => void;
}

const ReproductionTab: React.FC<ReproductionTabProps> = ({
  editableAnimal,
  isEditing,
  pregnancyForm,
  setPregnancyForm,
  abortionDate,
  setAbortionDate,
  onAddPregnancySubmit,
  onDeletePregnancyRecord,
  onAddAbortionSubmit,
  onDeleteAbortionRecord,
}) => {
  return (
    <div className="mt-6">
      {/* Histórico de Prenhez */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Histórico Reprodutivo</h3>
        <div className="max-h-48 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
          {(editableAnimal.historicoPrenhez || []).length === 0 ? (
            <p className="text-gray-500 text-center">Nenhum registro.</p>
          ) : (
            [...(editableAnimal.historicoPrenhez || [])].reverse().map((record) => (
              <div
                key={record.id}
                className="grid grid-cols-1 md:grid-cols-7 gap-2 text-sm p-2 border-b border-base-700 items-center"
              >
                <span className="col-span-2">{formatDate(record.date)}</span>
                <span className="font-bold col-span-2">{record.type}</span>
                <span>{record.sireName}</span>
                <span>
                  {record.result === 'negative' && (
                    <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs font-semibold rounded-full">
                      Vazia
                    </span>
                  )}
                  {record.result === 'positive' && (
                    <span className="px-2 py-0.5 bg-emerald-600/20 text-emerald-400 text-xs font-semibold rounded-full">
                      Prenhe
                    </span>
                  )}
                  {record.result === 'pending' && (
                    <span className="px-2 py-0.5 bg-amber-600/20 text-amber-400 text-xs font-semibold rounded-full">
                      Aguardando DG
                    </span>
                  )}
                </span>
                <div className="flex gap-2">
                  {isEditing && (
                    <button
                      onClick={() => onDeletePregnancyRecord(record.id)}
                      className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400"
                      aria-label="Excluir registro de prenhez"
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
          <form
            onSubmit={onAddPregnancySubmit}
            className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4 bg-base-900 p-4 rounded-lg"
          >
            <h4 className="text-md font-semibold text-white col-span-full mb-2">Adicionar Novo Registro</h4>
            <div>
              <label className="text-xs text-gray-400">Data</label>
              <input
                type="date"
                name="date"
                value={dateToInputValue(pregnancyForm.date)}
                onChange={(e) =>
                  setPregnancyForm((p) => ({ ...p, date: new Date(e.target.value + 'T00:00:00') }))
                }
                className="w-full bg-base-700 p-2 rounded"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400">Tipo</label>
              <select
                name="type"
                value={pregnancyForm.type}
                onChange={(e) => setPregnancyForm((p) => ({ ...p, type: e.target.value as PregnancyType }))}
                className="w-full bg-base-700 p-2 rounded"
              >
                {Object.values(PregnancyType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Reprodutor</label>
              <input
                type="text"
                name="sireName"
                placeholder="Nome do Touro"
                value={pregnancyForm.sireName}
                onChange={(e) => setPregnancyForm((p) => ({ ...p, sireName: e.target.value }))}
                className="w-full bg-base-700 p-2 rounded"
                required
              />
            </div>
            <div className="self-end">
              <button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary-light text-white font-bold p-2 rounded"
              >
                Adicionar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Histórico de Abortos */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">Histórico de Abortos</h3>
        <div className="max-h-48 overflow-y-auto bg-base-900 p-2 rounded-lg mb-4">
          {(editableAnimal.historicoAborto || []).length === 0 ? (
            <p className="text-gray-500 text-center">Nenhum registro de aborto.</p>
          ) : (
            [...(editableAnimal.historicoAborto || [])].reverse().map((record) => (
              <div key={record.id} className="grid grid-cols-3 gap-2 text-sm p-2 border-b border-base-700 items-center">
                <span className="col-span-2">
                  Data do Ocorrido: <span className="font-bold">{formatDate(record.date)}</span>
                </span>
                {isEditing && (
                  <div className="text-right">
                    <button
                      onClick={() => onDeleteAbortionRecord(record.id)}
                      className="p-1 rounded text-gray-400 hover:bg-red-900/50 hover:text-red-400"
                      aria-label="Excluir registro de aborto"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        {isEditing && (
          <form
            onSubmit={onAddAbortionSubmit}
            className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-900 p-4 rounded-lg"
          >
            <h4 className="text-md font-semibold text-white col-span-full mb-2">Adicionar Registro de Aborto</h4>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400">Data do Ocorrido</label>
              <input
                type="date"
                value={abortionDate}
                onChange={(e) => setAbortionDate(e.target.value)}
                className="w-full bg-base-700 p-2 rounded"
                required
              />
            </div>
            <div className="self-end">
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded">
                Registrar Aborto
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default React.memo(ReproductionTab);
