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
  CoverageType,
  CoverageRecord,
  RepasseData,
  RepasseBull,
  Animal,
  Sexo,
  AnimalStatus,
  PregnancyType,
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
 * Retorna touros do repasse (backward compat: suporta bullId legado e bulls[])
 */
export const getRepasseBulls = (repasse: RepasseData): RepasseBull[] => {
  if (repasse.bulls && repasse.bulls.length > 0) {
    return repasse.bulls;
  }
  if (repasse.bullId) {
    return [{ bullId: repasse.bullId, bullBrinco: repasse.bullBrinco || 'Desconhecido' }];
  }
  return [];
};

/**
 * Retorna touros da cobertura principal (natural) - backward compat: suporta bullId legado e bulls[]
 */
export const getCoverageBulls = (coverage: CoverageRecord): RepasseBull[] => {
  if (coverage.bulls && coverage.bulls.length > 0) {
    return coverage.bulls;
  }
  if (coverage.bullId) {
    return [{ bullId: coverage.bullId, bullBrinco: coverage.bullBrinco || 'Desconhecido' }];
  }
  return [];
};

/**
 * Retorna label do touro para exibição na cobertura natural
 * Se paternidade confirmada, mostra o confirmado; senão mostra todos
 */
export const getCoverageBullLabel = (coverage: CoverageRecord): string => {
  if (coverage.confirmedSireId) {
    return coverage.confirmedSireBrinco || 'Confirmado';
  }
  const bulls = getCoverageBulls(coverage);
  if (bulls.length === 0) return 'Sem touro';
  if (bulls.length === 1) return bulls[0].bullBrinco;
  return bulls.map((b) => b.bullBrinco).join(' / ');
};

/**
 * Verifica se há paternidade pendente na cobertura principal (2 touros naturais, sem confirmedSireId)
 */
export const hasPendingCoveragePaternity = (coverage: CoverageRecord): boolean => {
  if (coverage.type !== 'natural') return false;
  if (coverage.pregnancyResult !== 'positive') return false;
  const bulls = getCoverageBulls(coverage);
  return bulls.length > 1 && !coverage.confirmedSireId;
};

/**
 * Retorna label do touro para exibição no repasse
 * Se paternidade confirmada, mostra o confirmado; senão mostra todos
 */
export const getRepasseBullLabel = (repasse: RepasseData): string => {
  if (repasse.confirmedSireId) {
    return repasse.confirmedSireBrinco || 'Confirmado';
  }
  const bulls = getRepasseBulls(repasse);
  if (bulls.length === 0) return 'Sem touro';
  if (bulls.length === 1) return bulls[0].bullBrinco;
  return bulls.map((b) => b.bullBrinco).join(' / ');
};

/**
 * Verifica se há paternidade pendente de confirmação no repasse (2 touros, sem confirmedSireId)
 */
export const hasPendingPaternity = (repasse: RepasseData): boolean => {
  if (!repasse.enabled || repasse.diagnosisResult !== 'positive') return false;
  const bulls = getRepasseBulls(repasse);
  return bulls.length > 1 && !repasse.confirmedSireId;
};

/**
 * Mapeia tipo de cobertura para PregnancyType (para historicoPrenhez do animal)
 */
export const PREGNANCY_TYPE_MAP: Record<string, PregnancyType> = {
  'natural': PregnancyType.Monta,
  'ia': PregnancyType.InseminacaoArtificial,
  'iatf': PregnancyType.InseminacaoArtificial,
  'fiv': PregnancyType.FIV,
};

/**
 * Determina o nome do reprodutor (sireName) a partir de uma cobertura
 * Para FIV: formato "DoadoraXSêmen" (ex: 5311XLinaje)
 * Para Natural com 2 touros: "Touro1 / Touro2 (pendente)" ou confirmado
 */
