import React, { useState } from 'react';
import { Animal, WeighingType } from '../types';
import Modal from './common/Modal';

interface QuickWeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal | null;
  onSave: (animalId: string, weight: number, type: WeighingType) => void;
}

const QuickWeightModal: React.FC<QuickWeightModalProps> = ({
  isOpen,
  onClose,
  animal,
  onSave,
}) => {
  const [weight, setWeight] = useState('');
  const [type, setType] = useState<WeighingType>(WeighingType.None);

  const handleSave = () => {
    if (!animal || !weight) return;
    
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) return;

    onSave(animal.id, weightNum, type);
    setWeight('');
    setType(WeighingType.None);
    onClose();
  };

  const handleClose = () => {
    setWeight('');
    setType(WeighingType.None);
    onClose();
  };

  if (!animal) return null;

  const diff = weight ? parseFloat(weight) - animal.pesoKg : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="⚖️ Registrar Peso">
      <div className="space-y-4">
        {/* Info do animal */}
        <div className="bg-base-700 rounded-lg p-3 flex justify-between items-center">
          <div>
            <p className="font-bold text-white">{animal.nome || animal.brinco}</p>
            <p className="text-sm text-gray-400">{animal.raca}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Peso atual</p>
            <p className="text-xl font-bold text-brand-primary">{animal.pesoKg} kg</p>
          </div>
        </div>

        {/* Input de peso */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Novo Peso (kg)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Ex: 320"
            className="w-full px-4 py-3 bg-base-700 border border-base-600 rounded-lg text-white text-xl text-center"
            autoFocus
          />
          {diff !== 0 && !isNaN(diff) && (
            <p className={`text-sm mt-1 text-center ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
            </p>
          )}
        </div>

        {/* Tipo de pesagem */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tipo de Pesagem</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(WeighingType).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  type === t
                    ? 'bg-brand-primary text-white'
                    : 'bg-base-700 text-gray-400 hover:bg-base-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-base-700 text-white rounded-lg hover:bg-base-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!weight || parseFloat(weight) <= 0}
            className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickWeightModal;
