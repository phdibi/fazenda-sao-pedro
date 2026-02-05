/**
 * KPI Calculator - Cálculo de Indicadores Zootécnicos
 *
 * ATUALIZADO: Agora integra com BreedingSeason e usa índices pré-computados
 *
 * Calcula métricas de desempenho do rebanho baseado em dados reais:
 * - Taxa de prenhez (baseada em TODAS as estações de monta)
 * - Taxa de natalidade (prenhezes × nascimentos confirmados)
 * - Taxa de mortalidade
 * - Pesos médios (nascimento, desmame, sobreano)
 * - Intervalo entre partos
 * - Kg de bezerro/vaca/ano
 * - GMD médio
 */

import {
  Animal,
  AnimalStatus,
  Sexo,
  WeighingType,
  ZootechnicalKPIs,
  DEFAULT_KPI_TARGETS,
  KPITarget,
  BreedingSeason,
  GainMetrics,
} from '../types';
import { calcularGMDAnimal } from '../utils/gmdCalculations';
import {
  filterByReferencePeriod,
  getReferencePeriodStats,
} from '../utils/referencePeriod';

// ============================================
// HELPERS
// ============================================

/**
 * Calcula idade em meses
 */
const getAgeInMonths = (birthDate?: Date): number => {
  if (!birthDate) return 0;
  const now = new Date();
  const birth = new Date(birthDate);
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
};

/**
 * Obtém peso por tipo de pesagem (usa enum padronizado)
 */
const getWeightByType = (animal: Animal, type: WeighingType): number | null => {
  const pesagem = animal.historicoPesagens?.find((p) => p.type === type);
  return pesagem?.weightKg ?? null;
};

/**
 * Calcula média de um array
 */
const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

// ============================================
// ÍNDICES PRÉ-COMPUTADOS (SINGLE-PASS)
// ============================================

interface AnimalAggregation {
  // Por status
  active: Animal[];
  dead: Animal[];
  sold: Animal[];
  // Por sexo
  males: Animal[];
  females: Animal[];
  activeFemales: Animal[];
  activeMales: Animal[];
  // Por idade
  breedingAgeFemales: Animal[];
  calves: Animal[];
  // Contadores
  totalAnimals: number;
  // Pesos
  birthWeights: number[];
  weaningWeights: number[];
  yearlingWeights: number[];
  // Animais com peso de desmame
  weanedCalves: Animal[];
  // Índice por brinco (normalizado)
  byBrinco: Map<string, Animal>;
  // Índice por nome (para busca de pai/mãe)
  byName: Map<string, Animal>;
}

/**
 * Agrega todos os dados em uma única passagem O(n)
 */
