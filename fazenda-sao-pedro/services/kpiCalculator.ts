/**
 * 🔧 KPI Calculator - Cálculo de Indicadores Zootécnicos
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
} from '../types';
import { calcularGMDAnimal } from '../utils/gmdCalculations';

// ============================================
// HELPERS
// ============================================

/**
 * Calcula idade em meses
 */
const getAgeInMonths = (birthDate: Date): number => {
  const now = new Date();
  const birth = new Date(birthDate);
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
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
 * Obtém peso por tipo de pesagem
 */
const getWeightByType = (animal: Animal, type: WeighingType): number | null => {
  const pesagem = animal.historicoPesagens?.find((p) => p.type === type);
  return pesagem?.weightKg ?? null;
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
  };
  warnings: string[];
  calculatedAt: Date;
}

/**
 * Calcula todos os KPIs zootécnicos do rebanho
 */
export const calculateZootechnicalKPIs = (animals: Animal[]): KPICalculationResult => {
  const warnings: string[] = [];

  // Filtra animais por status e sexo
  const activeAnimals = animals.filter((a) => a.status === AnimalStatus.Ativo);
  const deadAnimals = animals.filter((a) => a.status === AnimalStatus.Obito);
  const soldAnimals = animals.filter((a) => a.status === AnimalStatus.Vendido);

  const females = animals.filter((a) => a.sexo === Sexo.Femea);
  const activeFemales = activeAnimals.filter((a) => a.sexo === Sexo.Femea);
  const activeMales = activeAnimals.filter((a) => a.sexo === Sexo.Macho);

  // Vacas aptas à reprodução (>= 18 meses)
  const breedingAgeFemales = activeFemales.filter((a) => getAgeInMonths(a.dataNascimento) >= 18);

  // Bezerros (< 12 meses)
  const calves = activeAnimals.filter((a) => getAgeInMonths(a.dataNascimento) < 12);

  // ============================================
  // 1. TAXA DE MORTALIDADE
  // ============================================
  const mortalityRate = animals.length > 0 ? (deadAnimals.length / animals.length) * 100 : 0;

  // ============================================
  // 2. PESOS MÉDIOS
  // ============================================

  // Peso ao nascimento
  const birthWeights = animals
    .map((a) => getWeightByType(a, WeighingType.Birth))
    .filter((w): w is number => w !== null && w > 0);
  const avgBirthWeight = birthWeights.length > 0 ? birthWeights.reduce((a, b) => a + b, 0) / birthWeights.length : 0;

  if (birthWeights.length < 5) {
    warnings.push('Poucos registros de peso ao nascimento para cálculo preciso');
  }

  // Peso ao desmame
  const weaningWeights = animals
    .map((a) => getWeightByType(a, WeighingType.Weaning))
    .filter((w): w is number => w !== null && w > 0);
  const avgWeaningWeight =
    weaningWeights.length > 0 ? weaningWeights.reduce((a, b) => a + b, 0) / weaningWeights.length : 0;

  if (weaningWeights.length < 5) {
    warnings.push('Poucos registros de peso ao desmame para cálculo preciso');
  }

  // Peso ao sobreano
  const yearlingWeights = animals
    .map((a) => getWeightByType(a, WeighingType.Yearling))
    .filter((w): w is number => w !== null && w > 0);
  const avgYearlingWeight =
    yearlingWeights.length > 0 ? yearlingWeights.reduce((a, b) => a + b, 0) / yearlingWeights.length : 0;

  // ============================================
  // 3. TAXA DE DESMAME
  // ============================================
  // Bezerros com peso ao desmame / vacas em idade reprodutiva
  const weanedCalves = animals.filter((a) => getWeightByType(a, WeighingType.Weaning) !== null);
  const weaningRate = breedingAgeFemales.length > 0 ? (weanedCalves.length / breedingAgeFemales.length) * 100 : 0;

  // ============================================
  // 4. TAXA DE PRENHEZ
  // ============================================
  // Vacas com histórico de prenhez positivo / vacas expostas
  const pregnantCows = activeFemales.filter(
    (a) => a.historicoPrenhez && a.historicoPrenhez.some((p) => p.type === 'positive')
  );
  const pregnancyRate = breedingAgeFemales.length > 0 ? (pregnantCows.length / breedingAgeFemales.length) * 100 : 0;

  // ============================================
  // 5. TAXA DE NATALIDADE
  // ============================================
  // Contamos nascimentos pelo número de animais com data de nascimento no último ano
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const birthsLastYear = animals.filter((a) => new Date(a.dataNascimento) >= oneYearAgo);
  const birthRate = breedingAgeFemales.length > 0 ? (birthsLastYear.length / breedingAgeFemales.length) * 100 : 0;

  // ============================================
  // 6. INTERVALO ENTRE PARTOS (IEP)
  // ============================================
  // Calculado a partir do histórico de progênie das vacas
  const calvingIntervals: number[] = [];

  females.forEach((cow) => {
    if (cow.historicoProgenie && cow.historicoProgenie.length >= 2) {
      // Ordena pela data de nascimento dos filhos (precisamos buscar os animais filhos)
      const offspringBrincos = cow.historicoProgenie.map((p) => p.offspringBrinco.toLowerCase());
      const offspring = animals.filter((a) => offspringBrincos.includes(a.brinco.toLowerCase()));

      if (offspring.length >= 2) {
        const birthDates = offspring.map((o) => new Date(o.dataNascimento)).sort((a, b) => a.getTime() - b.getTime());

        for (let i = 1; i < birthDates.length; i++) {
          const interval = getDaysBetween(birthDates[i - 1], birthDates[i]);
          if (interval > 200 && interval < 730) {
            // Entre 200 e 730 dias é razoável
            calvingIntervals.push(interval);
          }
        }
      }
    }
  });

  const calvingInterval =
    calvingIntervals.length > 0 ? calvingIntervals.reduce((a, b) => a + b, 0) / calvingIntervals.length : 0;

  if (calvingIntervals.length < 3) {
    warnings.push('Poucos registros de partos para cálculo preciso do IEP');
  }

  // ============================================
  // 7. GMD MÉDIO DO REBANHO
  // ============================================
  const gmdValues: number[] = [];
  activeAnimals.forEach((animal) => {
    const gmd = calcularGMDAnimal(animal);
    if (gmd?.gmdTotal && gmd.gmdTotal > 0) {
      gmdValues.push(gmd.gmdTotal);
    }
  });

  const avgGMD = gmdValues.length > 0 ? gmdValues.reduce((a, b) => a + b, 0) / gmdValues.length : 0;

  // ============================================
  // 8. KG DE BEZERRO/VACA/ANO
  // ============================================
  // (Peso médio desmame × Taxa desmame) / 100
  const kgCalfPerCowYear = (avgWeaningWeight * weaningRate) / 100;

  // ============================================
  // 9. IDADE MÉDIA AO PRIMEIRO PARTO
  // ============================================
  const firstCalvingAges: number[] = [];

  females.forEach((cow) => {
    if (cow.historicoProgenie && cow.historicoProgenie.length > 0) {
      const firstOffspringBrinco = cow.historicoProgenie[0].offspringBrinco.toLowerCase();
      const firstOffspring = animals.find((a) => a.brinco.toLowerCase() === firstOffspringBrinco);

      if (firstOffspring) {
        const cowBirthDate = new Date(cow.dataNascimento);
        const offspringBirthDate = new Date(firstOffspring.dataNascimento);
        const ageAtFirstCalving =
          (offspringBirthDate.getFullYear() - cowBirthDate.getFullYear()) * 12 +
          (offspringBirthDate.getMonth() - cowBirthDate.getMonth());

        if (ageAtFirstCalving >= 18 && ageAtFirstCalving <= 48) {
          // Razoável: entre 18 e 48 meses
          firstCalvingAges.push(ageAtFirstCalving);
        }
      }
    }
  });

  const avgFirstCalvingAge =
    firstCalvingAges.length > 0 ? firstCalvingAges.reduce((a, b) => a + b, 0) / firstCalvingAges.length : 0;

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
      totalAnimals: animals.length,
      totalFemales: females.length,
      totalMales: animals.filter((a) => a.sexo === Sexo.Macho).length,
      totalActive: activeAnimals.length,
      totalDeaths: deadAnimals.length,
      totalSold: soldAnimals.length,
      calvesWeaned: weanedCalves.length,
      exposedCows: breedingAgeFemales.length,
      pregnantCows: pregnantCows.length,
      births: birthsLastYear.length,
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
  deviation: number; // % de desvio do target
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

  // Calcula desvio do target
  const deviation = target.target !== 0 ? ((value - target.target) / target.target) * 100 : 0;

  // Determina status baseado nos thresholds
  // Para métricas onde menor é melhor (mortalidade, IEP, idade 1º parto)
  const lowerIsBetter = ['mortalityRate', 'calvingInterval', 'avgFirstCalvingAge'].includes(metric);

  let status: KPIStatus;

  if (lowerIsBetter) {
    if (value <= target.excellent) {
      status = 'excellent';
    } else if (value <= target.target) {
      status = 'good';
    } else if (value <= target.minAcceptable) {
      status = 'warning';
    } else {
      status = 'critical';
    }
  } else {
    if (value >= target.excellent) {
      status = 'excellent';
    } else if (value >= target.target) {
      status = 'good';
    } else if (value >= target.minAcceptable) {
      status = 'warning';
    } else {
      status = 'critical';
    }
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
