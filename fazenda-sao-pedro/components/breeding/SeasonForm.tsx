import React, { useState } from 'react';
import { BreedingSeasonStatus } from '../../types';

interface SeasonFormProps {
  initialData?: { name: string; startDate: string; endDate: string; status?: BreedingSeasonStatus };
  onSubmit: (data: { name: string; startDate: Date; endDate: Date; status?: BreedingSeasonStatus }) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const SeasonForm: React.FC<SeasonFormProps> = ({ initialData, onSubmit, onCancel, isEdit }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [startDate, setStartDate] = useState(initialData?.startDate || '');
  const [endDate, setEndDate] = useState(initialData?.endDate || '');
  const [status, setStatus] = useState<BreedingSeasonStatus>(initialData?.status || 'planning');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && startDate && endDate) {
      if (endDate < startDate) {
        alert('A data de fim deve ser igual ou posterior à data de início.');
        return;
      }
      onSubmit({
        name,
        startDate: new Date(startDate + 'T00:00:00'),
        endDate: new Date(endDate + 'T00:00:00'),
        ...(isEdit ? { status } : {}),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-base-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">
        {isEdit ? 'Editar Estacao de Monta' : 'Nova Estacao de Monta'}
      </h3>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Estacao 2024/2025"
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Inicio (Periodo da Estacao)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Fim (Periodo da Estacao)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
            required
          />
        </div>
      </div>

      {isEdit && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BreedingSeasonStatus)}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="planning">Planejamento</option>
            <option value="active">Ativa</option>
            <option value="finished">Finalizada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-base-700 text-gray-300 rounded-lg hover:bg-base-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          {isEdit ? 'Salvar' : 'Criar Estacao'}
        </button>
      </div>
    </form>
  );
};

export default SeasonForm;
