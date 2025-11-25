import React, { useState, useEffect } from 'react';
import { ManagementArea } from '../types';
import Modal from './common/Modal';

interface AddEditAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (area: Omit<ManagementArea, 'id'> & { id?: string }) => void;
  area: ManagementArea | null;
}

const AddEditAreaModal = ({ isOpen, onClose, onSave, area }: AddEditAreaModalProps) => {
  const [name, setName] = useState('');
  const [areaHa, setAreaHa] = useState('');

  useEffect(() => {
    if (area) {
      setName(area.name);
      setAreaHa(String(area.areaHa));
    } else {
      setName('');
      setAreaHa('');
    }
  }, [area, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const areaHaValue = parseFloat(areaHa);
    if (name.trim() && !isNaN(areaHaValue) && areaHaValue >= 0) {
      onSave({ id: area?.id, name: name.trim(), areaHa: areaHaValue });
      onClose();
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={area ? 'Editar Área de Manejo' : 'Adicionar Nova Área'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300">
            Nome da Área
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2"
            placeholder="Ex: Pasto A, Invernada B"
            required
          />
        </div>
        <div>
          <label htmlFor="areaHa" className="block text-sm font-medium text-gray-300">
            Tamanho (hectares)
          </label>
          <input
            type="number"
            id="areaHa"
            value={areaHa}
            onChange={(e) => setAreaHa(e.target.value)}
            className="mt-1 block w-full bg-base-700 border-base-600 rounded-md shadow-sm p-2"
            placeholder="Ex: 50.5"
            step="0.01"
            min="0"
            required
          />
        </div>
        <div className="pt-4 flex justify-end items-center">
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors">
                Cancelar
              </button>
              <button type="submit" className="bg-brand-primary hover:bg-brand-primary-light text-white font-bold py-2 px-4 rounded transition-colors">
                Salvar
              </button>
            </div>
        </div>
      </form>
    </Modal>
  );
};

export default AddEditAreaModal;