const aggregateAnimals = (animals: Animal[]): AnimalAggregation => {
  const result: AnimalAggregation = {
    active: [],
    dead: [],
    sold: [],
    males: [],
    females: [],
    activeFemales: [],
    activeMales: [],
    breedingAgeFemales: [],
    calves: [],
    totalAnimals: animals.length,
    birthWeights: [],
    weaningWeights: [],
    yearlingWeights: [],
    weanedCalves: [],
    byBrinco: new Map(),
    byName: new Map(),
  };

  for (const animal of animals) {
    // Índices
    result.byBrinco.set(animal.brinco.toLowerCase().trim(), animal);
    if (animal.nome) {
      result.byName.set(animal.nome.toLowerCase().trim(), animal);
    }

    // Por status
    switch (animal.status) {
      case AnimalStatus.Ativo:
        result.active.push(animal);
        break;
      case AnimalStatus.Obito:
        result.dead.push(animal);
        break;
      case AnimalStatus.Vendido:
        result.sold.push(animal);
        break;
    }

    // Por sexo
    if (animal.sexo === Sexo.Macho) {
      result.males.push(animal);
      if (animal.status === AnimalStatus.Ativo) {
        result.activeMales.push(animal);
      }
    } else if (animal.sexo === Sexo.Femea) {
      result.females.push(animal);
      if (animal.status === AnimalStatus.Ativo) {
        result.activeFemales.push(animal);
        // Vacas em idade reprodutiva (>= 18 meses)
        const ageMonths = getAgeInMonths(animal.dataNascimento);
        if (ageMonths >= 18) {
          result.breedingAgeFemales.push(animal);
        }
      }
    }

    // Bezerros (< 12 meses e ativos)
    if (animal.status === AnimalStatus.Ativo) {
      const ageMonths = getAgeInMonths(animal.dataNascimento);
      if (ageMonths < 12) {
        result.calves.push(animal);
      }
    }

    // Pesos (usando WeighingType enum padronizado)
    const birthWeight = getWeightByType(animal, WeighingType.Birth);
    if (birthWeight !== null && birthWeight > 0) {
      result.birthWeights.push(birthWeight);
    }

    const weaningWeight = getWeightByType(animal, WeighingType.Weaning);
    if (weaningWeight !== null && weaningWeight > 0) {
      result.weaningWeights.push(weaningWeight);
      result.weanedCalves.push(animal);
    }

    const yearlingWeight = getWeightByType(animal, WeighingType.Yearling);
    if (yearlingWeight !== null && yearlingWeight > 0) {
      result.yearlingWeights.push(yearlingWeight);
    }
  }

  return result;
};

// ============================================
// CÁLCULO DE PROGÊNIE UNIFICADA
// ============================================

/**
 * Obtém filhos de uma vaca unificando duas fontes:
 * 1. historicoProgenie (registro manual)
 * 2. maeNome/maeId dos outros animais (busca reversa)
 */
const getUnifiedProgeny = (
  cow: Animal,
  aggregation: AnimalAggregation,
  allAnimals: Animal[]
): Animal[] => {
  const progenySet = new Set<string>();
  const result: Animal[] = [];

  // Fonte 1: historicoProgenie
  if (cow.historicoProgenie) {
    for (const p of cow.historicoProgenie) {
      const key = p.offspringBrinco.toLowerCase().trim();
      if (!progenySet.has(key)) {
        const offspring = aggregation.byBrinco.get(key);
        if (offspring) {
          progenySet.add(key);
          result.push(offspring);
        }
      }
    }
  }

  // Fonte 2: Busca reversa por maeNome/maeId
  const cowNames = [
    cow.nome?.toLowerCase().trim(),
    cow.brinco.toLowerCase().trim(),
  ].filter(Boolean) as string[];

  for (const animal of allAnimals) {
    // Verifica por maeId (preferência)
    if (animal.maeId && animal.maeId === cow.id) {
      const key = animal.brinco.toLowerCase().trim();
      if (!progenySet.has(key)) {
        progenySet.add(key);
        result.push(animal);
      }
      continue;
    }

    // Verifica por maeNome
    if (animal.maeNome) {
      const maeNome = animal.maeNome.toLowerCase().trim();
      if (cowNames.includes(maeNome)) {
        const key = animal.brinco.toLowerCase().trim();
        if (!progenySet.has(key)) {
          progenySet.add(key);
          result.push(animal);
        }
      }
    }
  }

  return result;
};

// ============================================
// CÁLCULO DE KPIs
// ============================================

export interface KPICalculationResult {
  kpis: ZootechnicalKPIs;
  details: {
    totalAnimals: number;
    totalFemales: number;
    totalMales: number;
    totalActive: number;
    totalDeaths: number;
    totalSold: number;
    calvesWeaned: number;
    exposedCows: number;
    pregnantCows: number;
    births: number;
    // NOVO: detalhes de prenhez por fonte
    pregnantFromBreedingSeason: number;
    pregnantFromManualRecord: number;
    // NOVO: estatísticas do período de referência
    animalsInReferencePeriod?: number;
    animalsExcludedFromPeriod?: number;
  };
  warnings: string[];
  calculatedAt: Date;
}

