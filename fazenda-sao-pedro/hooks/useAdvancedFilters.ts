import { useState, useMemo, useCallback } from 'react';
import { 
  Animal, 
  ManagementArea,
  AdvancedFilters, 
  DEFAULT_ADVANCED_FILTERS,
  SortConfig,
  WeightRange,
  AgeRange,
  SearchField,
  FilteredStats,
  AnimalStatus,
  Sexo
} from '../types';
import { debounce } from '../utils/helpers';

interface UseAdvancedFiltersProps {
  animals: Animal[];
  areas: ManagementArea[];
}

interface UseAdvancedFiltersReturn {
  // Estado dos filtros
  filters: AdvancedFilters;
  
  // Animais filtrados
  filteredAnimals: Animal[];
  
  // Estatísticas baseadas nos filtros
  stats: FilteredStats;
  
  // Setters individuais
  setSearchTerm: (term: string) => void;
  setSelectedMedication: (med: string) => void;
  setSelectedReason: (reason: string) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedSexo: (sexo: string) => void;
  setSelectedRaca: (raca: string) => void;
  setSelectedAreaId: (areaId: string) => void;
  setWeightRange: (range: WeightRange) => void;
  setAgeRange: (range: AgeRange) => void;
  setSearchFields: (fields: SearchField[]) => void;
  setSortConfig: (config: SortConfig) => void;
  
  // Utilitários
  clearAllFilters: () => void;
  activeFiltersCount: number;
  
  // Dados auxiliares para selects
  allMedications: string[];
  allReasons: string[];
}

// Calcula idade em meses
const getAgeInMonths = (birthDate: Date): number => {
  const now = new Date();
  const birth = new Date(birthDate);
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
};

