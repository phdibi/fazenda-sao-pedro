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
import { calcularGMDMedio } from '../gmdCalculations';

interface UseAdvancedFiltersProps {
  animals: Animal[];
  areas: ManagementArea[];
}

interface UseAdvancedFiltersReturn {
  filters: AdvancedFilters;
  filteredAnimals: Animal[];
  stats: FilteredStats;
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
  clearAllFilters: () => void;
  activeFiltersCount: number;
  allMedications: string[];
  allReasons: string[];
}

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

  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => setDebouncedSearch(value), 300),
    []
  );

  const allMedications = useMemo(() => {
    const meds = new Set<string>();
    animals.forEach(animal => {
      animal.historicoSanitario.forEach(med => meds.add(med.medicamento));
    });
    return Array.from(meds).sort();
  }, [animals]);

  const allReasons = useMemo(() => {
    const reasons = new Set<string>();
    animals.forEach(animal => {
      animal.historicoSanitario.forEach(med => reasons.add(med.motivo));
    });
    return Array.from(reasons).sort();
  }, [animals]);

  const filteredAnimals = useMemo(() => {
    let result = animals.filter(animal => {
      // Busca avançada com operadores booleanos
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase().trim();
        
        const hasOr = searchLower.includes(' ou ');
        const hasAnd = searchLower.includes(' e ');
        
        let searchTerms: string[];
        let matchMode: 'or' | 'and' | 'single';
        
        if (hasOr) {
          searchTerms = searchLower.split(' ou ').map(t => t.trim()).filter(Boolean);
          matchMode = 'or';
        } else if (hasAnd) {
          searchTerms = searchLower.split(' e ').map(t => t.trim()).filter(Boolean);
          matchMode = 'and';
        } else {
          searchTerms = [searchLower];
          matchMode = 'single';
        }

        const checkMatch = (term: string): boolean => {
          return filters.searchFields.some(field => {
            switch (field) {
              case 'brinco':
                return animal.brinco.toLowerCase().includes(term);
              case 'nome':
                return animal.nome?.toLowerCase().includes(term);
              case 'paiNome':
                return animal.paiNome?.toLowerCase().includes(term);
              case 'maeNome':
                return animal.maeNome?.toLowerCase().includes(term);
              case 'medicamento':
                return animal.historicoSanitario.some(m => 
                  m.medicamento.toLowerCase().includes(term)
                );
              case 'motivo':
                return animal.historicoSanitario.some(m => 
                  m.motivo.toLowerCase().includes(term)
                );
              default:
                return false;
            }
          });
        };

        let matchesSearch: boolean;
        if (matchMode === 'or') {
          matchesSearch = searchTerms.some(term => checkMatch(term));
        } else if (matchMode === 'and') {
          matchesSearch = searchTerms.every(term => checkMatch(term));
        } else {
          matchesSearch = checkMatch(searchTerms[0]);
        }

        if (!matchesSearch) return false;
      }

      if (filters.selectedMedication) {
        const hasMed = animal.historicoSanitario.some(
          med => med.medicamento === filters.selectedMedication
        );
        if (!hasMed) return false;
      }

      if (filters.selectedReason) {
        const hasReason = animal.historicoSanitario.some(
          med => med.motivo === filters.selectedReason
        );
        if (!hasReason) return false;
      }

      if (filters.selectedStatus && animal.status !== filters.selectedStatus) {
        return false;
      }

      if (filters.selectedSexo && animal.sexo !== filters.selectedSexo) {
        return false;
      }

      if (filters.selectedRaca && animal.raca !== filters.selectedRaca) {
        return false;
      }

      if (filters.selectedAreaId) {
        if (filters.selectedAreaId === 'sem-area') {
          if (animal.managementAreaId) return false;
        } else if (animal.managementAreaId !== filters.selectedAreaId) {
          return false;
        }
      }

      if (filters.weightRange.min !== null && animal.pesoKg < filters.weightRange.min) {
        return false;
      }
      if (filters.weightRange.max !== null && animal.pesoKg > filters.weightRange.max) {
        return false;
      }

      const ageInMonths = getAgeInMonths(animal.dataNascimento);
      if (filters.ageRange.minMonths !== null && ageInMonths < filters.ageRange.minMonths) {
        return false;
      }
      if (filters.ageRange.maxMonths !== null && ageInMonths > filters.ageRange.maxMonths) {
        return false;
      }

      return true;
    });

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

  const stats = useMemo((): FilteredStats => {
    const activeAnimals = filteredAnimals.filter(a => a.status === AnimalStatus.Ativo);
    
    const totalWeight = activeAnimals.reduce((sum, a) => sum + a.pesoKg, 0);
    const maleCount = activeAnimals.filter(a => a.sexo === Sexo.Macho).length;
    const femaleCount = activeAnimals.filter(a => a.sexo === Sexo.Femea).length;

    const breedDistribution: Record<string, number> = {};
    activeAnimals.forEach(a => {
      breedDistribution[a.raca] = (breedDistribution[a.raca] || 0) + 1;
    });

    const ageDistribution = { bezerros: 0, jovens: 0, novilhos: 0, adultos: 0 };
    activeAnimals.forEach(a => {
      const ageMonths = getAgeInMonths(a.dataNascimento);
      if (ageMonths <= 6) ageDistribution.bezerros++;
      else if (ageMonths <= 12) ageDistribution.jovens++;
      else if (ageMonths <= 24) ageDistribution.novilhos++;
      else ageDistribution.adultos++;
    });

    const weightRangeDistribution = { leve: 0, medio: 0, pesado: 0 };
    activeAnimals.forEach(a => {
      if (a.pesoKg < 200) weightRangeDistribution.leve++;
      else if (a.pesoKg <= 400) weightRangeDistribution.medio++;
      else weightRangeDistribution.pesado++;
    });

    const areaDistribution: Record<string, number> = {};
    activeAnimals.forEach(a => {
      const areaName = a.managementAreaId 
        ? areas.find(ar => ar.id === a.managementAreaId)?.name || 'Área Desconhecida'
        : 'Sem Área';
      areaDistribution[areaName] = (areaDistribution[areaName] || 0) + 1;
    });

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

    // Evolução de peso (média mensal e tendência)
    const allWeighings = activeAnimals.flatMap(a => a.historicoPesagens || []);
    const monthlyMap = new Map<string, { total: number; count: number; label: string; sortDate: Date }>();

    allWeighings.forEach(weighing => {
      const date = new Date(weighing.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          total: 0,
          count: 0,
          label: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          sortDate: new Date(date.getFullYear(), date.getMonth(), 1),
        });
      }

      const monthData = monthlyMap.get(key)!;
      monthData.total += weighing.weightKg;
      monthData.count += 1;
    });

    const monthlyAverage = Array.from(monthlyMap.values())
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .map(({ total, count, label }) => ({
        label,
        value: Number((total / count).toFixed(1)),
      }));

    const avgGMD = calcularGMDMedio(activeAnimals);
    const latestAvg = monthlyAverage[monthlyAverage.length - 1]?.value || (activeAnimals.length > 0 ? Number((totalWeight / activeAnimals.length).toFixed(1)) : 0);
    const previousAvg = monthlyAverage[monthlyAverage.length - 2]?.value || latestAvg;
    const recentChange = Number((latestAvg - previousAvg).toFixed(1));
    const predictedNextMonth = Number((latestAvg + avgGMD * 30).toFixed(1));

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
      weightEvolution: {
        monthlyAverage,
        avgGMD,
        totalWeighings: allWeighings.length,
        recentChange,
        predictedNextMonth,
      },
    };
  }, [filteredAnimals, areas]);

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