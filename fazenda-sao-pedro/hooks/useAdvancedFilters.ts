import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Animal,
  AnimalWithCachedGMD,
  ManagementArea,
  AdvancedFilters,
  DEFAULT_ADVANCED_FILTERS,
  SortConfig,
  WeightRange,
  AgeRange,
  SearchField,
  FilteredStats,
  AnimalStatus,
  Sexo,
  GainMetrics
} from '../types';
import { debounce, DebouncedFunction } from '../utils/helpers';
import { calcularGMDAnimal } from '../utils/gmdCalculations';
import { DEBOUNCE_DELAY_MS, GMD_THRESHOLDS } from '../constants/app';
import { AnimalDerivedData } from '../services/animalMetricsService';

interface UseAdvancedFiltersProps {
  animals: Animal[];
  areas: ManagementArea[];
  // NOVO: Métricas pré-calculadas do contexto
  preCalculatedMetrics?: Map<string, AnimalDerivedData>;
}

interface UseAdvancedFiltersReturn {
  filters: AdvancedFilters;
  filteredAnimals: AnimalWithCachedGMD[]; // 🔧 OTIMIZAÇÃO #3: Inclui GMD em cache
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
  isFiltering: boolean; // 🔧 Novo: indica se está processando filtros
}

const getAgeInMonths = (birthDate: Date | undefined): number => {
  if (!birthDate) return 0;
  const now = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 0;
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
};

