import React, { useState, useCallback } from 'react';
import { Animal, Sexo, AppUser } from '../../types';
import Modal from '../common/Modal';
import { TrashIcon } from '../common/Icons';
import GenealogyTree from '../genealogy';
import Spinner from '../common/Spinner';

// Tabs
import { TabButton, TabName } from './TabButton';
import { GeneralTab, HealthTab, WeightTab, ReproductionTab, ProgenyTab } from './tabs';

// Hook centralizado
import { useAnimalDetailForm } from './hooks/useAnimalDetailForm';

interface AnimalDetailModalProps {
  animal: Animal | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateAnimal: (animalId: string, updatedData: Partial<Omit<Animal, 'id'>>) => void;
  onDeleteAnimal: (animalId: string) => Promise<void>;
  onArchiveAnimal?: (animalId: string) => Promise<void>;
  animals: Animal[];
  user: AppUser;
  storageReady: boolean;
}

const AnimalDetailModal: React.FC<AnimalDetailModalProps> = ({
  animal,
  isOpen,
  onClose,
  onUpdateAnimal,
  onDeleteAnimal,
  onArchiveAnimal,
  animals,
  user,
  storageReady,
}) => {
  const [activeTab, setActiveTab] = useState<TabName>('general');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Hook centralizado com toda a lógica de formulário
  const form = useAnimalDetailForm({
    animal,
    isOpen,
    onUpdateAnimal,
    animals, // Passa lista de animais para buscar raça da mãe
  });

  const {
    editableAnimal,
    isEditing,
    isSaving,
    saveError,
    medicationForm,
    newWeightData,
    pregnancyForm,
    abortionDate,
    offspringForm,
    setIsEditing,
    setEditableAnimal,
    setNewWeightData,
    setPregnancyForm,
    setAbortionDate,
    setOffspringForm,
    handleSaveChanges,
    handleCancelEdit,
    handleAnimalFormChange,
    handleUploadComplete,
    handleDataExtracted,
    handleMedicationFormChange,
    handleMedicationItemChange,
    handleAddMedicationItem,
    handleRemoveMedicationItem,
    handleAddMedicationSubmit,
    handleDeleteMedication,
    handleMedicationDateChange,
    handleAddWeight,
    handleDeleteWeight,
    handleWeightDateChange,
    handleAutoClassifyWeights,
    handleAddPregnancySubmit,
    handleDeletePregnancyRecord,
    handleAddAbortionSubmit,
    handleDeleteAbortionRecord,
    handleAddOrUpdateOffspringSubmit,
    handleDeleteOffspringRecord,
    handleDeletePhoto,
    isDeletingPhoto,
  } = form;

  // Handlers de delete
  const handleRequestDelete = useCallback(() => {
    setDeleteConfirmationText('');
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!animal) return;
    if (deleteConfirmationText.trim().toLowerCase() === animal.brinco.toLowerCase()) {
      try {
        await onDeleteAnimal(animal.id);
        setIsDeleteModalOpen(false);
        onClose();
      } catch (error) {
        alert('Falha ao excluir o animal. Verifique o console para mais detalhes.');
      }
    } else {
      alert('O número do brinco digitado não confere.');
    }
  }, [animal, deleteConfirmationText, onDeleteAnimal, onClose]);

  // Early return se não houver dados
  if (!animal || !editableAnimal) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Detalhes do Animal: ${animal.nome || `Brinco ${animal.brinco}`}`}
      >
        {/* Tabs Navigation */}
        <div className="border-b border-base-700 overflow-x-auto">
          <nav className="flex space-x-4">
            <TabButton tabName="general" label="Dados Gerais" activeTab={activeTab} onClick={setActiveTab} />
            <TabButton tabName="health" label="Histórico Sanitário" activeTab={activeTab} onClick={setActiveTab} />
            <TabButton tabName="weight" label="Histórico de Pesagens" activeTab={activeTab} onClick={setActiveTab} />
            {animal.sexo === Sexo.Femea && (
              <TabButton tabName="reproduction" label="Reprodução" activeTab={activeTab} onClick={setActiveTab} />
            )}
            <TabButton tabName="progeny" label="Progênie" activeTab={activeTab} onClick={setActiveTab} />
            <TabButton tabName="genealogy" label="Genealogia" activeTab={activeTab} onClick={setActiveTab} />
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-4 min-h-[50vh] pb-48 md:pb-4">
          {activeTab === 'general' && (
            <GeneralTab
              editableAnimal={editableAnimal}
              animal={animal}
              user={user}
              storageReady={storageReady}
              isEditing={isEditing}
              onAnimalFormChange={handleAnimalFormChange}
              onUploadComplete={handleUploadComplete}
              setEditableAnimal={setEditableAnimal}
              animals={animals}
              onDeletePhoto={handleDeletePhoto}
              isDeletingPhoto={isDeletingPhoto}
            />
          )}

          {activeTab === 'health' && (
            <HealthTab
              editableAnimal={editableAnimal}
              isEditing={isEditing}
              medicationForm={medicationForm}
              onMedicationFormChange={handleMedicationFormChange}
              onMedicationItemChange={handleMedicationItemChange}
              onAddMedicationItem={handleAddMedicationItem}
              onRemoveMedicationItem={handleRemoveMedicationItem}
              onAddMedicationSubmit={handleAddMedicationSubmit}
              onDeleteMedication={handleDeleteMedication}
              onMedicationDateChange={handleMedicationDateChange}
              onDataExtracted={handleDataExtracted}
            />
          )}

          {activeTab === 'weight' && (
            <WeightTab
              editableAnimal={editableAnimal}
              isEditing={isEditing}
              newWeightData={newWeightData}
              setNewWeightData={setNewWeightData}
              onAddWeight={handleAddWeight}
              onDeleteWeight={handleDeleteWeight}
              onWeightDateChange={handleWeightDateChange}
              onAutoClassifyWeights={handleAutoClassifyWeights}
            />
          )}

          {activeTab === 'reproduction' && animal.sexo === Sexo.Femea && (
            <ReproductionTab
              editableAnimal={editableAnimal}
              isEditing={isEditing}
              pregnancyForm={pregnancyForm}
              setPregnancyForm={setPregnancyForm}
              abortionDate={abortionDate}
              setAbortionDate={setAbortionDate}
              onAddPregnancySubmit={handleAddPregnancySubmit}
              onDeletePregnancyRecord={handleDeletePregnancyRecord}
              onAddAbortionSubmit={handleAddAbortionSubmit}
              onDeleteAbortionRecord={handleDeleteAbortionRecord}
            />
          )}

          {activeTab === 'progeny' && (
            <ProgenyTab
              editableAnimal={editableAnimal}
              animal={animal}
              allAnimals={animals}
              isEditing={isEditing}
              offspringForm={offspringForm}
              setOffspringForm={setOffspringForm}
              onAddOrUpdateOffspringSubmit={handleAddOrUpdateOffspringSubmit}
              onDeleteOffspringRecord={handleDeleteOffspringRecord}
            />
          )}

          {activeTab === 'genealogy' && <GenealogyTree animal={animal} allAnimals={animals} />}
        </div>

        {/* Error Display */}
        {isEditing && saveError && (
          <div className="text-red-400 text-sm bg-red-900/30 p-3 rounded-md mt-4 text-center">
            <strong>Falha ao Salvar:</strong> {saveError}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-2 p-4 mt-6 mb-24 border-t border-base-700">
          <div>
            {!isEditing && (
              <button
                onClick={handleRequestDelete}
                className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
              >
                <TrashIcon className="w-5 h-5" /> Excluir Animal
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveChanges}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors flex items-center justify-center w-28"
                  disabled={isSaving}
                >
                  {isSaving ? <Spinner /> : 'Salvar'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded flex items-center gap-2 transition-colors"
              >
                Editar
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão">
        <div className="text-white">
          <p className="text-lg">
            Você tem certeza que deseja excluir permanentemente o animal com brinco{' '}
            <strong className="text-brand-primary-light">{animal.brinco}</strong>?
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Esta ação não pode ser desfeita. Todos os dados associados a este animal serão perdidos.
          </p>
          <div className="mt-6">
            <label htmlFor="delete-confirm-input" className="block text-sm font-medium text-gray-300">
              Para confirmar, digite o brinco do animal: <span className="font-bold">{animal.brinco}</span>
            </label>
            <input
              type="text"
              id="delete-confirm-input"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2"
            />
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteConfirmationText.trim().toLowerCase() !== animal.brinco.toLowerCase()}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-red-900 disabled:cursor-not-allowed"
            >
              Confirmar Exclusão
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AnimalDetailModal;
