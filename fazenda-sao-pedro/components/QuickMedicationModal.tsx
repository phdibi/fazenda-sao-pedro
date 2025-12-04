import React, { useState, useEffect } from 'react';
import { Animal, MedicationAdministration } from '../types';
import { XMarkIcon } from './common/Icons';

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
];

const COMMON_REASONS = [
  'Prevenção',
  'Vermifugação',
  'Vacinação',
  'Tratamento',
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

  // Bloqueia scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

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

  // Previne propagação de touch para o fundo
  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  if (!isOpen || !animal) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-base-800 rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-md flex flex-col"
        style={{ 
          maxHeight: '80vh',
          touchAction: 'pan-y'
        }}
        onTouchMove={handleTouchMove}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo */}
        <div className="flex justify-between items-center p-4 border-b border-base-700 shrink-0">
          <h2 className="text-lg font-bold text-white">💊 Registrar Medicação</h2>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-white p-2 -mr-2"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Conteúdo com scroll */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Info do animal */}
          <div className="bg-base-700 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-bold text-white">{animal.nome || animal.brinco}</p>
              <p className="text-sm text-gray-400">{animal.raca} • {animal.pesoKg}kg</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Tratamentos</p>
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
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {COMMON_MEDICATIONS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMedicamento(m)}
                  className={`px-2 py-1 text-xs rounded ${
                    medicamento === m 
                      ? 'bg-brand-primary text-white' 
                      : 'bg-base-600 text-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Dose e Unidade */}
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
                onChange={(e) => setUnidade(e.target.value as 'ml' | 'mg' | 'dose')}
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
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {COMMON_REASONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setMotivo(r)}
                  className={`px-2 py-1 text-xs rounded ${
                    motivo === r 
                      ? 'bg-red-600 text-white' 
                      : 'bg-base-600 text-gray-300'
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
          
          {/* Espaço extra para garantir que tudo seja visível */}
          <div className="h-4" />
        </div>

        {/* Botões fixos no rodapé */}
        <div className="p-4 border-t border-base-700 shrink-0 bg-base-800 safe-area-inset-bottom">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-base-700 text-white rounded-lg font-medium active:bg-base-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!medicamento || !motivo}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 active:bg-red-700"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickMedicationModal;