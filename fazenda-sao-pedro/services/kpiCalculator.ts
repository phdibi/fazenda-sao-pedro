/**
 * KPI Calculator - Cálculo de Indicadores Zootécnicos
 *
 * ATUALIZADO: Agora integra com BreedingSeason e usa índices pré-computados
 *
 * Calcula métricas de desempenho do rebanho baseado em dados reais:
 * - Taxa de desmame, prenhez, natalidade, mortalidade
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
 * Calcula diferença em dias entre duas datas
 */
const getDaysBetween = (date1: Date, date2: Date): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
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
// VERIFICAÇÃO DE PRENHEZ INTEGRADA
// ============================================

interface PregnancyCheckResult {
  isPregnant: boolean;
  source: 'breeding_season' | 'manual' | 'none';
}

/**
 * Verifica se uma vaca está prenhe, integrando dados de:
 * 1. BreedingSeason (prioridade - mais confiável)
 * 2. historicoPrenhez (fallback)
 */
const checkPregnancy = (
  animal: Animal,
  breedingSeasons: BreedingSeason[]
): PregnancyCheckResult => {
  // 1. Verifica breeding seasons (fonte mais confiável)
  for (const season of breedingSeasons) {
    if (season.status === 'active' || season.status === 'finished') {
      const coverage = season.coverageRecords.find(
        (c) => c.cowId === animal.id && c.pregnancyResult === 'positive'
      );
      if (coverage) {
        return { isPregnant: true, source: 'breeding_season' };
      }
    }
  }

  // 2. Fallback para historicoPrenhez
  if (animal.historicoPrenhez && animal.historicoPrenhez.length > 0) {
    const lastPregnancy = animal.historicoPrenhez[animal.historicoPrenhez.length - 1];
    const hasAbortionAfter = animal.historicoAborto?.some(
      (ab) => new Date(ab.date) >= new Date(lastPregnancy.date)
    );
    if (!hasAbortionAfter) {
      return { isPregnant: true, source: 'manual' };
    }
  }

  return { isPregnant: false, source: 'none' };
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
 */
export const calculateZootechnicalKPIs = (
  animals: Animal[],
  options: KPICalculationOptions = {}
): KPICalculationResult => {
  const { breedingSeasons = [], preCalculatedGMD } = options;
  const warnings: string[] = [];

  // Agregação em passagem única
  const agg = aggregateAnimals(animals);

  // ============================================
  // 1. TAXA DE MORTALIDADE
  // ============================================
  const mortalityRate = agg.totalAnimals > 0
    ? (agg.dead.length / agg.totalAnimals) * 100
    : 0;

  // ============================================
  // 2. PESOS MÉDIOS
  // ============================================
  const avgBirthWeight = mean(agg.birthWeights);
  const avgWeaningWeight = mean(agg.weaningWeights);
  const avgYearlingWeight = mean(agg.yearlingWeights);

  if (agg.birthWeights.length < 5) {
    warnings.push('Poucos registros de peso ao nascimento para cálculo preciso');
  }
  if (agg.weaningWeights.length < 5) {
    warnings.push('Poucos registros de peso ao desmame para cálculo preciso');
  }

  // ============================================
  // 3. TAXA DE DESMAME
  // ============================================
  const weaningRate = agg.breedingAgeFemales.length > 0
    ? (agg.weanedCalves.length / agg.breedingAgeFemales.length) * 100
    : 0;

  // ============================================
  // 4. TAXA DE PRENHEZ (INTEGRADA COM BREEDING SEASON)
  // ============================================
  let pregnantFromBreedingSeason = 0;
  let pregnantFromManualRecord = 0;

  const pregnantCows = agg.activeFemales.filter((cow) => {
    const result = checkPregnancy(cow, breedingSeasons);
    if (result.isPregnant) {
      if (result.source === 'breeding_season') {
        pregnantFromBreedingSeason++;
      } else if (result.source === 'manual') {
        pregnantFromManualRecord++;
      }
      return true;
    }
    return false;
  });

  const pregnancyRate = agg.breedingAgeFemales.length > 0
    ? (pregnantCows.length / agg.breedingAgeFemales.length) * 100
    : 0;

  // ============================================
  // 5. TAXA DE NATALIDADE
  // ============================================
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const birthsLastYear = animals.filter(
    (a) => a.dataNascimento && new Date(a.dataNascimento) >= oneYearAgo
  );
  const birthRate = agg.breedingAgeFemales.length > 0
    ? (birthsLastYear.length / agg.breedingAgeFemales.length) * 100
    : 0;

  // ============================================
  // 6. INTERVALO ENTRE PARTOS (USANDO PROGÊNIE UNIFICADA)
  // ============================================
  const calvingIntervals: number[] = [];

  for (const cow of agg.females) {
    const progeny = getUnifiedProgeny(cow, agg, animals);

    if (progeny.length >= 2) {
      const birthDates = progeny
        .map((o) => o.dataNascimento)
        .filter((d): d is Date => d !== undefined)
        .map((d) => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());

      for (let i = 1; i < birthDates.length; i++) {
        const interval = getDaysBetween(birthDates[i - 1], birthDates[i]);
        if (interval > 200 && interval < 730) {
          calvingIntervals.push(interval);
        }
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
  // ============================================
  const kgCalfPerCowYear = (avgWeaningWeight * weaningRate) / 100;

  // ============================================
  // 9. IDADE MÉDIA AO PRIMEIRO PARTO (USANDO PROGÊNIE UNIFICADA)
  // ============================================
  const firstCalvingAges: number[] = [];

  for (const cow of agg.females) {
    if (!cow.dataNascimento) continue;

    const progeny = getUnifiedProgeny(cow, agg, animals);
    if (progeny.length === 0) continue;

    // Ordena progênie por data de nascimento
    const sortedProgeny = progeny
      .filter((p) => p.dataNascimento)
      .sort((a, b) => new Date(a.dataNascimento!).getTime() - new Date(b.dataNascimento!).getTime());

    if (sortedProgeny.length > 0) {
      const cowBirthDate = new Date(cow.dataNascimento);
      const firstCalfBirthDate = new Date(sortedProgeny[0].dataNascimento!);
      const ageAtFirstCalving =
        (firstCalfBirthDate.getFullYear() - cowBirthDate.getFullYear()) * 12 +
        (firstCalfBirthDate.getMonth() - cowBirthDate.getMonth());

      if (ageAtFirstCalving >= 18 && ageAtFirstCalving <= 48) {
        firstCalvingAges.push(ageAtFirstCalving);
      }
    }
  }

  const avgFirstCalvingAge = mean(firstCalvingAges);

  // ============================================
  // RESULTADO FINAL
  // ============================================

  const kpis: ZootechnicalKPIs = {
    weaningRate: Math.round(weaningRate * 10) / 10,
    avgWeaningWeight: Math.round(avgWeaningWeight * 10) / 10,
    calvingInterval: Math.round(calvingInterval),
    pregnancyRate: Math.round(pregnancyRate * 10) / 10,
    kgCalfPerCowYear: Math.round(kgCalfPerCowYear * 10) / 10,
    mortalityRate: Math.round(mortalityRate * 10) / 10,
    avgGMD: Math.round(avgGMD * 100) / 100,
    birthRate: Math.round(birthRate * 10) / 10,
    avgFirstCalvingAge: Math.round(avgFirstCalvingAge),
    avgBirthWeight: Math.round(avgBirthWeight * 10) / 10,
    avgYearlingWeight: Math.round(avgYearlingWeight * 10) / 10,
  };

  return {
    kpis,
    details: {
      totalAnimals: agg.totalAnimals,
      totalFemales: agg.females.length,
      totalMales: agg.males.length,
      totalActive: agg.active.length,
      totalDeaths: agg.dead.length,
      totalSold: agg.sold.length,
      calvesWeaned: agg.weanedCalves.length,
      exposedCows: agg.breedingAgeFemales.length,
      pregnantCows: pregnantCows.length,
      births: birthsLastYear.length,
      pregnantFromBreedingSeason,
      pregnantFromManualRecord,
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
  const lowerIsBetter = ['mortalityRate', 'calvingInterval', 'avgFirstCalvingAge'].includes(metric);

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