export const useAdvancedFilters = ({ 
  animals, 
  areas 
}: UseAdvancedFiltersProps): UseAdvancedFiltersReturn => {
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce para busca
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  // Extrair medicamentos únicos
  const allMedications = useMemo(() => {
    const meds = new Set<string>();
    animals.forEach(animal => {
      animal.historicoSanitario.forEach(med => meds.add(med.medicamento));
    });
    return Array.from(meds).sort();
  }, [animals]);

  // Extrair motivos únicos
  const allReasons = useMemo(() => {
    const reasons = new Set<string>();
    animals.forEach(animal => {
      animal.historicoSanitario.forEach(med => reasons.add(med.motivo));
    });
    return Array.from(reasons).sort();
  }, [animals]);

  // Aplicar filtros e ordenação
  const filteredAnimals = useMemo(() => {
    let result = animals.filter(animal => {
      // Busca avançada em múltiplos campos
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const matchesSearch = filters.searchFields.some(field => {
          switch (field) {
            case 'brinco':
              return animal.brinco.toLowerCase().includes(searchLower);
            case 'nome':
              return animal.nome?.toLowerCase().includes(searchLower);
            case 'paiNome':
              return animal.paiNome?.toLowerCase().includes(searchLower);
            case 'maeNome':
              return animal.maeNome?.toLowerCase().includes(searchLower);
            case 'medicamento':
              return animal.historicoSanitario.some(m => 
                m.medicamento.toLowerCase().includes(searchLower)
              );
            case 'motivo':
              return animal.historicoSanitario.some(m => 
                m.motivo.toLowerCase().includes(searchLower)
              );
            default:
              return false;
          }
        });
        if (!matchesSearch) return false;
      }

      // Filtro por medicamento
      if (filters.selectedMedication) {
        const hasMed = animal.historicoSanitario.some(
          med => med.medicamento === filters.selectedMedication
        );
        if (!hasMed) return false;
      }

      // Filtro por motivo
      if (filters.selectedReason) {
        const hasReason = animal.historicoSanitario.some(
          med => med.motivo === filters.selectedReason
        );
        if (!hasReason) return false;
      }

      // Filtro por status
      if (filters.selectedStatus && animal.status !== filters.selectedStatus) {
        return false;
      }

      // Filtro por sexo
      if (filters.selectedSexo && animal.sexo !== filters.selectedSexo) {
        return false;
      }

      // Filtro por raça
      if (filters.selectedRaca && animal.raca !== filters.selectedRaca) {
        return false;
      }

      // Filtro por área de manejo
      if (filters.selectedAreaId) {
        if (filters.selectedAreaId === 'sem-area') {
          if (animal.managementAreaId) return false;
        } else if (animal.managementAreaId !== filters.selectedAreaId) {
          return false;
        }
      }

      // Filtro por faixa de peso
      if (filters.weightRange.min !== null && animal.pesoKg < filters.weightRange.min) {
        return false;
      }
      if (filters.weightRange.max !== null && animal.pesoKg > filters.weightRange.max) {
        return false;
      }

      // Filtro por idade
      const ageInMonths = getAgeInMonths(animal.dataNascimento);
      if (filters.ageRange.minMonths !== null && ageInMonths < filters.ageRange.minMonths) {
        return false;
      }
      if (filters.ageRange.maxMonths !== null && ageInMonths > filters.ageRange.maxMonths) {
        return false;
      }

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      const { field, direction } = filters.sortConfig;
      let comparison = 0;

      switch (field) {
        case 'brinco':
          comparison = a.brinco.localeCompare(b.brinco);
          break;
        case 'nome':
          comparison = (a.nome || '').localeCompare(b.nome || '');
          break;
        case 'pesoKg':
          comparison = a.pesoKg - b.pesoKg;
          break;
        case 'dataNascimento':
          comparison = new Date(a.dataNascimento).getTime() - new Date(b.dataNascimento).getTime();
          break;
        case 'raca':
          comparison = a.raca.localeCompare(b.raca);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [animals, debouncedSearch, filters]);

  // Calcular estatísticas baseadas nos animais filtrados
  const stats = useMemo((): FilteredStats => {
    const activeAnimals = filteredAnimals.filter(a => a.status === AnimalStatus.Ativo);
    
    const totalWeight = activeAnimals.reduce((sum, a) => sum + a.pesoKg, 0);
    const maleCount = activeAnimals.filter(a => a.sexo === Sexo.Macho).length;
    const femaleCount = activeAnimals.filter(a => a.sexo === Sexo.Femea).length;

    // Distribuição por raça
    const breedDistribution: Record<string, number> = {};
    activeAnimals.forEach(a => {
      breedDistribution[a.raca] = (breedDistribution[a.raca] || 0) + 1;
    });

    // Distribuição por idade
    const ageDistribution = { bezerros: 0, jovens: 0, novilhos: 0, adultos: 0 };
    activeAnimals.forEach(a => {
      const ageMonths = getAgeInMonths(a.dataNascimento);
      if (ageMonths <= 6) ageDistribution.bezerros++;
      else if (ageMonths <= 12) ageDistribution.jovens++;
      else if (ageMonths <= 24) ageDistribution.novilhos++;
      else ageDistribution.adultos++;
    });

    // Distribuição por faixa de peso
    const weightRangeDistribution = { leve: 0, medio: 0, pesado: 0 };
    activeAnimals.forEach(a => {
      if (a.pesoKg < 200) weightRangeDistribution.leve++;
      else if (a.pesoKg <= 400) weightRangeDistribution.medio++;
      else weightRangeDistribution.pesado++;
    });

    // Distribuição por área
    const areaDistribution: Record<string, number> = {};
    activeAnimals.forEach(a => {
      const areaName = a.managementAreaId 
        ? areas.find(ar => ar.id === a.managementAreaId)?.name || 'Área Desconhecida'
        : 'Sem Área';
      areaDistribution[areaName] = (areaDistribution[areaName] || 0) + 1;
    });

    // Estatísticas de saúde
    let totalTreatments = 0;
    let animalsWithTreatments = 0;
    const medicationCounts: Record<string, number> = {};
    
    filteredAnimals.forEach(a => {
      if (a.historicoSanitario.length > 0) {
        animalsWithTreatments++;
        totalTreatments += a.historicoSanitario.length;
        a.historicoSanitario.forEach(m => {
          medicationCounts[m.medicamento] = (medicationCounts[m.medicamento] || 0) + 1;
        });
      }
    });

    const mostUsedMedication = Object.entries(medicationCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Nenhum';

    return {
      totalAnimals: filteredAnimals.length,
      totalWeight,
      averageWeight: activeAnimals.length > 0 ? totalWeight / activeAnimals.length : 0,
      maleCount,
      femaleCount,
      activeCount: activeAnimals.length,
      breedDistribution,
      ageDistribution,
      weightRangeDistribution,
      areaDistribution,
      healthStats: {
        totalTreatments,
        animalsWithTreatments,
        mostUsedMedication,
      },
    };
  }, [filteredAnimals, areas]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.searchTerm) count++;
    if (filters.selectedMedication) count++;
    if (filters.selectedReason) count++;
    if (filters.selectedStatus) count++;
    if (filters.selectedSexo) count++;
    if (filters.selectedRaca) count++;
    if (filters.selectedAreaId) count++;
    if (filters.weightRange.min !== null || filters.weightRange.max !== null) count++;
    if (filters.ageRange.minMonths !== null || filters.ageRange.maxMonths !== null) count++;
    return count;
  }, [filters]);

  // Setters
  const setSearchTerm = useCallback((term: string) => {
    setFilters(prev => ({ ...prev, searchTerm: term }));
    debouncedSetSearch(term);
  }, [debouncedSetSearch]);

  const setSelectedMedication = useCallback((med: string) => {
    setFilters(prev => ({ ...prev, selectedMedication: med }));
  }, []);

  const setSelectedReason = useCallback((reason: string) => {
    setFilters(prev => ({ ...prev, selectedReason: reason }));
  }, []);

  const setSelectedStatus = useCallback((status: string) => {
    setFilters(prev => ({ ...prev, selectedStatus: status }));
  }, []);

  const setSelectedSexo = useCallback((sexo: string) => {
    setFilters(prev => ({ ...prev, selectedSexo: sexo }));
  }, []);

  const setSelectedRaca = useCallback((raca: string) => {
    setFilters(prev => ({ ...prev, selectedRaca: raca }));
  }, []);

  const setSelectedAreaId = useCallback((areaId: string) => {
    setFilters(prev => ({ ...prev, selectedAreaId: areaId }));
  }, []);

  const setWeightRange = useCallback((range: WeightRange) => {
    setFilters(prev => ({ ...prev, weightRange: range }));
  }, []);

  const setAgeRange = useCallback((range: AgeRange) => {
    setFilters(prev => ({ ...prev, ageRange: range }));
  }, []);

  const setSearchFields = useCallback((fields: SearchField[]) => {
    setFilters(prev => ({ ...prev, searchFields: fields }));
  }, []);

  const setSortConfig = useCallback((config: SortConfig) => {
    setFilters(prev => ({ ...prev, sortConfig: config }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_ADVANCED_FILTERS);
    setDebouncedSearch('');
  }, []);

  return {
    filters,
    filteredAnimals,
    stats,
    setSearchTerm,
    setSelectedMedication,
    setSelectedReason,
    setSelectedStatus,
    setSelectedSexo,
    setSelectedRaca,
    setSelectedAreaId,
    setWeightRange,
    setAgeRange,
    setSearchFields,
    setSortConfig,
    clearAllFilters,
    activeFiltersCount,
    allMedications,
    allReasons,
  };
};