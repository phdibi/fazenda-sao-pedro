/**
 * Hooks de memoização otimizados
 * Evita re-renders desnecessários em componentes pesados
 */

import React, { useMemo, useCallback, useRef, useEffect, useState, DependencyList } from 'react';
import { Animal, FilteredStats, Raca, Sexo, AnimalStatus } from '../types';
import { AGE_RANGES, WEIGHT_RANGES, GMD_THRESHOLDS } from '../constants/app';
import { calculateAgeInMonths } from '../utils/dateHelpers';

/**
 * Hook para calcular estatísticas de animais com memoização profunda
 */
export const useAnimalStats = (animals: Animal[]): FilteredStats => {
    return useMemo(() => {
        if (animals.length === 0) {
            return {
                totalAnimals: 0,
                totalWeight: 0,
                averageWeight: 0,
                maleCount: 0,
                femaleCount: 0,
                activeCount: 0,
                breedDistribution: {},
                ageDistribution: { bezerros: 0, jovens: 0, novilhos: 0, adultos: 0 },
                weightRangeDistribution: { leve: 0, medio: 0, pesado: 0 },
                areaDistribution: {},
                healthStats: { totalTreatments: 0, animalsWithTreatments: 0, mostUsedMedication: '' },
            };
        }

        // Processar tudo em uma única passagem
        let totalWeight = 0;
        let maleCount = 0;
        let femaleCount = 0;
        let activeCount = 0;
        const breedDistribution: Record<string, number> = {};
        const ageDistribution = { bezerros: 0, jovens: 0, novilhos: 0, adultos: 0 };
        const weightRangeDistribution = { leve: 0, medio: 0, pesado: 0 };
        const areaDistribution: Record<string, number> = {};
        let totalTreatments = 0;
        let animalsWithTreatments = 0;
        const medicationCounts: Record<string, number> = {};

        for (const animal of animals) {
            // Peso
            totalWeight += animal.pesoKg;

            // Sexo
            if (animal.sexo === Sexo.Macho) maleCount++;
            else if (animal.sexo === Sexo.Femea) femaleCount++;

            // Status
            if (animal.status === AnimalStatus.Ativo) activeCount++;

            // Raça
            breedDistribution[animal.raca] = (breedDistribution[animal.raca] || 0) + 1;

            // Idade
            const ageMonths = calculateAgeInMonths(animal.dataNascimento);
            if (ageMonths !== null) {
                if (ageMonths <= AGE_RANGES.bezerro.max) ageDistribution.bezerros++;
                else if (ageMonths <= AGE_RANGES.jovem.max) ageDistribution.jovens++;
                else if (ageMonths <= AGE_RANGES.novilho.max) ageDistribution.novilhos++;
                else ageDistribution.adultos++;
            }

            // Faixa de peso
            if (animal.pesoKg <= WEIGHT_RANGES.leve.max) weightRangeDistribution.leve++;
            else if (animal.pesoKg <= WEIGHT_RANGES.medio.max) weightRangeDistribution.medio++;
            else weightRangeDistribution.pesado++;

            // Área
            if (animal.managementAreaId) {
                areaDistribution[animal.managementAreaId] = 
                    (areaDistribution[animal.managementAreaId] || 0) + 1;
            }

            // Saúde
            const treatments = animal.historicoSanitario?.length || 0;
            totalTreatments += treatments;
            if (treatments > 0) {
                animalsWithTreatments++;
                animal.historicoSanitario?.forEach(med => {
                    // Suporta novo formato (medicamentos[]) e legado (medicamento)
                    if (med.medicamentos && Array.isArray(med.medicamentos)) {
                        med.medicamentos.forEach(m => {
                            if (m.medicamento) {
                                medicationCounts[m.medicamento] =
                                    (medicationCounts[m.medicamento] || 0) + 1;
                            }
                        });
                    } else if (med.medicamento) {
                        medicationCounts[med.medicamento] =
                            (medicationCounts[med.medicamento] || 0) + 1;
                    }
                });
            }
        }

        // Medicamento mais usado
        const mostUsedMedication = Object.entries(medicationCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        return {
            totalAnimals: animals.length,
            totalWeight,
            averageWeight: animals.length > 0 ? totalWeight / animals.length : 0,
            maleCount,
            femaleCount,
            activeCount,
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
    }, [animals]);
};

/**
 * Hook para filtrar animais com debounce
 */
export const useFilteredAnimals = (
    animals: Animal[],
    filters: {
        searchTerm?: string;
        status?: string;
        sexo?: string;
        raca?: string;
        areaId?: string;
        weightMin?: number;
        weightMax?: number;
        ageMinMonths?: number;
        ageMaxMonths?: number;
    }
): Animal[] => {
    return useMemo(() => {
        let result = animals;

        // Search term
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            result = result.filter(a => 
                a.brinco.toLowerCase().includes(term) ||
                a.nome?.toLowerCase().includes(term) ||
                a.paiNome?.toLowerCase().includes(term) ||
                a.maeNome?.toLowerCase().includes(term)
            );
        }

        // Status
        if (filters.status) {
            result = result.filter(a => a.status === filters.status);
        }

        // Sexo
        if (filters.sexo) {
            result = result.filter(a => a.sexo === filters.sexo);
        }

        // Raça
        if (filters.raca) {
            result = result.filter(a => a.raca === filters.raca);
        }

        // Área
        if (filters.areaId) {
            result = result.filter(a => a.managementAreaId === filters.areaId);
        }

        // Peso
        if (filters.weightMin !== undefined) {
            result = result.filter(a => a.pesoKg >= filters.weightMin!);
        }
        if (filters.weightMax !== undefined) {
            result = result.filter(a => a.pesoKg <= filters.weightMax!);
        }

        // Idade
        if (filters.ageMinMonths !== undefined || filters.ageMaxMonths !== undefined) {
            result = result.filter(a => {
                const age = calculateAgeInMonths(a.dataNascimento);
                if (age === null) return false;
                if (filters.ageMinMonths !== undefined && age < filters.ageMinMonths) return false;
                if (filters.ageMaxMonths !== undefined && age > filters.ageMaxMonths) return false;
                return true;
            });
        }

        return result;
    }, [animals, filters]);
};

/**
 * Hook para ordenar animais
 */
export const useSortedAnimals = (
    animals: Animal[],
    sortField: string,
    sortDirection: 'asc' | 'desc'
): Animal[] => {
    return useMemo(() => {
        const sorted = [...animals].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case 'brinco':
                    comparison = a.brinco.localeCompare(b.brinco, 'pt-BR', { numeric: true });
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
                default:
                    comparison = 0;
            }

            return sortDirection === 'desc' ? -comparison : comparison;
        });

        return sorted;
    }, [animals, sortField, sortDirection]);
};

/**
 * Hook para debounce de valores
 */
export const useDebouncedValue = <T>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Hook para callback com debounce
 */
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
    callback: T,
    delay: number,
    deps: DependencyList = []
): T => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const debouncedCallback = useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            callback(...args);
        }, delay);
    }, [callback, delay, ...deps]) as T;

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
};

/**
 * Hook para comparação profunda de dependências
 * Útil para objetos complexos que mudam de referência mas não de valor
 */
export const useDeepCompareMemo = <T>(
    factory: () => T,
    deps: DependencyList
): T => {
    const ref = useRef<DependencyList>();

    if (!ref.current || !deepEqual(deps, ref.current)) {
        ref.current = deps;
    }

    return useMemo(factory, ref.current);
};

// Helper para comparação profunda
const deepEqual = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => deepEqual(item, b[index]));
    }

    if (typeof a === 'object') {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => deepEqual(a[key], b[key]));
    }

    return false;
};
