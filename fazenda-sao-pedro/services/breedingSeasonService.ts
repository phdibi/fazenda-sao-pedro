/**
 * 🔧 Breeding Season Service - Estação de Monta Digital
 *
 * Gerencia estações de monta com:
 * - Controle de vacas expostas
 * - Registro de coberturas (natural, IA, IATF, TE)
 * - Diagnóstico de gestação
 * - Métricas de eficiência reprodutiva
 */

import {
  BreedingSeason,
  BreedingSeasonStatus,
  CoverageRecord,
  CoverageType,
  Animal,
  Sexo,
} from '../types';

// ============================================
// HELPERS
// ============================================

/**
 * Calcula data prevista de parto (283 dias de gestação para bovinos)
 */
export const calculateExpectedCalvingDate = (coverageDate: Date): Date => {
  const date = new Date(coverageDate);
  date.setDate(date.getDate() + 283);
  return date;
};

/**
 * Calcula dias de gestação
 */
export const calculateGestationDays = (coverageDate: Date): number => {
  const now = new Date();
  const coverage = new Date(coverageDate);
  return Math.floor((now.getTime() - coverage.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Gera ID único
 */
const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// MÉTRICAS DA ESTAÇÃO DE MONTA
// ============================================

export interface BreedingSeasonMetrics {
  totalExposed: number;
  totalCovered: number;
  totalPregnant: number;
  totalEmpty: number;
  totalPending: number;
  pregnancyRate: number;
  serviceRate: number;
  conceptionRate: number;
  coveragesByType: Record<CoverageType, number>;
  coveragesByBull: { bullId: string; bullBrinco: string; count: number; pregnancies: number }[];
  dailyCoverages: { date: string; count: number }[];
  pregnancyChecksDue: { cowId: string; cowBrinco: string; dueDate: Date }[];
}

/**
 * Calcula métricas da estação de monta
 */
export const calculateBreedingMetrics = (
  season: BreedingSeason,
  animals: Animal[]
): BreedingSeasonMetrics => {
  const coverages = season.coverageRecords || [];
  const exposedCowIds = season.exposedCowIds || [];

  // Contagem básica
  const totalExposed = exposedCowIds.length;
  const coveredCowIds = new Set(coverages.map((c) => c.cowId));
  const totalCovered = coveredCowIds.size;

  // Resultados de prenhez
  const pregnantCowIds = new Set(
    coverages.filter((c) => c.pregnancyResult === 'positive').map((c) => c.cowId)
  );
  const emptyCowIds = new Set(
    coverages.filter((c) => c.pregnancyResult === 'negative').map((c) => c.cowId)
  );
  const pendingCowIds = new Set(
    coverages.filter((c) => c.pregnancyResult === 'pending' || !c.pregnancyResult).map((c) => c.cowId)
  );

  const totalPregnant = pregnantCowIds.size;
  const totalEmpty = emptyCowIds.size;
  const totalPending = pendingCowIds.size;

  // Taxas
  const pregnancyRate = totalExposed > 0 ? (totalPregnant / totalExposed) * 100 : 0;
  const serviceRate = totalExposed > 0 ? (totalCovered / totalExposed) * 100 : 0;
  const conceptionRate = totalCovered > 0 ? (totalPregnant / totalCovered) * 100 : 0;

  // Coberturas por tipo
  const coveragesByType: Record<CoverageType, number> = {
    natural: 0,
    ia: 0,
    iatf: 0,
    te: 0,
  };
  coverages.forEach((c) => {
    coveragesByType[c.type]++;
  });

  // Coberturas por touro
  const bullStats = new Map<
    string,
    { bullId: string; bullBrinco: string; count: number; pregnancies: number }
  >();
  coverages.forEach((c) => {
    const bullKey = c.bullId || c.semenCode || 'desconhecido';
    const existing = bullStats.get(bullKey) || {
      bullId: c.bullId || '',
      bullBrinco: c.bullBrinco || c.semenCode || 'Desconhecido',
      count: 0,
      pregnancies: 0,
    };
    existing.count++;
    if (c.pregnancyResult === 'positive') {
      existing.pregnancies++;
    }
    bullStats.set(bullKey, existing);
  });
  const coveragesByBull = Array.from(bullStats.values()).sort((a, b) => b.count - a.count);

  // Coberturas por dia
  const dailyMap = new Map<string, number>();
  coverages.forEach((c) => {
    const dateKey = new Date(c.date).toISOString().split('T')[0];
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
  });
  const dailyCoverages = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Diagnósticos pendentes
  const pregnancyChecksDue: { cowId: string; cowBrinco: string; dueDate: Date }[] = [];
  const checkDays = season.config?.pregnancyCheckDays || 60;

  coverages.forEach((c) => {
    if (!c.pregnancyResult || c.pregnancyResult === 'pending') {
      const gestationDays = calculateGestationDays(c.date);
      if (gestationDays >= checkDays) {
        pregnancyChecksDue.push({
          cowId: c.cowId,
          cowBrinco: c.cowBrinco,
          dueDate: new Date(new Date(c.date).getTime() + checkDays * 24 * 60 * 60 * 1000),
        });
      }
    }
  });

  return {
    totalExposed,
    totalCovered,
    totalPregnant,
    totalEmpty,
    totalPending,
    pregnancyRate: Math.round(pregnancyRate * 10) / 10,
    serviceRate: Math.round(serviceRate * 10) / 10,
    conceptionRate: Math.round(conceptionRate * 10) / 10,
    coveragesByType,
    coveragesByBull,
    dailyCoverages,
    pregnancyChecksDue,
  };
};

// ============================================
// OPERAÇÕES DA ESTAÇÃO DE MONTA
// ============================================

/**
 * Cria uma nova estação de monta
 */
export const createBreedingSeason = (
  userId: string,
  name: string,
  startDate: Date,
  endDate: Date,
  config?: Partial<BreedingSeason['config']>
): Omit<BreedingSeason, 'id'> => {
  return {
    userId,
    name,
    startDate,
    endDate,
    status: 'planning',
    bulls: [],
    exposedCowIds: [],
    coverageRecords: [],
    config: {
      useIATF: false,
      pregnancyCheckDays: 60,
      targetPregnancyRate: 85,
      ...config,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

/**
 * Adiciona vacas expostas à estação
 */
export const addExposedCows = (
  season: BreedingSeason,
  cowIds: string[]
): BreedingSeason => {
  const existingIds = new Set(season.exposedCowIds);
  const newIds = cowIds.filter((id) => !existingIds.has(id));

  return {
    ...season,
    exposedCowIds: [...season.exposedCowIds, ...newIds],
    updatedAt: new Date(),
  };
};

/**
 * Remove vacas expostas da estação
 */
export const removeExposedCows = (
  season: BreedingSeason,
  cowIds: string[]
): BreedingSeason => {
  const idsToRemove = new Set(cowIds);

  return {
    ...season,
    exposedCowIds: season.exposedCowIds.filter((id) => !idsToRemove.has(id)),
    updatedAt: new Date(),
  };
};

/**
 * Adiciona touro à estação
 */
export const addBull = (
  season: BreedingSeason,
  bull: { id: string; brinco: string; nome?: string; type: 'natural' | 'semen' }
): BreedingSeason => {
  const existingIds = new Set(season.bulls.map((b) => b.id));

  if (existingIds.has(bull.id)) {
    return season;
  }

  return {
    ...season,
    bulls: [...season.bulls, bull],
    updatedAt: new Date(),
  };
};

/**
 * Registra cobertura
 */
export const addCoverageRecord = (
  season: BreedingSeason,
  coverage: Omit<CoverageRecord, 'id' | 'expectedCalvingDate'>
): BreedingSeason => {
  const newCoverage: CoverageRecord = {
    ...coverage,
    id: generateId(),
    expectedCalvingDate: calculateExpectedCalvingDate(coverage.date),
    pregnancyResult: 'pending',
  };

  return {
    ...season,
    coverageRecords: [...season.coverageRecords, newCoverage],
    updatedAt: new Date(),
  };
};

/**
 * Atualiza resultado do diagnóstico de gestação
 */
export const updatePregnancyResult = (
  season: BreedingSeason,
  coverageId: string,
  result: 'positive' | 'negative',
  checkDate: Date
): BreedingSeason => {
  return {
    ...season,
    coverageRecords: season.coverageRecords.map((c) =>
      c.id === coverageId
        ? {
            ...c,
            pregnancyResult: result,
            pregnancyCheckDate: checkDate,
          }
        : c
    ),
    updatedAt: new Date(),
  };
};

/**
 * Atualiza status da estação
 */
export const updateSeasonStatus = (
  season: BreedingSeason,
  status: BreedingSeasonStatus
): BreedingSeason => {
  return {
    ...season,
    status,
    updatedAt: new Date(),
  };
};

/**
 * Filtra vacas elegíveis para exposição
 */
export const getEligibleCows = (animals: Animal[], minAgeMonths: number = 18): Animal[] => {
  const now = new Date();

  return animals.filter((animal) => {
    // Deve ser fêmea ativa
    if (animal.sexo !== Sexo.Femea || animal.status !== 'Ativo') {
      return false;
    }

    // Deve ter idade mínima
    const birthDate = new Date(animal.dataNascimento);
    const ageMonths =
      (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());

    return ageMonths >= minAgeMonths;
  });
};

/**
 * Filtra touros disponíveis
 */
export const getAvailableBulls = (animals: Animal[], minAgeMonths: number = 18): Animal[] => {
  const now = new Date();

  return animals.filter((animal) => {
    // Deve ser macho ativo
    if (animal.sexo !== Sexo.Macho || animal.status !== 'Ativo') {
      return false;
    }

    // Deve ter idade mínima
    const birthDate = new Date(animal.dataNascimento);
    const ageMonths =
      (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());

    return ageMonths >= minAgeMonths;
  });
};

/**
 * Gera relatório de prenhez esperada
 */
export const getExpectedCalvings = (
  season: BreedingSeason
): { cowId: string; cowBrinco: string; expectedDate: Date; bullInfo: string }[] => {
  return season.coverageRecords
    .filter((c) => c.pregnancyResult === 'positive' && c.expectedCalvingDate)
    .map((c) => ({
      cowId: c.cowId,
      cowBrinco: c.cowBrinco,
      expectedDate: new Date(c.expectedCalvingDate!),
      bullInfo: c.bullBrinco || c.semenCode || 'Desconhecido',
    }))
    .sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
};
