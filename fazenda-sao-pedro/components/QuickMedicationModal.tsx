import React, { useState } from 'react';
import { Animal, MedicationAdministration } from '../types';
import Modal from './common/Modal';

interface QuickMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal | null;
  onSave: (animalId: string, medication: Omit<MedicationAdministration, 'id'>) => void;
}

const COMMON_MEDICATIONS = [
  'Ivermectina',
  'Doramectina',
  'Vacina Aftosa',
  'Vacina Carbúnculo',
  'Vacina Brucelose',
  'Antibiótico',
  'Anti-inflamatório',
  'Vermífugo',
];

const COMMON_REASONS = [
  'Prevenção',
  'Vermifugação',
  'Vacinação',
  'Tratamento',
  'Controle de Carrapatos',
  'Bicheira',
  'Diarreia',
  'Pneumonia',
];

const QuickMedicationModal: React.FC<QuickMedicationModalProps> = ({
  isOpen,
  onClose,
  animal,
  onSave,
}) => {
  const [medicamento, setMedicamento] = useState('');
  const [dose, setDose] = useState('');
  const [unidade, setUnidade] = useState<'ml' | 'mg' | 'dose'>('ml');
  const [motivo, setMotivo] = useState('');
  const [responsavel, setResponsavel] = useState('Equipe Campo');

  const handleSave = () => {
    if (!animal || !medicamento || !motivo) return;

    onSave(animal.id, {
      medicamento,
      dose: parseFloat(dose) || 0,
      unidade,
      motivo,
      responsavel,
      dataAplicacao: new Date(),
    });

    // Reset
    setMedicamento('');
    setDose('');
    setUnidade('ml');
    setMotivo('');
    onClose();
  };

  const handleClose = () => {
    setMedicamento('');
    setDose('');
    setMotivo('');
    onClose();
  };

  if (!animal) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="💊 Registrar Medicação">
      <div className="space-y-4">
        {/* Info do animal */}
        <div className="bg-base-700 rounded-lg p-3 flex justify-between items-center">
          <div>
            <p className="font-bold text-white">{animal.nome || animal.brinco}</p>
            <p className="text-sm text-gray-400">{animal.raca} • {animal.pesoKg}kg</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Tratamentos</p>
            <p className="text-xl font-bold text-red-400">{animal.historicoSanitario?.length || 0}</p>
          </div>
        </div>

        {/* Medicamento */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Medicamento *</label>
          <input
            type="text"
            value={medicamento}
            onChange={(e) => setMedicamento(e.target.value)}
            placeholder="Nome do medicamento"
            className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white mb-2"
            list="medications-list"
          />
          <datalist id="medications-list">
            {COMMON_MEDICATIONS.map(m => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1">
            {COMMON_MEDICATIONS.slice(0, 4).map(m => (
              <button
                key={m}
                onClick={() => setMedicamento(m)}
                className={`px-2 py-1 text-xs rounded ${
                  medicamento === m 
                    ? 'bg-brand-primary text-white' 
                    : 'bg-base-600 text-gray-300 hover:bg-base-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Dose */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-1">Dose</label>
            <input
              type="number"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            />
          </div>
          <div className="w-24">
            <label className="block text-sm text-gray-400 mb-1">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => setUnidade(e.target.value as any)}
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            >
              <option value="ml">ml</option>
              <option value="mg">mg</option>
              <option value="dose">dose</option>
            </select>
          </div>
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Motivo *</label>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da aplicação"
            className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white mb-2"
            list="reasons-list"
          />
          <datalist id="reasons-list">
            {COMMON_REASONS.map(r => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1">
            {COMMON_REASONS.slice(0, 4).map(r => (
              <button
                key={r}
                onClick={() => setMotivo(r)}
                className={`px-2 py-1 text-xs rounded ${
                  motivo === r 
                    ? 'bg-red-600 text-white' 
                    : 'bg-base-600 text-gray-300 hover:bg-base-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Responsável</label>
          <input
            type="text"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
          />
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
            disabled={!medicamento || !motivo}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default QuickMedicationModal;
