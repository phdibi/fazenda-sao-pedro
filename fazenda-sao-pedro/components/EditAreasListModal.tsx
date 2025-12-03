import React, { useState, useEffect } from 'react';
import { ManagementArea } from '../types';
import Modal from './common/Modal';
import { TrashIcon } from './common/Icons';

interface EditAreasListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (area: Omit<ManagementArea, 'id'> & { id?: string }) => void;
  onDelete: (areaId: string) => void;
  areas: ManagementArea[];
}

type EditableArea = {
    id: string;
    name: string;
    areaHa: string; // Manter como string para o controlo do input
}

const EditAreasListModal = ({ isOpen, onClose, onSave, onDelete, areas }: EditAreasListModalProps) => {
  const [editableAreas, setEditableAreas] = useState<EditableArea[]>([]);

  // Sincronizar com as props quando o modal abre ou os dados das áreas mudam externamente
  useEffect(() => {
    if (isOpen) {
      setEditableAreas(areas.map(area => ({
        ...area,
        areaHa: String(area.areaHa),
      })));
    }
  }, [isOpen, areas]);

  const handleFieldChange = (areaId: string, field: 'name' | 'areaHa', value: string) => {
    setEditableAreas(currentAreas =>
      currentAreas.map(area =>
        area.id === areaId ? { ...area, [field]: value } : area
      )
    );
  };

  const handleStageDelete = (areaId: string) => {
    setEditableAreas(prev => prev.filter(area => area.id !== areaId));
  };
  
  const handleCancel = () => {
    // Resetar o estado antes de fechar para evitar ver dados desatualizados ao reabrir
    setEditableAreas(areas.map(area => ({ ...area, areaHa: String(area.areaHa) })));
    onClose();
  };

  const handleSaveAll = () => {
    // 1. Determinar o que mudou comparando o estado de rascunho atual com as 'areas' originais.
    const originalAreasMap = new Map(areas.map(a => [a.id, a]));
    const editableAreaIds = new Set(editableAreas.map(a => a.id));

    const idsToDelete = areas
        .map(a => a.id)
        .filter(id => !editableAreaIds.has(id));

    const areasToUpdate: (Omit<ManagementArea, 'id'> & { id: string })[] = [];
    for (const editable of editableAreas) {
        const original = originalAreasMap.get(editable.id);
        if (!original) continue; 

        const areaHaNum = parseFloat(editable.areaHa);
        const nameChanged = original.name !== editable.name.trim();
        const areaChanged = original.areaHa !== areaHaNum;
        
        if (!isNaN(areaHaNum) && (nameChanged || areaChanged)) {
            areasToUpdate.push({
                id: editable.id,
                name: editable.name.trim(),
                areaHa: areaHaNum,
            });
        }
    }

    // 2. Fechar o modal ANTES de iniciar as atualizações.
    onClose();

    // 3. Adiar a execução das atualizações para o próximo ciclo de eventos da UI.
    setTimeout(() => {
        idsToDelete.forEach(id => onDelete(id));
        areasToUpdate.forEach(area => onSave(area));
    }, 0);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Editar Áreas de Manejo">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {editableAreas.length > 0 ? (
          editableAreas
            .sort((a,b) => a.name.localeCompare(b.name))
            .map(area => (
              <div key={area.id} className="grid grid-cols-12 gap-3 items-center p-2 bg-base-700 rounded-md">
                <div className="col-span-6">
                    <label htmlFor={`name-${area.id}`} className="sr-only">Nome da Área</label>
                    <input
                        type="text"
                        id={`name-${area.id}`}
                        value={area.name}
                        onChange={e => handleFieldChange(area.id, 'name', e.target.value)}
                        className="w-full bg-base-900 border-base-600 rounded-md shadow-sm p-2 text-sm"
                        placeholder="Nome da Área"
                        required
                    />
                </div>
                <div className="col-span-5">
                     <label htmlFor={`areaHa-${area.id}`} className="sr-only">Tamanho (ha)</label>
                    <input
                        type="number"
                        id={`areaHa-${area.id}`}
                        value={area.areaHa}
                        onChange={e => handleFieldChange(area.id, 'areaHa', e.target.value)}
                        className="w-full bg-base-900 border-base-600 rounded-md shadow-sm p-2 text-sm"
                        placeholder="Tamanho (ha)"
                        step="0.01"
                        min="0"
                        required
                    />
                </div>
                <div className="col-span-1 flex justify-end">
                    <button
                        onClick={() => handleStageDelete(area.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/50 rounded-full transition-colors"
                        aria-label={`Marcar ${area.name} para exclusão`}
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
              </div>
            ))
        ) : (
          <p className="text-gray-500 text-center py-8">Nenhuma área para editar.</p>
        )}
      </div>
      <div className="pt-6 flex justify-end gap-2">
        <button type="button" onClick={handleCancel} className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors">
          Cancelar
        </button>
        <button type="button" onClick={handleSaveAll} className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors">
          Salvar Alterações
        </button>
      </div>
    </Modal>
  );
};

export default EditAreasListModal;
