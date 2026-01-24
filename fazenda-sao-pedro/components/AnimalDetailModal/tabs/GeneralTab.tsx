import React, { useMemo } from 'react';
import { Raca, Sexo, AnimalStatus, EditableAnimalState, AppUser, Animal } from '../../../types';
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
  animals?: Animal[]; // Lista de animais para verificar se mãe existe
  // Props para deleção de foto
  onDeletePhoto?: () => Promise<{ success: boolean; error?: string; freedSpace?: number }>;
  isDeletingPhoto?: boolean;
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
  animals = [],
  onDeletePhoto,
  isDeletingPhoto = false,
}) => {
  // Verifica se a mãe existe no rebanho atual
  const motherExists = useMemo(() => {
    if (!editableAnimal.maeNome) return null; // Não digitou nada
    const motherBrinco = editableAnimal.maeNome.toLowerCase().trim();
    return animals.some(
      (a) => a.brinco.toLowerCase().trim() === motherBrinco && a.sexo === Sexo.Femea
    );
  }, [editableAnimal.maeNome, animals]);

  // Verifica se a doadora (mãe biológica) existe no rebanho
  const donorExists = useMemo(() => {
    if (!editableAnimal.maeBiologicaNome) return { found: null as boolean | null, raca: undefined as string | undefined };
    const donorBrinco = editableAnimal.maeBiologicaNome.toLowerCase().trim();
    const donor = animals.find(
      (a) => a.brinco.toLowerCase().trim() === donorBrinco && a.sexo === Sexo.Femea
    );
    if (donor) {
      return { found: true, raca: donor.raca };
    }
    return { found: false, raca: undefined };
  }, [editableAnimal.maeBiologicaNome, animals]);

  // Verifica se a receptora existe no rebanho
  const recipientExists = useMemo(() => {
    if (!editableAnimal.maeReceptoraNome) return null;
    const recipientBrinco = editableAnimal.maeReceptoraNome.toLowerCase().trim();
    return animals.some(
      (a) => a.brinco.toLowerCase().trim() === recipientBrinco && a.sexo === Sexo.Femea
    );
  }, [editableAnimal.maeReceptoraNome, animals]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        {storageReady ? (
          <ImageAnalyzerOptimized
            imageUrl={editableAnimal.fotos[0]}
            onUploadComplete={onUploadComplete}
            animalId={animal.id}
            userId={user.uid}
            onDeletePhoto={onDeletePhoto}
            isDeletingPhoto={isDeletingPhoto}
            isEditing={isEditing}
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

          {/* Seção de Filiação */}
          <div className="sm:col-span-2 space-y-4">
            {/* Checkbox FIV */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isFIV"
                checked={editableAnimal.isFIV || false}
                onChange={(e) => {
                  setEditableAnimal((prev) => prev ? {
                    ...prev,
                    isFIV: e.target.checked,
                    // Se desmarcar FIV, limpa os campos específicos
                    maeBiologicaNome: e.target.checked ? prev.maeBiologicaNome : undefined,
                    maeReceptoraNome: e.target.checked ? prev.maeReceptoraNome : undefined,
                  } : null);
                }}
                disabled={!isEditing}
                className="w-4 h-4 rounded border-base-600 bg-base-700 text-purple-500 focus:ring-purple-500"
              />
              <label htmlFor="isFIV" className="text-sm font-medium text-gray-300 cursor-pointer">
                Animal nascido de FIV (Fertilização In Vitro)
              </label>
            </div>
            {editableAnimal.isFIV && (
              <p className="text-xs text-purple-400 ml-6 -mt-2">
                Em FIV, a <strong>Doadora</strong> é a mãe biológica (genética) e a <strong>Receptora</strong> é quem gestou o embrião.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Campos normais quando NÃO é FIV */}
              {!editableAnimal.isFIV && (
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
                  {motherExists === true && editableAnimal.maeRaca ? (
                    <p className="text-xs text-emerald-400 mt-1">
                      Raça da mãe: <strong>{editableAnimal.maeRaca}</strong>
                    </p>
                  ) : motherExists === false ? (
                    <p className="text-xs text-amber-400 mt-1">Mãe não encontrada no rebanho</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">A raça será puxada automaticamente</p>
                  )}
                </div>
              )}

              {/* Campos específicos FIV */}
              {editableAnimal.isFIV && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-purple-300">
                      Doadora (Mãe Biológica)
                    </label>
                    <input
                      type="text"
                      name="maeBiologicaNome"
                      value={editableAnimal.maeBiologicaNome || ''}
                      onChange={onAnimalFormChange}
                      className="bg-base-700 w-full p-1 rounded border border-purple-600 focus:ring-purple-500"
                      disabled={!isEditing}
                      placeholder="Brinco da doadora"
                    />
                    {donorExists.found === true ? (
                      <p className="text-xs text-emerald-400 mt-1">
                        Doadora encontrada - Raça: <strong>{donorExists.raca}</strong>
                      </p>
                    ) : donorExists.found === false ? (
                      <p className="text-xs text-amber-400 mt-1">Doadora não encontrada no rebanho</p>
                    ) : (
                      <p className="text-xs text-purple-400 mt-1">Mãe genética - usada na genealogia</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-pink-300">
                      Receptora (Mãe Gestante)
                    </label>
                    <input
                      type="text"
                      name="maeReceptoraNome"
                      value={editableAnimal.maeReceptoraNome || ''}
                      onChange={onAnimalFormChange}
                      className="bg-base-700 w-full p-1 rounded border border-pink-600 focus:ring-pink-500"
                      disabled={!isEditing}
                      placeholder="Brinco da receptora"
                    />
                    {recipientExists === true ? (
                      <p className="text-xs text-emerald-400 mt-1">Receptora encontrada no rebanho</p>
                    ) : recipientExists === false ? (
                      <p className="text-xs text-amber-400 mt-1">Receptora não encontrada no rebanho</p>
                    ) : (
                      <p className="text-xs text-pink-400 mt-1">Quem gestou o embrião</p>
                    )}
                  </div>
                </>
              )}

              <div className={editableAnimal.isFIV ? 'sm:col-span-2' : ''}>
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
    </div>
  );
};

export default React.memo(GeneralTab);
