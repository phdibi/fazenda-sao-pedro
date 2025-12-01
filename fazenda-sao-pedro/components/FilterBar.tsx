import React, { useState } from 'react';
import { 
  AnimalStatus, 
  Sexo, 
  Raca, 
  ManagementArea,
  SortConfig,
  SortField,
  SortDirection,
  WeightRange,
  AgeRange,
  SearchField
} from '../types';
import { ChevronDownIcon, ChevronUpIcon } from './common/Icons';

// Ícones
const FunnelIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
  </svg>
);

const SortIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
  </svg>
);

interface FilterBarProps {
  // Busca
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchFields: SearchField[];
  setSearchFields: (fields: SearchField[]) => void;
  
  // Filtros básicos
  selectedMedication: string;
  setSelectedMedication: (med: string) => void;
  selectedReason: string;
  setSelectedReason: (reason: string) => void;
  allMedications: string[];
  allReasons: string[];
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  selectedSexo: string;
  setSelectedSexo: (sexo: string) => void;
  
  // Novos filtros
  selectedRaca: string;
  setSelectedRaca: (raca: string) => void;
  selectedAreaId: string;
  setSelectedAreaId: (areaId: string) => void;
  areas: ManagementArea[];
  weightRange: WeightRange;
  setWeightRange: (range: WeightRange) => void;
  ageRange: AgeRange;
  setAgeRange: (range: AgeRange) => void;
  
  // Ordenação
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  
  // Utilitários
  onClear: () => void;
  activeFiltersCount: number;
}

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'brinco', label: 'Brinco' },
  { value: 'nome', label: 'Nome' },
  { value: 'pesoKg', label: 'Peso' },
  { value: 'dataNascimento', label: 'Idade' },
  { value: 'raca', label: 'Raça' },
  { value: 'status', label: 'Status' },
];

const SEARCH_FIELD_OPTIONS: { value: SearchField; label: string }[] = [
  { value: 'brinco', label: 'Brinco' },
  { value: 'nome', label: 'Nome' },
  { value: 'paiNome', label: 'Pai' },
  { value: 'maeNome', label: 'Mãe' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'motivo', label: 'Motivo' },
];

const AGE_PRESETS = [
  { label: 'Bezerros (0-6m)', minMonths: 0, maxMonths: 6 },
  { label: 'Jovens (6-12m)', minMonths: 6, maxMonths: 12 },
  { label: 'Novilhos (12-24m)', minMonths: 12, maxMonths: 24 },
  { label: 'Adultos (24m+)', minMonths: 24, maxMonths: null },
];

