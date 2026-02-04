import React, { useState, useEffect } from 'react';
import { Animal, MedicationAdministration, MedicationItem } from '../types';
import { XMarkIcon, PlusIcon, TrashIcon } from './common/Icons';

interface MedicationItemInput {
  id: string;
  medicamento: string;
  dose: string;
  unidade: 'ml' | 'mg' | 'dose';
}

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
  'Vacina Carbunculo',
];

const COMMON_REASONS = [
  'Prevencao',
  'Vermifugacao',
  'Vacinacao',
  'Tratamento',
];

const createEmptyMedicationItem = (): MedicationItemInput => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  medicamento: '',
  dose: '',
  unidade: 'ml',
});

const QuickMedicationModal: React.FC<QuickMedicationModalProps> = ({
  isOpen,
  onClose,
  animal,
  onSave,
}) => {
  const [medicamentos, setMedicamentos] = useState<MedicationItemInput[]>([createEmptyMedicationItem()]);
  const [motivo, setMotivo] = useState('');
  const [responsavel, setResponsavel] = useState('Equipe Campo');

  // Bloqueia scroll do body quando modal esta aberto
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

  const handleMedicamentoChange = (itemId: string, field: keyof MedicationItemInput, value: string) => {
    setMedicamentos((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddMedicamento = () => {
    setMedicamentos((prev) => [...prev, createEmptyMedicationItem()]);
  };

  const handleRemoveMedicamento = (itemId: string) => {
    if (medicamentos.length <= 1) return;
    setMedicamentos((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSelectCommonMedication = (med: string) => {
    // Adiciona ao primeiro item vazio ou cria novo
    const emptyIndex = medicamentos.findIndex((m) => !m.medicamento);
    if (emptyIndex >= 0) {
      handleMedicamentoChange(medicamentos[emptyIndex].id, 'medicamento', med);
    } else {
      setMedicamentos((prev) => [
        ...prev,
        { ...createEmptyMedicationItem(), medicamento: med },
      ]);
    }
  };

  const handleSave = () => {
    if (!animal || !motivo) return;

    // Filtra medicamentos validos
    const validMedicamentos: MedicationItem[] = medicamentos
      .filter((m) => m.medicamento.trim() !== '')
      .map((m) => ({
        medicamento: m.medicamento,
        dose: parseFloat(m.dose) || 0,
        unidade: m.unidade,
      }));

    if (validMedicamentos.length === 0) return;

    onSave(animal.id, {
      medicamentos: validMedicamentos,
      motivo,
      responsavel,
      dataAplicacao: new Date(),
      // Campos legados para compatibilidade
      medicamento: validMedicamentos[0]?.medicamento,
      dose: validMedicamentos[0]?.dose,
      unidade: validMedicamentos[0]?.unidade,
    });

    // Reset
    handleClose();
  };

  const handleClose = () => {
    setMedicamentos([createEmptyMedicationItem()]);
    setMotivo('');
    setResponsavel('Equipe Campo');
    onClose();
  };

  // Previne propagacao de touch para o fundo
  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  if (!isOpen || !animal) return null;

  const hasValidMedication = medicamentos.some((m) => m.medicamento.trim() !== '');

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
          maxHeight: '85vh',
          touchAction: 'pan-y',
        }}
        onTouchMove={handleTouchMove}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fixo */}
        <div className="flex justify-between items-center p-4 border-b border-base-700 shrink-0">
          <h2 className="text-lg font-bold text-white">Registrar Medicacao</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white p-2 -mr-2"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Conteudo com scroll */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Info do animal */}
          <div className="bg-base-700 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-bold text-white">{animal.nome || animal.brinco}</p>
              <p className="text-sm text-gray-400">{animal.raca} - {animal.pesoKg}kg</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Tratamentos</p>
              <p className="text-xl font-bold text-red-400">{animal.historicoSanitario?.length || 0}</p>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Motivo *</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da aplicacao"
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {COMMON_REASONS.map((r) => (
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

          {/* Medicamentos rapidos */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Medicamentos comuns</label>
            <div className="flex flex-wrap gap-1">
              {COMMON_MEDICATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectCommonMedication(m)}
                  className="px-2 py-1 text-xs rounded bg-base-600 text-gray-300 hover:bg-brand-primary hover:text-white transition-colors"
                >
                  + {m}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de medicamentos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300 font-medium">
                Medicamentos ({medicamentos.length})
              </label>
              <button
                type="button"
                onClick={handleAddMedicamento}
                className="flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary-light"
              >
                <PlusIcon className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {medicamentos.map((item, index) => (
              <div
                key={item.id}
                className="bg-base-900 rounded-lg p-3 border border-base-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">#{index + 1}</span>
                  {medicamentos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicamento(item.id)}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={item.medicamento}
                    onChange={(e) => handleMedicamentoChange(item.id, 'medicamento', e.target.value)}
                    placeholder="Nome do medicamento *"
                    className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white text-sm"
                  />

                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={item.dose}
                      onChange={(e) => handleMedicamentoChange(item.id, 'dose', e.target.value)}
                      placeholder="Dose"
                      className="flex-1 px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white text-sm"
                      step="0.1"
                      min="0"
                    />
                    <select
                      value={item.unidade}
                      onChange={(e) => handleMedicamentoChange(item.id, 'unidade', e.target.value)}
                      className="w-20 px-2 py-2 bg-base-700 border border-base-600 rounded-lg text-white text-sm"
                    >
                      <option value="ml">ml</option>
                      <option value="mg">mg</option>
                      <option value="dose">dose</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Responsavel */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Responsavel</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="w-full px-3 py-2 bg-base-700 border border-base-600 rounded-lg text-white"
            />
          </div>

          {/* Espaco extra para garantir que tudo seja visivel */}
          <div className="h-4" />
        </div>

        {/* Botoes fixos no rodape */}
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
              disabled={!hasValidMedication || !motivo}
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