export interface KPICalculationOptions {
  breedingSeasons?: BreedingSeason[];
  preCalculatedGMD?: Map<string, GainMetrics>;
}

/**
 * Calcula todos os KPIs zootécnicos do rebanho
 * ATUALIZADO: Agora aceita breedingSeasons e GMD pré-calculado
 * ATUALIZADO: Filtra animais pelo período de referência (2025+)
 */
export const calculateZootechnicalKPIs = (
  animals: Animal[],
  options: KPICalculationOptions = {}
): KPICalculationResult => {
  const { breedingSeasons = [], preCalculatedGMD } = options;
  const warnings: string[] = [];

  // Estatísticas do período de referência (informativo)
  const referencePeriodStats = getReferencePeriodStats(animals);

  // Contagens e taxas usam TODOS os animais (rebanho real)
  const agg = aggregateAnimals(animals);

  // Pesos e desmamados usam período de referência (2025+) para evitar viés de seleção:
  // animais antigos no sistema são amostra enviesada (só os não vendidos).
  const aggPeriod = aggregateAnimals(filterByReferencePeriod(animals));

  // ============================================
  // 1. TAXA DE MORTALIDADE
  // ============================================
  const mortalityRate = agg.totalAnimals > 0
    ? (agg.dead.length / agg.totalAnimals) * 100
    : 0;

  // ============================================
  // 2. PESOS MÉDIOS (período de referência)
  // ============================================
  const avgBirthWeight = mean(aggPeriod.birthWeights);
  const avgWeaningWeight = mean(aggPeriod.weaningWeights);
  const avgYearlingWeight = mean(aggPeriod.yearlingWeights);

  if (aggPeriod.birthWeights.length < 5) {
    warnings.push('Poucos registros de peso ao nascimento para cálculo preciso');
  }
  if (aggPeriod.weaningWeights.length < 5) {
    warnings.push('Poucos registros de peso ao desmame para cálculo preciso');
  }

  // ============================================
  // 3. TAXA DE PRENHEZ (SÍNTESE DE TODAS AS ESTAÇÕES DE MONTA)
  // Calcula a taxa de cada estação individualmente (com deduplicação por cowId
  // dentro de cada estação, mesma lógica do breedingSeasonService) e depois
  // faz a síntese somando expostas e prenhes de todas as estações.
  // Isso equivale a uma média ponderada pelo número de expostas.
  // ============================================
  let pregnantFromBreedingSeason = 0;
  let pregnantFromManualRecord = 0;
  let totalExposedInSeasons = 0;
  let totalPregnantInSeasons = 0;

  // Itera sobre TODAS as estações de monta (active ou finished)
  const activeSeasons = breedingSeasons.filter(
    (s) => s.status === 'active' || s.status === 'finished'
  );

  if (activeSeasons.length > 0) {
    for (const season of activeSeasons) {
      // Deduplicação DENTRO de cada estação (uma vaca conta 1x por estação)
      const pregnantInSeason = new Set<string>();

      for (const record of season.coverageRecords) {
        if (record.pregnancyResult === 'positive') {
          pregnantInSeason.add(record.cowId);
        } else if (record.repasse?.enabled) {
          if (record.repasse.diagnosisResult === 'positive') {
            pregnantInSeason.add(record.cowId);
          }
        }
      }

      // Soma os totais de cada estação para a síntese geral
      totalExposedInSeasons += season.exposedCowIds.length;
      totalPregnantInSeasons += pregnantInSeason.size;
    }

    pregnantFromBreedingSeason = totalPregnantInSeasons;
  }

  // Fallback para dados manuais se não há estações de monta
  if (activeSeasons.length === 0) {
    const pregnantCowsManual = agg.breedingAgeFemales.filter((cow) => {
      if (cow.historicoPrenhez && cow.historicoPrenhez.length > 0) {
        const lastPregnancy = cow.historicoPrenhez[cow.historicoPrenhez.length - 1];
        const hasAbortionAfter = cow.historicoAborto?.some(
          (ab) => new Date(ab.date) >= new Date(lastPregnancy.date)
        );
        if (!hasAbortionAfter) {
          pregnantFromManualRecord++;
          return true;
        }
      }
      return false;
    });
    totalExposedInSeasons = agg.breedingAgeFemales.length;
    totalPregnantInSeasons = pregnantCowsManual.length;
  }

  const pregnancyRate = totalExposedInSeasons > 0
    ? (totalPregnantInSeasons / totalExposedInSeasons) * 100
    : 0;

  const pregnantCowsCount = totalPregnantInSeasons;

  // ============================================
  // 4. TAXA DE NATALIDADE (PRENHEZES × NASCIMENTOS)
  // Compara nascimentos confirmados contra prenhezes nas estações de monta.
  // Deduplicação por cowId DENTRO de cada estação para consistência.
  // Taxa = Total de partos confirmados / Total de prenhezes × 100
  // ============================================
  let totalConfirmedBirths = 0;
  let totalPregnancies = 0;

  if (activeSeasons.length > 0) {
    for (const season of activeSeasons) {
      const pregnantInSeason = new Set<string>();
      const birthsInSeason = new Set<string>();

      for (const record of season.coverageRecords) {
        if (record.pregnancyResult === 'positive') {
          pregnantInSeason.add(record.cowId);
          if (record.calvingResult === 'realizado') {
            birthsInSeason.add(record.cowId);
          }
        } else if (record.repasse?.enabled && record.repasse.diagnosisResult === 'positive') {
          pregnantInSeason.add(record.cowId);
          if (record.repasse.calvingResult === 'realizado') {
            birthsInSeason.add(record.cowId);
          }
        }
      }

      totalPregnancies += pregnantInSeason.size;
      totalConfirmedBirths += birthsInSeason.size;
    }
  }

  // Fallback: se não há estações, usa contagem de nascimentos últimos 12 meses
  if (activeSeasons.length === 0) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    totalConfirmedBirths = animals.filter(
      (a) => a.dataNascimento && new Date(a.dataNascimento) >= oneYearAgo
    ).length;
    totalPregnancies = agg.breedingAgeFemales.length;
  }

  const birthRate = totalPregnancies > 0
    ? (totalConfirmedBirths / totalPregnancies) * 100
    : 0;

  // ============================================
  // 5. INTERVALO ENTRE PARTOS
  // Combina datas de parto de duas fontes:
  //   a) Progênie unificada (animais cadastrados com dataNascimento)
  //   b) Estações de monta (actualCalvingDate dos coverage records)
  // Consolida por vaca (cowId), deduplicando datas próximas (±30 dias),
  // e calcula intervalos entre partos consecutivos de cada vaca.
  // ============================================
  const calvingIntervals: number[] = [];

  // Coleta datas de parto por vaca (cowId) de TODAS as fontes
  const calvingDatesByCow = new Map<string, Set<number>>();

  // Fonte A: Progênie unificada (datas de nascimento dos filhos)
  for (const cow of agg.activeFemales) {
    const progeny = getUnifiedProgeny(cow, agg, animals);
    if (progeny.length > 0) {
      if (!calvingDatesByCow.has(cow.id)) {
        calvingDatesByCow.set(cow.id, new Set());
      }
      const dates = calvingDatesByCow.get(cow.id)!;
      for (const offspring of progeny) {
        if (offspring.dataNascimento) {
          dates.add(new Date(offspring.dataNascimento).getTime());
        }
      }
    }
  }

  // Fonte B: Estações de monta (actualCalvingDate dos coverage records)
  for (const season of activeSeasons) {
    for (const record of season.coverageRecords) {
      // Parto da cobertura principal
      if (record.calvingResult === 'realizado' && record.actualCalvingDate) {
        if (!calvingDatesByCow.has(record.cowId)) {
          calvingDatesByCow.set(record.cowId, new Set());
        }
        calvingDatesByCow.get(record.cowId)!.add(new Date(record.actualCalvingDate).getTime());
      }
      // Parto do repasse
      if (record.repasse?.calvingResult === 'realizado' && record.repasse.actualCalvingDate) {
        if (!calvingDatesByCow.has(record.cowId)) {
          calvingDatesByCow.set(record.cowId, new Set());
        }
        calvingDatesByCow.get(record.cowId)!.add(new Date(record.repasse.actualCalvingDate).getTime());
      }
    }
  }

  // Calcula intervalos entre partos consecutivos para cada vaca
  for (const [, dateTimestamps] of calvingDatesByCow) {
    const sortedDates = Array.from(dateTimestamps).sort((a, b) => a - b);

    // Deduplicação de datas próximas (±30 dias = mesma gestação)
    const deduped: number[] = [sortedDates[0]];
    for (let i = 1; i < sortedDates.length; i++) {
      const daysDiff = (sortedDates[i] - deduped[deduped.length - 1]) / (1000 * 60 * 60 * 24);
      if (daysDiff > 30) {
        deduped.push(sortedDates[i]);
      }
    }

    // Calcula intervalos entre partos consecutivos
    for (let i = 1; i < deduped.length; i++) {
      const interval = Math.floor((deduped[i] - deduped[i - 1]) / (1000 * 60 * 60 * 24));
      if (interval > 200 && interval < 730) {
        calvingIntervals.push(interval);
      }
    }
  }

  const calvingInterval = mean(calvingIntervals);

  if (calvingIntervals.length < 3) {
    warnings.push('Poucos registros de partos para cálculo preciso do IEP');
  }

  // ============================================
  // 7. GMD MÉDIO DO REBANHO (USA PRÉ-CALCULADO SE DISPONÍVEL)
  // ============================================
  const gmdValues: number[] = [];

  for (const animal of agg.active) {
    let gmd: number | undefined;

    if (preCalculatedGMD) {
      gmd = preCalculatedGMD.get(animal.id)?.gmdTotal ?? undefined;
    } else {
      const calculated = calcularGMDAnimal(animal);
      gmd = calculated?.gmdTotal ?? undefined;
    }

    if (gmd && gmd > 0) {
      gmdValues.push(gmd);
    }
  }

  const avgGMD = mean(gmdValues);

  // ============================================
  // 8. KG DE BEZERRO/VACA/ANO
  // Usa taxa de natalidade (nascimentos / prenhezes) × peso médio ao desmame
  // ============================================
  const kgCalfPerCowYear = (avgWeaningWeight * birthRate) / 100;

  // ============================================
  // RESULTADO FINAL
  // ============================================

  const kpis: ZootechnicalKPIs = {
    avgWeaningWeight: Math.round(avgWeaningWeight * 10) / 10,
    calvingInterval: Math.round(calvingInterval),
    pregnancyRate: Math.round(pregnancyRate * 10) / 10,
    kgCalfPerCowYear: Math.round(kgCalfPerCowYear * 10) / 10,
    mortalityRate: Math.round(mortalityRate * 10) / 10,
    avgGMD: Math.round(avgGMD * 100) / 100,
    birthRate: Math.round(birthRate * 10) / 10,
    avgBirthWeight: Math.round(avgBirthWeight * 10) / 10,
    avgYearlingWeight: Math.round(avgYearlingWeight * 10) / 10,
  };

  return {
    kpis,
    details: {
      totalAnimals: animals.length,
      totalFemales: agg.females.length,
      totalMales: agg.males.length,
      totalActive: agg.active.length,
      totalDeaths: agg.dead.length,
      totalSold: agg.sold.length,
      calvesWeaned: aggPeriod.weanedCalves.length,
      exposedCows: totalExposedInSeasons > 0 ? totalExposedInSeasons : agg.breedingAgeFemales.length,
      pregnantCows: pregnantCowsCount,
      births: totalConfirmedBirths,
      pregnantFromBreedingSeason,
      pregnantFromManualRecord,
      // Estatísticas do período de referência
      animalsInReferencePeriod: referencePeriodStats.inPeriod,
      animalsExcludedFromPeriod: referencePeriodStats.excluded,
    },
    warnings,
    calculatedAt: new Date(),
  };
};