const FilterBar = ({
  searchTerm,
  setSearchTerm,
  searchFields,
  setSearchFields,
  selectedMedication,
  setSelectedMedication,
  selectedReason,
  setSelectedReason,
  allMedications,
  allReasons,
  selectedStatus,
  setSelectedStatus,
  selectedSexo,
  setSelectedSexo,
  selectedRaca,
  setSelectedRaca,
  selectedAreaId,
  setSelectedAreaId,
  areas,
  weightRange,
  setWeightRange,
  ageRange,
  setAgeRange,
  sortConfig,
  setSortConfig,
  onClear,
  activeFiltersCount,
}: FilterBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSearchOptions, setShowSearchOptions] = useState(false);

  const handleSortFieldChange = (field: SortField) => {
    if (sortConfig.field === field) {
      // Toggle direction se mesmo campo
      setSortConfig({
        field,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ field, direction: 'asc' });
    }
  };

  const toggleSearchField = (field: SearchField) => {
    if (searchFields.includes(field)) {
      if (searchFields.length > 1) {
        setSearchFields(searchFields.filter(f => f !== field));
      }
    } else {
      setSearchFields([...searchFields, field]);
    }
  };

  return (
    <div className="bg-base-800 mb-6 rounded-lg shadow-md overflow-hidden">
      {/* Header sempre visível */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Campo de busca com opções */}
          <div className="flex-1 relative">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Buscar em: ${searchFields.map(f => 
                  SEARCH_FIELD_OPTIONS.find(o => o.value === f)?.label
                ).join(', ')}...`}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary sm:text-sm p-2.5 pl-10 pr-10"
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
              <button
                onClick={() => setShowSearchOptions(!showSearchOptions)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                title="Opções de busca"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </button>
            </div>
            
            {/* Dropdown de opções de busca */}
            {showSearchOptions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-base-700 border border-base-600 rounded-md shadow-lg z-20 p-3">
                <p className="text-xs text-gray-400 mb-2">Buscar em:</p>
                <div className="flex flex-wrap gap-2">
                  {SEARCH_FIELD_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => toggleSearchField(option.value)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        searchFields.includes(option.value)
                          ? 'bg-brand-primary text-white'
                          : 'bg-base-600 text-gray-300 hover:bg-base-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ordenação + botão Filtros */}
          <div className="flex flex-row gap-2 sm:w-auto">
            {/* Ordenação rápida */}
            <div className="flex items-center bg-base-700 rounded-md overflow-hidden flex-1 sm:flex-none">
              <select
                value={sortConfig.field}
                onChange={(e) => handleSortFieldChange(e.target.value as SortField)}
                className="bg-transparent border-none text-sm text-gray-300 py-2 pl-3 pr-1 focus:ring-0 w-full"
              >
                {SORT_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSortConfig({
                  ...sortConfig,
                  direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
                })}
                className="p-2 text-gray-400 hover:text-white"
                title={sortConfig.direction === 'asc' ? 'Ordenar decrescente' : 'Ordenar crescente'}
              >
                {sortConfig.direction === 'asc' ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          
            {/* Botão de expandir filtros */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-base-700 hover:bg-base-600 rounded-md text-gray-300 transition-colors flex-1 sm:flex-none"
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
      </div>

      {/* Filtros expandíveis */}
      <div className={`
        ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}
        transition-all duration-300 ease-in-out overflow-hidden
      `}>
        <div className="px-4 pb-4 pt-0 border-t border-base-700">
          {/* Filtros básicos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-3">
            {/* Sexo */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Sexo</label>
              <select
                value={selectedSexo}
                onChange={(e) => setSelectedSexo(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm text-sm p-2"
              >
                <option value="">Todos</option>
                {Object.values(Sexo).map(sexo => (
                  <option key={sexo} value={sexo}>{sexo}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm text-sm p-2"
              >
                <option value="">Todos</option>
                {Object.values(AnimalStatus).map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Raça */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Raça</label>
              <select
                value={selectedRaca}
                onChange={(e) => setSelectedRaca(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm text-sm p-2"
              >
                <option value="">Todas</option>
                {Object.values(Raca).map(raca => (
                  <option key={raca} value={raca}>{raca}</option>
                ))}
              </select>
            </div>

            {/* Área de Manejo */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Área de Manejo</label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm text-sm p-2"
              >
                <option value="">Todas</option>
                <option value="sem-area">Sem área</option>
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.name}</option>
                ))}
              </select>
            </div>

            {/* Medicamento */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Medicamento</label>
              <select
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm text-sm p-2"
              >
                <option value="">Todos</option>
                {allMedications.map(med => (
                  <option key={med} value={med}>{med}</option>
                ))}
              </select>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Motivo</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-md shadow-sm text-sm p-2"
              >
                <option value="">Todos</option>
                {allReasons.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle filtros avançados */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-4 text-sm text-brand-primary-light hover:text-brand-primary flex items-center gap-1"
          >
            {showAdvanced ? 'Ocultar filtros avançados' : 'Mostrar filtros avançados'}
            {showAdvanced ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>

          {/* Filtros avançados */}
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-base-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Faixa de Peso */}
                <div className="bg-base-900/50 p-3 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Faixa de Peso (kg)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Mín"
                      value={weightRange.min || ''}
                      onChange={(e) => setWeightRange({
                        ...weightRange,
                        min: e.target.value ? Number(e.target.value) : null
                      })}
                      className="w-full bg-base-700 border-base-600 rounded-md text-sm p-2"
                    />
                    <span className="text-gray-500">até</span>
                    <input
                      type="number"
                      placeholder="Máx"
                      value={weightRange.max || ''}
                      onChange={(e) => setWeightRange({
                        ...weightRange,
                        max: e.target.value ? Number(e.target.value) : null
                      })}
                      className="w-full bg-base-700 border-base-600 rounded-md text-sm p-2"
                    />
                  </div>
                  {/* Presets de peso */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <button
                      onClick={() => setWeightRange({ min: null, max: 200 })}
                      className="px-2 py-0.5 text-xs bg-base-700 hover:bg-base-600 rounded"
                    >
                      Leve (&lt;200)
                    </button>
                    <button
                      onClick={() => setWeightRange({ min: 200, max: 400 })}
                      className="px-2 py-0.5 text-xs bg-base-700 hover:bg-base-600 rounded"
                    >
                      Médio (200-400)
                    </button>
                    <button
                      onClick={() => setWeightRange({ min: 400, max: null })}
                      className="px-2 py-0.5 text-xs bg-base-700 hover:bg-base-600 rounded"
                    >
                      Pesado (&gt;400)
                    </button>
                  </div>
                </div>

                {/* Faixa de Idade */}
                <div className="bg-base-900/50 p-3 rounded-lg">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Faixa de Idade (meses)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Mín"
                      value={ageRange.minMonths || ''}
                      onChange={(e) => setAgeRange({
                        ...ageRange,
                        minMonths: e.target.value ? Number(e.target.value) : null
                      })}
                      className="w-full bg-base-700 border-base-600 rounded-md text-sm p-2"
                    />
                    <span className="text-gray-500">até</span>
                    <input
                      type="number"
                      placeholder="Máx"
                      value={ageRange.maxMonths || ''}
                      onChange={(e) => setAgeRange({
                        ...ageRange,
                        maxMonths: e.target.value ? Number(e.target.value) : null
                      })}
                      className="w-full bg-base-700 border-base-600 rounded-md text-sm p-2"
                    />
                  </div>
                  {/* Presets de idade */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {AGE_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => setAgeRange({
                          minMonths: preset.minMonths,
                          maxMonths: preset.maxMonths
                        })}
                        className="px-2 py-0.5 text-xs bg-base-700 hover:bg-base-600 rounded"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Botão Limpar */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                onClear();
                setIsExpanded(false);
                setShowAdvanced(false);
              }}
              className="bg-base-700 text-gray-300 hover:bg-base-600 font-medium py-2 px-4 rounded-md transition-colors text-sm"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
