import React from 'react';
import { Raca, Sexo, AnimalStatus, EditableAnimalState, AppUser } from '../../../types';
import ImageAnalyzerOptimized from '../../ImageAnalyzerOptimized';
import { dateToInputValue } from '../../../utils/dateHelpers';

interface GeneralTabProps {
  editableAnimal: EditableAnimalState;
  animal: { id: string };
  user: AppUser;
  storageReady: boolean;
  isEditing: boolean;
  onAnimalFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onUploadComplete: (newUrl: string, thumbnailUrl?: string) => void;
  setEditableAnimal: React.Dispatch<React.SetStateAction<EditableAnimalState | null>>;
}

const GeneralTab: React.FC<GeneralTabProps> = ({
  editableAnimal,
  animal,
  user,
  storageReady,
  isEditing,
  onAnimalFormChange,
  onUploadComplete,
  setEditableAnimal,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        {storageReady ? (
          <ImageAnalyzerOptimized
            imageUrl={editableAnimal.fotos[0]}
            onUploadComplete={onUploadComplete}
            animalId={animal.id}
            userId={user.uid}
          />
        ) : (
          <div className="rounded-lg border border-yellow-700 bg-yellow-900/30 p-4 text-sm text-yellow-200">
            <p className="font-semibold text-yellow-100">Upload temporariamente indisponível</p>
            <p>Ative o Firebase Storage e confirme a configuração em index.html para liberar uploads de fotos.</p>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <strong className="block text-gray-400">Brinco</strong>
            {isEditing ? (
              <input
                type="text"
                name="brinco"
                value={editableAnimal.brinco}
                onChange={onAnimalFormChange}
                className="bg-base-700 w-full p-1 rounded border border-base-600"
              />
            ) : (
              <span className="text-lg font-bold text-brand-primary-light">{editableAnimal.brinco}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">Nome</label>
            <input
              type="text"
              name="nome"
              value={editableAnimal.nome || ''}
              onChange={onAnimalFormChange}
              className="bg-base-700 w-full p-1 rounded border border-base-600"
              disabled={!isEditing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">Raça</label>
            <select
              name="raca"
              value={editableAnimal.raca}
              onChange={onAnimalFormChange}
              className="bg-base-700 w-full p-1 rounded border border-base-600"
              disabled={!isEditing}
            >
              {Object.values(Raca).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">Sexo</label>
            <select
              name="sexo"
              value={editableAnimal.sexo}
              onChange={onAnimalFormChange}
              className="bg-base-700 w-full p-1 rounded border border-base-600"
              disabled={!isEditing}
            >
              {Object.values(Sexo).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">
              Nascimento <span className="text-gray-500 text-xs">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                name="dataNascimento"
                value={editableAnimal.dataNascimento ? dateToInputValue(editableAnimal.dataNascimento) : ''}
                onChange={onAnimalFormChange}
                className="bg-base-700 flex-1 p-1 rounded border border-base-600"
                disabled={!isEditing}
              />
              {isEditing && editableAnimal.dataNascimento && (
                <button
                  type="button"
                  onClick={() => setEditableAnimal((prev) => (prev ? { ...prev, dataNascimento: undefined } : null))}
                  className="px-2 text-gray-400 hover:text-red-400"
                  title="Limpar data"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400">Peso (atual)</label>
            <input
              type="number"
              name="pesoKg"
              value={editableAnimal.pesoKg}
              onChange={onAnimalFormChange}
              className="bg-base-700 w-full p-1 rounded border border-base-600"
              disabled={!isEditing}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-400">Status</label>
            <select
              name="status"
              value={editableAnimal.status}
              onChange={onAnimalFormChange}
              className="bg-base-700 w-full p-1 rounded border border-base-600"
              disabled={!isEditing}
            >
              {Object.values(AnimalStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400">Brinco da Mãe</label>
              <input
                type="text"
                name="maeNome"
                value={editableAnimal.maeNome || ''}
                onChange={onAnimalFormChange}
                className="bg-base-700 w-full p-1 rounded border border-base-600"
                disabled={!isEditing}
                placeholder="Ex: 2024"
              />
              <p className="text-xs text-gray-500 mt-1">A raça será puxada automaticamente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400">Pai (Brinco ou Nome)</label>
              <input
                type="text"
                name="paiNome"
                value={editableAnimal.paiNome || ''}
                onChange={onAnimalFormChange}
                className="bg-base-700 w-full p-1 rounded border border-base-600"
                disabled={!isEditing}
                placeholder="Ex: Touro 001"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(GeneralTab);
