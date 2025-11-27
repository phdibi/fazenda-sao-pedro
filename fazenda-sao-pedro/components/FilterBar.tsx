import React, { useState } from 'react';
import { AnimalStatus } from '../types';
import { ChevronDownIcon, ChevronUpIcon } from './common/Icons';

// Ícone de filtro
const FunnelIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
  </svg>
);

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
  const [isExpanded, setIsExpanded] = useState(false);

  // Conta quantos filtros estão ativos (exceto busca)
  const activeFiltersCount = [
    selectedMedication,
    selectedReason,
    selectedStatus
  ].filter(Boolean).length;

  return (
    <div className="bg-base-800 mb-6 rounded-lg shadow-md overflow-hidden">
      {/* Header sempre visível */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Campo de busca - sempre visível */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por brinco ou nome..."
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2.5 pl-10"
              />
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
          </div>
          
          {/* Botão de expandir filtros - mobile */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-base-700 hover:bg-base-600 rounded-md text-gray-300 transition-colors"
          >
            <FunnelIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="bg-brand-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {activeFiltersCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Filtros expandíveis - colapsado por padrão no mobile */}
      <div className={`
        ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 md:max-h-96 md:opacity-100'}
        transition-all duration-300 ease-in-out overflow-hidden
      `}>
        <div className="px-4 pb-4 pt-0 md:pt-0 border-t border-base-700 md:border-t-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 md:pt-0">
            {/* Medication Filter */}
            <div>
              <label htmlFor="medication" className="block text-xs font-medium text-gray-400 mb-1">
                Medicamento
              </label>
              <select
                id="medication"
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-sm p-2"
              >
                <option value="">Todos</option>
                {allMedications.map(med => <option key={med} value={med}>{med}</option>)}
              </select>
            </div>

            {/* Reason Filter */}
            <div>
              <label htmlFor="reason" className="block text-xs font-medium text-gray-400 mb-1">
                Motivo
              </label>
              <select
                id="reason"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-sm p-2"
              >
                <option value="">Todos</option>
                {allReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label htmlFor="status" className="block text-xs font-medium text-gray-400 mb-1">
                Status
              </label>
              <select
                id="status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-sm p-2"
              >
                <option value="">Todos</option>
                {Object.values(AnimalStatus).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            
            {/* Botão Limpar */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  onClear();
                  setIsExpanded(false);
                }}
                className="w-full bg-base-700 text-gray-300 hover:bg-base-600 font-medium py-2 px-4 rounded-md transition-colors text-sm"
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;