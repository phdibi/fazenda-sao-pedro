import React, { useState, useRef, useEffect } from 'react';
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
const SearchIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className || 'w-4 h-4'}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const AdjustmentsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || 'w-5 h-5'}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
  </svg>
);

interface FilterBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchFields: SearchField[];
  setSearchFields: (fields: SearchField[]) => void;
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
  selectedRaca: string;
  setSelectedRaca: (raca: string) => void;
  selectedAreaId: string;
  setSelectedAreaId: (areaId: string) => void;
  areas: ManagementArea[];
  weightRange: WeightRange;
  setWeightRange: (range: WeightRange) => void;
  ageRange: AgeRange;
  setAgeRange: (range: AgeRange) => void;
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  onClear: () => void;
  activeFiltersCount: number;
  isFiltering?: boolean;
}

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'brinco', label: 'Brinco' },
  { value: 'nome', label: 'Nome' },
  { value: 'pesoKg', label: 'Peso' },
  { value: 'dataNascimento', label: 'Idade' },
  { value: 'raca', label: 'Raça' },
  { value: 'status', label: 'Status' },
];

// ============================================
// 🔧 DROPDOWN CHIP - Chip com dropdown
// ============================================
interface DropdownChipProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
}

const DropdownChip: React.FC<DropdownChipProps> = ({ label, value, options, onChange, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = value !== '';
  const displayLabel = isActive 
    ? options.find(o => o.value === value)?.label || value 
    : label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200 whitespace-nowrap
          ${isActive 
            ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' 
            : 'bg-base-700 text-gray-300 hover:bg-base-600 hover:text-white'
          }
        `}
      >
        {icon}
        <span>{displayLabel}</span>
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {isActive && (
          <span 
            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
            className="ml-1 hover:bg-white/20 rounded-full p-0.5"
          >
            <XIcon className="w-3 h-3" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-base-800 border border-base-600 rounded-lg shadow-xl z-50 min-w-[160px] py-1 max-h-60 overflow-y-auto">
          <button
            onClick={() => { onChange(''); setIsOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-base-700 ${!value ? 'text-brand-primary-light' : 'text-gray-300'}`}
          >
            Todos
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-base-700 ${value === opt.value ? 'text-brand-primary-light bg-base-700' : 'text-gray-300'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// 🔧 MAIN FILTER BAR COMPONENT
// ============================================
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
  isFiltering = false,
}: FilterBarProps) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSortFieldChange = (field: SortField) => {
    if (sortConfig.field === field) {
      setSortConfig({
        field,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ field, direction: 'asc' });
    }
  };

  // Status options
  const statusOptions = Object.values(AnimalStatus).map(s => ({ value: s, label: s }));
  const sexoOptions = Object.values(Sexo).map(s => ({ value: s, label: s }));
  const racaOptions = Object.values(Raca).map(r => ({ value: r, label: r }));
  const areaOptions = [
    { value: 'sem-area', label: 'Sem área' },
    ...areas.map(a => ({ value: a.id, label: a.name }))
  ];

  return (
    <div className="mb-4 space-y-3">
      {/* Barra de busca compacta */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar animal..."
            className="w-full bg-base-800 border border-base-700 rounded-xl py-2.5 pl-10 pr-4 text-sm
                       focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary
                       placeholder:text-gray-500 transition-all"
          />
          {isFiltering && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {searchTerm && !isFiltering && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Botão de filtros avançados */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`
            relative p-2.5 rounded-xl border transition-all
            ${showAdvanced || activeFiltersCount > 0
              ? 'bg-brand-primary border-brand-primary text-white'
              : 'bg-base-800 border-base-700 text-gray-400 hover:text-white hover:border-base-600'
            }
          `}
        >
          <AdjustmentsIcon className="w-5 h-5" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Chips de filtro rápido - Scroll horizontal no mobile */}
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Status */}
        <DropdownChip
          label="Status"
          value={selectedStatus}
          options={statusOptions}
          onChange={setSelectedStatus}
          icon={<span className="w-2 h-2 rounded-full bg-emerald-400" />}
        />

        {/* Sexo */}
        <DropdownChip
          label="Sexo"
          value={selectedSexo}
          options={sexoOptions}
          onChange={setSelectedSexo}
        />

        {/* Raça */}
        <DropdownChip
          label="Raça"
          value={selectedRaca}
          options={racaOptions}
          onChange={setSelectedRaca}
        />

        {/* Área */}
        {areas.length > 0 && (
          <DropdownChip
            label="Área"
            value={selectedAreaId}
            options={areaOptions}
            onChange={setSelectedAreaId}
          />
        )}

        {/* Ordenação */}
        <DropdownChip
          label="Ordenar"
          value={sortConfig.field}
          options={SORT_FIELDS}
          onChange={(v) => handleSortFieldChange(v as SortField)}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d={sortConfig.direction === 'asc' 
                  ? "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                } 
              />
            </svg>
          }
        />

        {/* Limpar filtros */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                       bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all whitespace-nowrap"
          >
            <XIcon className="w-3 h-3" />
            Limpar ({activeFiltersCount})
          </button>
        )}
      </div>

      {/* Painel de filtros avançados */}
      {showAdvanced && (
        <div className="bg-base-800 rounded-xl p-4 border border-base-700 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Medicamento */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Medicamento</label>
              <select
                value={selectedMedication}
                onChange={(e) => setSelectedMedication(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-lg text-sm p-2.5"
              >
                <option value="">Todos</option>
                {allMedications.map(med => (
                  <option key={med} value={med}>{med}</option>
                ))}
              </select>
            </div>

            {/* Motivo */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Motivo</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full bg-base-700 border-base-600 rounded-lg text-sm p-2.5"
              >
                <option value="">Todos</option>
                {allReasons.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>

            {/* Faixa de Peso */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Peso (kg)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Mín"
                  value={weightRange.min || ''}
                  onChange={(e) => setWeightRange({
                    ...weightRange,
                    min: e.target.value ? Number(e.target.value) : null
                  })}
                  className="w-full bg-base-700 border-base-600 rounded-lg text-sm p-2.5"
                />
                <span className="text-gray-500 text-sm">-</span>
                <input
                  type="number"
                  placeholder="Máx"
                  value={weightRange.max || ''}
                  onChange={(e) => setWeightRange({
                    ...weightRange,
                    max: e.target.value ? Number(e.target.value) : null
                  })}
                  className="w-full bg-base-700 border-base-600 rounded-lg text-sm p-2.5"
                />
              </div>
            </div>

            {/* Faixa de Idade */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Idade (meses)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Mín"
                  value={ageRange.minMonths || ''}
                  onChange={(e) => setAgeRange({
                    ...ageRange,
                    minMonths: e.target.value ? Number(e.target.value) : null
                  })}
                  className="w-full bg-base-700 border-base-600 rounded-lg text-sm p-2.5"
                />
                <span className="text-gray-500 text-sm">-</span>
                <input
                  type="number"
                  placeholder="Máx"
                  value={ageRange.maxMonths || ''}
                  onChange={(e) => setAgeRange({
                    ...ageRange,
                    maxMonths: e.target.value ? Number(e.target.value) : null
                  })}
                  className="w-full bg-base-700 border-base-600 rounded-lg text-sm p-2.5"
                />
              </div>
            </div>
          </div>

          {/* Presets rápidos */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-base-700">
            <span className="text-xs text-gray-500 self-center mr-2">Atalhos:</span>
            <button
              onClick={() => setWeightRange({ min: null, max: 200 })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Leve (&lt;200kg)
            </button>
            <button
              onClick={() => setWeightRange({ min: 200, max: 400 })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Médio (200-400kg)
            </button>
            <button
              onClick={() => setWeightRange({ min: 400, max: null })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Pesado (&gt;400kg)
            </button>
            <span className="text-base-600">|</span>
            <button
              onClick={() => setAgeRange({ minMonths: 0, maxMonths: 6 })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Bezerros
            </button>
            <button
              onClick={() => setAgeRange({ minMonths: 6, maxMonths: 12 })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Jovens
            </button>
            <button
              onClick={() => setAgeRange({ minMonths: 12, maxMonths: 24 })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Novilhos
            </button>
            <button
              onClick={() => setAgeRange({ minMonths: 24, maxMonths: null })}
              className="px-2 py-1 text-xs bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Adultos
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
