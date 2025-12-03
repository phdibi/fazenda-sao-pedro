import React, { useState, useEffect, useMemo } from 'react';
import { Animal, ManagementArea } from '../types';
import Modal from './common/Modal';
import { ArrowsRightLeftIcon } from './common/Icons';

interface ManageAnimalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (areaId: string, animalIdsToAssign: string[]) => void;
  area: ManagementArea;
  allAnimals: Animal[];
}

interface AnimalListItemProps {
  animal: Animal;
  onToggle: () => void;
  isAssigned: boolean;
}

const AnimalListItem = ({ animal, onToggle, isAssigned }: AnimalListItemProps) => (
  <div className="flex items-center justify-between p-2 bg-base-900 rounded-md">
    <div>
      <p className="text-sm font-semibold text-white">Brinco: {animal.brinco}</p>
      <p className="text-xs text-gray-400">{animal.nome || 'Sem nome'}</p>
    </div>
    <button
      onClick={onToggle}
      className={`p-2 rounded-full transition-colors ${
        isAssigned
          ? 'text-red-400 hover:bg-red-900/50'
          : 'text-green-400 hover:bg-green-900/50'
      }`}
      aria-label={isAssigned ? 'Remover da área' : 'Adicionar à área'}
    >
      <ArrowsRightLeftIcon className={`w-4 h-4 ${isAssigned ? '' : 'transform rotate-180'}`} />
    </button>
  </div>
);

const ManageAnimalsModal = ({ isOpen, onClose, onSave, area, allAnimals }: ManageAnimalsModalProps) => {
  const [assignedAnimalIds, setAssignedAnimalIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      const ids = new Set(allAnimals.filter(a => a.managementAreaId === area.id).map(a => a.id));
      setAssignedAnimalIds(ids);
    }
  }, [isOpen, area, allAnimals]);

  const toggleAnimalAssignment = (animalId: string) => {
    setAssignedAnimalIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(animalId)) {
        newSet.delete(animalId);
      } else {
        newSet.add(animalId);
      }
      return newSet;
    });
  };

  const { assignedAnimals, availableAnimals } = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const assigned = [];
    const available = [];
    for (const animal of allAnimals) {
        if (assignedAnimalIds.has(animal.id)) {
            assigned.push(animal);
        } else if (
            animal.status === 'Ativo' && 
            (!animal.managementAreaId || animal.managementAreaId === area.id) &&
            (animal.brinco.toLowerCase().includes(term) || animal.nome?.toLowerCase().includes(term))
        ) {
            available.push(animal);
        }
    }
    return { 
        assignedAnimals: assigned.sort((a,b) => a.brinco.localeCompare(b.brinco)), 
        availableAnimals: available.sort((a,b) => a.brinco.localeCompare(b.brinco))
    };
  }, [allAnimals, assignedAnimalIds, searchTerm, area.id]);

  const handleSave = () => {
    onSave(area.id, Array.from(assignedAnimalIds));
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Gerenciar Animais em: ${area.name}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[50vh]">
        {/* Assigned Animals Column */}
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold mb-2">Animais na Área ({assignedAnimals.length})</h3>
          <div className="bg-base-700 p-2 rounded-lg flex-1 overflow-y-auto space-y-2">
            {assignedAnimals.length > 0 ? (
                assignedAnimals.map(animal => (
                    <AnimalListItem key={animal.id} animal={animal} onToggle={() => toggleAnimalAssignment(animal.id)} isAssigned />
                ))
            ) : (
                <p className="text-center text-gray-500 pt-8">Nenhum animal nesta área.</p>
            )}
          </div>
        </div>
        {/* Available Animals Column */}
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold mb-2">Animais Disponíveis ({availableAnimals.length})</h3>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar brinco ou nome..."
            className="w-full bg-base-700 border-base-600 rounded-md p-2 mb-2"
          />
          <div className="bg-base-700 p-2 rounded-lg flex-1 overflow-y-auto space-y-2">
            {availableAnimals.length > 0 ? (
                 availableAnimals.map(animal => (
                    <AnimalListItem key={animal.id} animal={animal} onToggle={() => toggleAnimalAssignment(animal.id)} isAssigned={false} />
                ))
            ) : (
                 <p className="text-center text-gray-500 pt-8">Nenhum animal disponível.</p>
            )}
          </div>
        </div>
      </div>
      <div className="pt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors">
          Salvar Alterações
        </button>
      </div>
    </Modal>
  );
};

export default ManageAnimalsModal;
