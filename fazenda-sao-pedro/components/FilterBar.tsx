import React from 'react';
import { AnimalStatus } from '../types';

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedMedication: string;
  setSelectedMedication: (med: string) => void;
  selectedReason: string;
  setSelectedReason: (reason: string) => void;
  allMedications: string[];
  allReasons: string[];
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  onClear: () => void;
}

const FilterBar = ({
  searchTerm,
  setSearchTerm,
  selectedMedication,
  setSelectedMedication,
  selectedReason,
  setSelectedReason,
  allMedications,
  allReasons,
  selectedStatus,
  setSelectedStatus,
  onClear,
}: FilterBarProps) => {
  return (
    <div className="bg-base-800 p-4 mb-6 rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
        {/* Search Input */}
        <div className="md:col-span-2">
          <label htmlFor="search" className="block text-sm font-medium text-gray-300 mb-1">
            Buscar (Brinco, Nome)
          </label>
          <input
            type="text"
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Digite para buscar..."
            className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2"
          />
        </div>

        {/* Medication Filter */}
        <div>
          <label htmlFor="medication" className="block text-sm font-medium text-gray-300 mb-1">
            Medicamento
          </label>
          <select
            id="medication"
            value={selectedMedication}
            onChange={(e) => setSelectedMedication(e.target.value)}
            className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2"
          >
            <option value="">Todos</option>
            {allMedications.map(med => <option key={med} value={med}>{med}</option>)}
          </select>
        </div>

        {/* Reason Filter */}
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-1">
            Motivo
          </label>
          <select
            id="reason"
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2"
          >
            <option value="">Todos</option>
            {allReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">
            Status
          </label>
          <select
            id="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2"
          >
            <option value="">Todos</option>
            {Object.values(AnimalStatus).map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        
        <div>
            <button
            onClick={onClear}
            className="w-full bg-base-700 text-gray-300 hover:bg-base-600 font-bold py-2 px-4 rounded transition-colors"
            >
            Limpar Filtros
            </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