// ============================================
// AVALIAÇÃO DE KPIs
// ============================================

export type KPIStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface KPIEvaluation {
  metric: keyof ZootechnicalKPIs;
  value: number;
  target: KPITarget;
  status: KPIStatus;
  deviation: number;
  trend?: 'up' | 'down' | 'stable';
}

/**
 * Avalia um KPI em relação às metas
 */
export const evaluateKPI = (metric: keyof ZootechnicalKPIs, value: number): KPIEvaluation => {
  const target = DEFAULT_KPI_TARGETS.find((t) => t.metric === metric);

  if (!target) {
    return {
      metric,
      value,
      target: {
        metric,
        target: 0,
        unit: '',
        description: metric,
        minAcceptable: 0,
        excellent: 0,
      },
      status: 'warning',
      deviation: 0,
    };
  }

  const deviation = target.target !== 0 ? ((value - target.target) / target.target) * 100 : 0;
  const lowerIsBetter = ['mortalityRate', 'calvingInterval'].includes(metric);

  let status: KPIStatus;

  if (lowerIsBetter) {
    if (value <= target.excellent) status = 'excellent';
    else if (value <= target.target) status = 'good';
    else if (value <= target.minAcceptable) status = 'warning';
    else status = 'critical';
  } else {
    if (value >= target.excellent) status = 'excellent';
    else if (value >= target.target) status = 'good';
    else if (value >= target.minAcceptable) status = 'warning';
    else status = 'critical';
  }

  return {
    metric,
    value,
    target,
    status,
    deviation: Math.round(deviation * 10) / 10,
  };
};