export const getCoverageSireName = (coverage: {
  bullBrinco?: string;
  bulls?: RepasseBull[];
  confirmedSireId?: string;
  confirmedSireBrinco?: string;
  semenCode?: string;
  type?: CoverageType;
  donorCowBrinco?: string;
}): string => {
  // FIV: cruzamento no formato DoadoraXSêmen
  if (coverage.type === 'fiv' && coverage.donorCowBrinco && coverage.semenCode) {
    return `${coverage.donorCowBrinco}X${coverage.semenCode}`;
  }
  // Natural com paternidade confirmada
  if (coverage.type === 'natural' && coverage.confirmedSireId) {
    return coverage.confirmedSireBrinco || 'Confirmado';
  }
  // Natural com múltiplos touros
  if (coverage.type === 'natural' && coverage.bulls && coverage.bulls.length > 0) {
    if (coverage.bulls.length === 1) {
      return coverage.bulls[0].bullBrinco;
    }
    return coverage.bulls.map(b => b.bullBrinco).join(' / ') + ' (pendente)';
  }
  return coverage.bullBrinco || coverage.semenCode || 'Desconhecido';
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
  pregnancyChecksDue: { cowId: string; cowBrinco: string; dueDate: Date; coverageId: string; isRepasse: boolean }[];
  // Repasse
  repasseCount: number;
  repassePregnant: number;
  overallPregnancyRate: number;
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

  // Resultados de prenhez (incluindo repasse)
  const pregnantCowIds = new Set<string>();
  const emptyCowIds = new Set<string>();
  const pendingCowIds = new Set<string>();
  // Prenhez apenas da cobertura principal (sem contar repasse)
  const firstServicePregnant = new Set<string>();
  let repasseCount = 0;
  let repassePregnant = 0;

  coverages.forEach((c) => {
    // Resultado da cobertura principal
    if (c.pregnancyResult === 'positive') {
      pregnantCowIds.add(c.cowId);
      firstServicePregnant.add(c.cowId);
      return; // Se prenhe na primeira cobertura, não precisa de repasse
    }

    // Se tem repasse habilitado (DG principal foi negativo)
    if (c.repasse?.enabled) {
      repasseCount++;
      if (c.repasse.diagnosisResult === 'positive') {
        repassePregnant++;
        pregnantCowIds.add(c.cowId);
      } else if (c.repasse.diagnosisResult === 'negative') {
        emptyCowIds.add(c.cowId);
      } else {
        pendingCowIds.add(c.cowId);
      }
      return;
    }

    // Sem repasse, resultado da cobertura principal
    if (c.pregnancyResult === 'negative') {
      emptyCowIds.add(c.cowId);
    } else {
      pendingCowIds.add(c.cowId);
    }
  });

  const totalPregnant = pregnantCowIds.size;
  const totalEmpty = emptyCowIds.size;
  const totalPending = pendingCowIds.size;

  // Taxas
  // pregnancyRate = taxa de prenhez da primeira cobertura (sem repasse)
  const pregnancyRate = totalExposed > 0 ? (firstServicePregnant.size / totalExposed) * 100 : 0;
  const serviceRate = totalExposed > 0 ? (totalCovered / totalExposed) * 100 : 0;
  const conceptionRate = totalCovered > 0 ? (totalPregnant / totalCovered) * 100 : 0;
  // overallPregnancyRate = taxa geral (incluindo repasse)
  const overallPregnancyRate = totalExposed > 0 ? (totalPregnant / totalExposed) * 100 : 0;

  // Coberturas por tipo
  const coveragesByType: Record<CoverageType, number> = {
    natural: 0,
    ia: 0,
    iatf: 0,
    fiv: 0,
  };
  coverages.forEach((c) => {
    coveragesByType[c.type]++;
  });

  // Coberturas por touro (inclui touros de repasse)
  const bullStats = new Map<
    string,
    { bullId: string; bullBrinco: string; count: number; pregnancies: number }
  >();
  coverages.forEach((c) => {
    // Touro/sêmen da cobertura principal
    const mainBulls = getCoverageBulls(c);
    if (mainBulls.length > 0 && c.type === 'natural') {
      // Monta natural: pode ter 1 ou 2 touros
      const isPregnant = c.pregnancyResult === 'positive';
      const confirmedId = c.confirmedSireId;
      mainBulls.forEach((mb) => {
        const bullKey = mb.bullId;
        const existing = bullStats.get(bullKey) || {
          bullId: mb.bullId,
          bullBrinco: mb.bullBrinco,
          count: 0,
          pregnancies: 0,
        };
        existing.count++;
        if (isPregnant) {
          if (confirmedId) {
            if (confirmedId === mb.bullId) {
              existing.pregnancies++;
            }
          } else if (mainBulls.length === 1) {
            existing.pregnancies++;
          }
          // Se 2 touros sem confirmação, não conta prenhez para nenhum
        }
        bullStats.set(bullKey, existing);
      });
    } else {
      // IA/IATF/FIV ou natural legado sem bulls[]
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
    }

    // Touros de repasse (suporta 1 ou 2 touros)
    if (c.repasse?.enabled) {
      const repasseBulls = getRepasseBulls(c.repasse);
      const isPregnant = c.repasse.diagnosisResult === 'positive';
      // Se paternidade confirmada, só conta para o touro confirmado
      const confirmedId = c.repasse.confirmedSireId;

      repasseBulls.forEach((rb) => {
        const repasseKey = rb.bullId;
        const repasseExisting = bullStats.get(repasseKey) || {
          bullId: rb.bullId,
          bullBrinco: rb.bullBrinco,
          count: 0,
          pregnancies: 0,
        };
        repasseExisting.count++;
        if (isPregnant) {
          if (confirmedId) {
            // Só adiciona prenhez ao touro confirmado
            if (confirmedId === rb.bullId) {
              repasseExisting.pregnancies++;
            }
          } else if (repasseBulls.length === 1) {
            // Touro único, prenhez é dele
            repasseExisting.pregnancies++;
          }
          // Se 2 touros sem confirmação, não conta prenhez para nenhum
        }
        bullStats.set(repasseKey, repasseExisting);
      });
    }
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

  // Diagnósticos pendentes (cobertura principal + repasse)
  const pregnancyChecksDue: { cowId: string; cowBrinco: string; dueDate: Date; coverageId: string; isRepasse: boolean }[] = [];
  const checkDays = season.config?.pregnancyCheckDays || 60;

  coverages.forEach((c) => {
    // DG pendente da cobertura principal
    if (!c.pregnancyResult || c.pregnancyResult === 'pending') {
      const gestationDays = calculateGestationDays(c.date);
      if (gestationDays >= checkDays) {
        pregnancyChecksDue.push({
          cowId: c.cowId,
          cowBrinco: c.cowBrinco,
          coverageId: c.id,
          dueDate: new Date(new Date(c.date).getTime() + checkDays * 24 * 60 * 60 * 1000),
          isRepasse: false,
        });
      }
    }
    // DG pendente do repasse
    if (c.repasse?.enabled && (!c.repasse.diagnosisResult || c.repasse.diagnosisResult === 'pending')) {
      const repasseStartDate = c.repasse.startDate || season.startDate;
      const gestationDays = calculateGestationDays(new Date(repasseStartDate));
      if (gestationDays >= checkDays) {
        pregnancyChecksDue.push({
          cowId: c.cowId,
          cowBrinco: c.cowBrinco,
          coverageId: c.id,
          dueDate: new Date(new Date(repasseStartDate).getTime() + checkDays * 24 * 60 * 60 * 1000),
          isRepasse: true,
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
    repasseCount,
    repassePregnant,
    overallPregnancyRate: Math.round(overallPregnancyRate * 10) / 10,
  };
};

// ============================================
// HELPERS DE TRANSFORMAÇÃO LOCAL
// ============================================
// Nota: As operações CRUD completas estão em useFirestoreOptimized.ts
// Estas funções são para transformações locais sem persistência

/**
 * Adiciona vacas expostas à estação (transformação local)
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
 * Remove vacas expostas da estação (transformação local)
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
 * Adiciona touro à estação (transformação local)
 */
export const addBull = (
  season: BreedingSeason,
  bull: { id: string; brinco: string; nome?: string; type: 'natural' | 'semen' }
): BreedingSeason => {
  const bulls = season.bulls || [];
  const existingIds = new Set(bulls.map((b) => b.id));

  if (existingIds.has(bull.id)) {
    return season;
  }

  return {
    ...season,
    bulls: [...bulls, bull],
    updatedAt: new Date(),
  };
};

/**
 * Filtra vacas elegíveis para exposição
 * Se não tiver data de nascimento, assume que é elegível (animal antigo sem dados completos)
 */
export const getEligibleCows = (animals: Animal[], minAgeMonths: number = 18): Animal[] => {
  const now = new Date();

  return animals.filter((animal) => {
    // Deve ser fêmea ativa
    if (animal.sexo !== Sexo.Femea || animal.status !== AnimalStatus.Ativo) {
      return false;
    }

    // Se não tem data de nascimento, assume que é elegível (animal antigo)
    if (!animal.dataNascimento) {
      return true;
    }

    // Deve ter idade mínima
    const birthDate = new Date(animal.dataNascimento);

    // Se a data é inválida, assume que é elegível
    if (isNaN(birthDate.getTime())) {
      return true;
    }

    const ageMonths =
      (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());

    return ageMonths >= minAgeMonths;
  });
};

/**
 * Filtra touros disponíveis
 * Se não tiver data de nascimento, assume que é elegível (animal antigo sem dados completos)
 */
export const getAvailableBulls = (animals: Animal[], minAgeMonths: number = 18): Animal[] => {
  const now = new Date();

  return animals.filter((animal) => {
    // Deve ser macho ativo
    if (animal.sexo !== Sexo.Macho || animal.status !== AnimalStatus.Ativo) {
      return false;
    }

    // Se não tem data de nascimento, assume que é elegível (animal antigo)
    if (!animal.dataNascimento) {
      return true;
    }

    // Deve ter idade mínima
    const birthDate = new Date(animal.dataNascimento);

    // Se a data é inválida, assume que é elegível
    if (isNaN(birthDate.getTime())) {
      return true;
    }

    const ageMonths =
      (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());

    return ageMonths >= minAgeMonths;
  });
};

/**
 * Retorna coberturas com paternidade pendente:
 * - Monta natural direta com 2 touros, prenhe, sem confirmação
 * - Repasse com 2 touros, prenhe, sem confirmação
 */
export const getPendingPaternityRecords = (season: BreedingSeason): CoverageRecord[] => {
  return (season.coverageRecords || []).filter(
    (c) => hasPendingCoveragePaternity(c) || (c.repasse?.enabled && hasPendingPaternity(c.repasse!))
  );
};

/**
 * Retorna coberturas IATF/FIV com diagnóstico negativo elegíveis para repasse
 */
export const getRepasseEligibleCows = (season: BreedingSeason): CoverageRecord[] => {
  return (season.coverageRecords || []).filter(
    (c) =>
      (c.type === 'iatf' || c.type === 'fiv' || c.type === 'ia') &&
      c.pregnancyResult === 'negative' &&
      !c.repasse?.enabled
  );
};

/**
 * Gera relatório de prenhez esperada (cobertura principal + repasse)
 */
export const getExpectedCalvings = (
  season: BreedingSeason
): {
  cowId: string;
  cowBrinco: string;
  expectedDate: Date;
  bullInfo: string;
  isFIV: boolean;
  donorInfo?: string;
  isRepasse?: boolean;
}[] => {
  const results: {
    cowId: string;
    cowBrinco: string;
    expectedDate: Date;
    bullInfo: string;
    isFIV: boolean;
    donorInfo?: string;
    isRepasse?: boolean;
  }[] = [];

  (season.coverageRecords || []).forEach((c) => {
    // Prenhez da cobertura principal
    if (c.pregnancyResult === 'positive' && c.expectedCalvingDate) {
      results.push({
        cowId: c.cowId,
        cowBrinco: c.cowBrinco,
        expectedDate: new Date(c.expectedCalvingDate),
        bullInfo: c.bullBrinco || c.semenCode || 'Desconhecido',
        isFIV: c.type === 'fiv',
        donorInfo: c.donorCowBrinco,
      });
    }
    // Prenhez do repasse (monta natural após DG negativo)
    if (c.repasse?.enabled && c.repasse.diagnosisResult === 'positive') {
      const repasseDate = c.repasse.startDate || season.startDate;
      const expectedDate = new Date(repasseDate);
      expectedDate.setDate(expectedDate.getDate() + 283);
      const bullLabel = getRepasseBullLabel(c.repasse);
      const pendingPat = hasPendingPaternity(c.repasse);
      results.push({
        cowId: c.cowId,
        cowBrinco: c.cowBrinco,
        expectedDate,
        bullInfo: pendingPat ? `${bullLabel} (paternidade pendente)` : bullLabel,
        isFIV: false,
        isRepasse: true,
      });
    }
  });

  return results.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());
};