export const useAdvancedFilters = ({
  animals,
  areas,
  preCalculatedMetrics
}: UseAdvancedFiltersProps): UseAdvancedFiltersReturn => {
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_ADVANCED_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // 🔧 OTIMIZAÇÃO: Estados debounced para filtros numéricos
  const [debouncedWeightRange, setDebouncedWeightRange] = useState<WeightRange>({ min: null, max: null });
  const [debouncedAgeRange, setDebouncedAgeRange] = useState<AgeRange>({ minMonths: null, maxMonths: null });
  const [isFiltering, setIsFiltering] = useState(false);

  // 🔧 FIX MEMORY LEAK: Usar useRef para manter referência estável das funções debounced
  // e permitir cleanup no unmount
  const debouncedSetSearchRef = useRef<DebouncedFunction<(value: string) => void>>(
    debounce((value: string) => {
      setDebouncedSearch(value);
      setIsFiltering(false);
    }, DEBOUNCE_DELAY_MS)
  );

  // 🔧 FIX MEMORY LEAK: Debounce para filtros de peso
  const debouncedSetWeightRangeRef = useRef<DebouncedFunction<(range: WeightRange) => void>>(
    debounce((range: WeightRange) => {
      setDebouncedWeightRange(range);
      setIsFiltering(false);
    }, DEBOUNCE_DELAY_MS)
  );

  // 🔧 FIX MEMORY LEAK: Debounce para filtros de idade
  const debouncedSetAgeRangeRef = useRef<DebouncedFunction<(range: AgeRange) => void>>(
    debounce((range: AgeRange) => {
      setDebouncedAgeRange(range);
      setIsFiltering(false);
    }, DEBOUNCE_DELAY_MS)
  );

  // 🔧 FIX MEMORY LEAK: Cleanup de todas as funções debounced no unmount
  useEffect(() => {
    const searchDebounce = debouncedSetSearchRef.current;
    const weightDebounce = debouncedSetWeightRangeRef.current;
    const ageDebounce = debouncedSetAgeRangeRef.current;
    
    return () => {
      searchDebounce.cancel();
      weightDebounce.cancel();
      ageDebounce.cancel();
    };
  }, []);

  const allMedications = useMemo(() => {
    const meds = new Set<string>();
    animals.forEach(animal => {
      animal.historicoSanitario.forEach(med => {
        // Suporta novo formato (medicamentos[]) e legado (medicamento)
        if (med.medicamentos && Array.isArray(med.medicamentos)) {
          med.medicamentos.forEach(m => {
            if (m.medicamento) meds.add(m.medicamento);
          });
        } else if (med.medicamento) {
          meds.add(med.medicamento);
        }
      });
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

  // ============================================
  // OTIMIZAÇÃO: Usa métricas pré-calculadas do contexto se disponíveis
  // Senão, calcula GMD localmente (fallback)
  // ============================================
  const animalsWithCachedGMD = useMemo(() => {
    return animals.map(animal => {
      // Usa GMD pré-calculado se disponível
      const preCalc = preCalculatedMetrics?.get(animal.id);
      const gmd = preCalc?.gmd || calcularGMDAnimal(animal);

      return {
        ...animal,
        _cachedGMD: {
          gmdTotal: gmd.gmdTotal ?? null,
          gmdRecente: gmd.gmdUltimos30Dias ?? null
        }
      };
    });
  }, [animals, preCalculatedMetrics]);

  const filteredAnimals = useMemo(() => {
    let result = animalsWithCachedGMD.filter(animal => {
      // Busca avançada com operadores booleanos
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const trimmedSearch = searchLower.trim();

        const hasOr = trimmedSearch.includes(' ou ');
        const hasAnd = trimmedSearch.includes(' e ');

        // Se termina com espaço E não tem operadores booleanos,
        // busca exata no brinco (ex: "J15 " → só J15)
        const exactBrincoMatch = searchLower.endsWith(' ') && !hasOr && !hasAnd;

        let searchTerms: string[];
        let matchMode: 'or' | 'and' | 'single';

        if (hasOr) {
          searchTerms = trimmedSearch.split(' ou ').map(t => t.trim()).filter(Boolean);
          matchMode = 'or';
        } else if (hasAnd) {
          searchTerms = trimmedSearch.split(' e ').map(t => t.trim()).filter(Boolean);
          matchMode = 'and';
        } else {
          searchTerms = [trimmedSearch];
          matchMode = 'single';
        }

        const checkMatch = (term: string): boolean => {
          return filters.searchFields.some(field => {
            switch (field) {
              case 'brinco':
                return exactBrincoMatch
                  ? animal.brinco.toLowerCase() === term
                  : animal.brinco.toLowerCase().includes(term);
              case 'nome':
                return animal.nome?.toLowerCase().includes(term);
              case 'paiNome':
                return animal.paiNome?.toLowerCase().includes(term);
              case 'maeNome':
                return animal.maeNome?.toLowerCase().includes(term);
              case 'medicamento':
                return animal.historicoSanitario.some(m => {
                  // Suporta novo formato (medicamentos[]) e legado (medicamento)
                  if (m.medicamentos && Array.isArray(m.medicamentos)) {
                    return m.medicamentos.some(med =>
                      med.medicamento?.toLowerCase().includes(term)
                    );
                  }
                  return m.medicamento?.toLowerCase().includes(term);
                });
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

      // 🔧 OTIMIZAÇÃO: Usa valores debounced para peso e idade
      if (debouncedWeightRange.min !== null && animal.pesoKg < debouncedWeightRange.min) {
        return false;
      }
      if (debouncedWeightRange.max !== null && animal.pesoKg > debouncedWeightRange.max) {
        return false;
      }

      const ageInMonths = getAgeInMonths(animal.dataNascimento);
      if (debouncedAgeRange.minMonths !== null && ageInMonths < debouncedAgeRange.minMonths) {
        return false;
      }
      if (debouncedAgeRange.maxMonths !== null && ageInMonths > debouncedAgeRange.maxMonths) {
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
          const dateA = a.dataNascimento ? new Date(a.dataNascimento).getTime() : 0;
          const dateB = b.dataNascimento ? new Date(b.dataNascimento).getTime() : 0;
          comparison = dateA - dateB;
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
  }, [animalsWithCachedGMD, debouncedSearch, debouncedWeightRange, debouncedAgeRange, filters.selectedMedication, filters.selectedReason, filters.selectedStatus, filters.selectedSexo, filters.selectedRaca, filters.selectedAreaId, filters.searchFields, filters.sortConfig]);

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
          // Suporta novo formato (medicamentos[]) e legado (medicamento)
          if (m.medicamentos && Array.isArray(m.medicamentos)) {
            m.medicamentos.forEach(med => {
              if (med.medicamento) {
                medicationCounts[med.medicamento] = (medicationCounts[med.medicamento] || 0) + 1;
              }
            });
          } else if (m.medicamento) {
            medicationCounts[m.medicamento] = (medicationCounts[m.medicamento] || 0) + 1;
          }
        });
      }
    });

    const mostUsedMedication = Object.entries(medicationCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Nenhum';

    // 🔧 OTIMIZAÇÃO #3: Usar GMD em cache ao invés de recalcular
    let totalGMD = 0;
    let animalsWithGMD = 0;
    let topPerformers = 0;
    let underperformers = 0;

    activeAnimals.forEach(a => {
      // Usa _cachedGMD se disponível (já calculado no animalsWithCachedGMD)
      const gmd = (a as any)._cachedGMD?.gmdTotal ?? null;

      if (gmd && gmd > 0) {
        totalGMD += gmd;
        animalsWithGMD++;

        if (gmd >= GMD_THRESHOLDS.top) topPerformers++;
        if (gmd < GMD_THRESHOLDS.under) underperformers++;
      }
    });

    const gmdStats = {
      averageGMD: animalsWithGMD > 0 ? totalGMD / animalsWithGMD : 0,
      animalsWithGMD,
      topPerformers,
      underperformers,
    };

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
      gmdStats,
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
    setIsFiltering(true); // 🔧 Indica que está processando
    debouncedSetSearchRef.current(term);
  }, []);

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
    setIsFiltering(true); // 🔧 Indica que está processando
    debouncedSetWeightRangeRef.current(range);
  }, []);

  const setAgeRange = useCallback((range: AgeRange) => {
    setFilters(prev => ({ ...prev, ageRange: range }));
    setIsFiltering(true); // 🔧 Indica que está processando
    debouncedSetAgeRangeRef.current(range);
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
    setDebouncedWeightRange({ min: null, max: null });
    setDebouncedAgeRange({ minMonths: null, maxMonths: null });
    setIsFiltering(false);
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
    isFiltering, // 🔧 Novo: permite mostrar indicador de loading
  };
};