/**
 * Avalia todos os KPIs e retorna o resultado
 */
export const evaluateAllKPIs = (kpis: ZootechnicalKPIs): KPIEvaluation[] => {
  const metrics = Object.keys(kpis) as (keyof ZootechnicalKPIs)[];
  return metrics.map((metric) => evaluateKPI(metric, kpis[metric]));
};

/**
 * Gera resumo executivo dos KPIs
 */
export const generateKPISummary = (kpis: ZootechnicalKPIs): string => {
  const evaluations = evaluateAllKPIs(kpis);

  const excellent = evaluations.filter((e) => e.status === 'excellent').length;
  const good = evaluations.filter((e) => e.status === 'good').length;
  const warning = evaluations.filter((e) => e.status === 'warning').length;
  const critical = evaluations.filter((e) => e.status === 'critical').length;

  const criticalMetrics = evaluations
    .filter((e) => e.status === 'critical')
    .map((e) => e.target.description)
    .join(', ');

  const excellentMetrics = evaluations
    .filter((e) => e.status === 'excellent')
    .map((e) => e.target.description)
    .join(', ');

  let summary = `**Resumo dos KPIs Zootécnicos**\n\n`;
  summary += `- Excelentes: ${excellent} | Bons: ${good} | Atenção: ${warning} | Críticos: ${critical}\n\n`;

  if (critical > 0) {
    summary += `**Métricas Críticas:** ${criticalMetrics}\n`;
    summary += `Estas métricas precisam de atenção imediata para melhorar a eficiência do rebanho.\n\n`;
  }

  if (excellent > 0) {
    summary += `**Destaques:** ${excellentMetrics}\n`;
    summary += `Parabéns! Estas métricas estão acima da meta.\n`;
  }

  return summary;
};
