/**
 * 🔧 DEP Calculator - Diferença Esperada na Progênie
 *
 * Calcula DEPs (Expected Progeny Differences) para seleção genética:
 * - DEP para peso ao nascimento, desmame e sobreano
 * - Habilidade materna (para fêmeas com progênie)
 * - Acurácia baseada no número de informações
 * - Percentis dentro do rebanho
 * - Recomendações de seleção
 */

import {
  Animal,
  Sexo,
  WeighingType,
  DEPReport,
  DEPValues,
  HerdDEPBaseline,
} from '../types';

// ============================================
// CONFIGURAÇÃO
// ============================================

// Heritabilidades médias (h²) para raças zebuínas/taurinas
const HERITABILITIES = {
  birthWeight: 0.35,
  weaningWeight: 0.25,
  yearlingWeight: 0.30,
  milkProduction: 0.20,
};

// Fator de correção para acurácia baseado no número de informações
const getAccuracyFactor = (n: number): number => {
  if (n === 0) return 0;
  if (n === 1) return 0.30;
  if (n <= 3) return 0.45;
  if (n <= 5) return 0.55;
  if (n <= 10) return 0.65;
  if (n <= 20) return 0.75;
  if (n <= 50) return 0.85;
  return 0.90;
};

// ============================================
// HELPERS
// ============================================

/**
 * Obtém peso por tipo de pesagem
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

/**
 * Calcula desvio padrão
 */
const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

/**
 * Calcula percentil de um valor em uma distribuição
 */
const calculatePercentile = (value: number, allValues: number[]): number => {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sorted.length) * 100);
};

// ============================================
// CÁLCULO DE BASELINE DO REBANHO
// ============================================

/**
 * Calcula médias e desvios padrão do rebanho por raça
 */
export const calculateHerdBaseline = (animals: Animal[]): HerdDEPBaseline[] => {
  const byRace = new Map<string, Animal[]>();

  animals.forEach((animal) => {
    const raca = animal.raca || 'Outros';
    if (!byRace.has(raca)) {
      byRace.set(raca, []);
    }
    byRace.get(raca)!.push(animal);
  });

  const baselines: HerdDEPBaseline[] = [];

  byRace.forEach((raceAnimals, raca) => {
    const birthWeights = raceAnimals
      .map((a) => getWeightByType(a, WeighingType.Birth))
      .filter((w): w is number => w !== null && w > 0);

    const weaningWeights = raceAnimals
      .map((a) => getWeightByType(a, WeighingType.Weaning))
      .filter((w): w is number => w !== null && w > 0);

    const yearlingWeights = raceAnimals
      .map((a) => getWeightByType(a, WeighingType.Yearling))
      .filter((w): w is number => w !== null && w > 0);

    baselines.push({
      raca,
      metrics: {
        birthWeight: {
          mean: mean(birthWeights),
          stdDev: stdDev(birthWeights),
        },
        weaningWeight: {
          mean: mean(weaningWeights),
          stdDev: stdDev(weaningWeights),
        },
        yearlingWeight: {
          mean: mean(yearlingWeights),
          stdDev: stdDev(yearlingWeights),
        },
      },
      updatedAt: new Date(),
    });
  });

  return baselines;
};

// ============================================
// CÁLCULO DE DEP INDIVIDUAL
// ============================================

interface DEPCalculationInput {
  animal: Animal;
  allAnimals: Animal[];
  baseline: HerdDEPBaseline;
}

/**
 * Calcula DEP para um animal específico
 */
export const calculateAnimalDEP = ({
  animal,
  allAnimals,
  baseline,
}: DEPCalculationInput): DEPReport => {
  // Coleta dados do próprio animal
  const ownBirthWeight = getWeightByType(animal, WeighingType.Birth);
  const ownWeaningWeight = getWeightByType(animal, WeighingType.Weaning);
  const ownYearlingWeight = getWeightByType(animal, WeighingType.Yearling);

  // Coleta dados de progênie (se for reprodutor/matriz)
  const progenyBrincos = (animal.historicoProgenie || []).map((p) => p.offspringBrinco.toLowerCase());
  const progeny = allAnimals.filter((a) => progenyBrincos.includes(a.brinco.toLowerCase()));

  const progenyBirthWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Birth))
    .filter((w): w is number => w !== null && w > 0);

  const progenyWeaningWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Weaning))
    .filter((w): w is number => w !== null && w > 0);

  const progenyYearlingWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Yearling))
    .filter((w): w is number => w !== null && w > 0);

  // Coleta dados de irmãos (mesmo pai ou mesma mãe)
  const siblingsMae = allAnimals.filter(
    (a) =>
      a.id !== animal.id &&
      animal.maeNome &&
      a.maeNome?.toLowerCase() === animal.maeNome.toLowerCase()
  );
  const siblingsPai = allAnimals.filter(
    (a) =>
      a.id !== animal.id &&
      animal.paiNome &&
      a.paiNome?.toLowerCase() === animal.paiNome.toLowerCase()
  );
  const siblings = [...new Set([...siblingsMae, ...siblingsPai])];

  // Contagem de registros para acurácia
  const dataSource = {
    ownRecords:
      (ownBirthWeight ? 1 : 0) + (ownWeaningWeight ? 1 : 0) + (ownYearlingWeight ? 1 : 0),
    progenyRecords: progenyBirthWeights.length + progenyWeaningWeights.length + progenyYearlingWeights.length,
    siblingsRecords: siblings.length,
  };

  // ============================================
  // CÁLCULO DOS DEPs
  // ============================================

  // DEP = h² × (valor observado - média) / 2 + contribuição de parentes

  const calculateSingleDEP = (
    ownValue: number | null,
    progenyValues: number[],
    baselineMean: number,
    heritability: number
  ): number => {
    let dep = 0;
    let weight = 0;

    // Contribuição do próprio valor
    if (ownValue !== null && ownValue > 0 && baselineMean > 0) {
      const ownDEP = (heritability * (ownValue - baselineMean)) / 2;
      dep += ownDEP * 0.5;
      weight += 0.5;
    }

    // Contribuição da progênie (mais confiável)
    if (progenyValues.length > 0 && baselineMean > 0) {
      const progenyMean = mean(progenyValues);
      const progenyDEP = 2 * (progenyMean - baselineMean); // 2× porque progênie recebe metade dos genes
      const progenyWeight = Math.min(1, progenyValues.length / 10); // Peso aumenta com mais progênie
      dep += progenyDEP * progenyWeight;
      weight += progenyWeight;
    }

    return weight > 0 ? dep / weight : 0;
  };

  const depValues: DEPValues = {
    birthWeight: calculateSingleDEP(
      ownBirthWeight,
      progenyBirthWeights,
      baseline.metrics.birthWeight.mean,
      HERITABILITIES.birthWeight
    ),
    weaningWeight: calculateSingleDEP(
      ownWeaningWeight,
      progenyWeaningWeights,
      baseline.metrics.weaningWeight.mean,
      HERITABILITIES.weaningWeight
    ),
    yearlingWeight: calculateSingleDEP(
      ownYearlingWeight,
      progenyYearlingWeights,
      baseline.metrics.yearlingWeight.mean,
      HERITABILITIES.yearlingWeight
    ),
    // Produção de leite estimada pelo peso ao desmame da progênie (para fêmeas)
    milkProduction:
      animal.sexo === Sexo.Femea && progenyWeaningWeights.length > 0
        ? calculateSingleDEP(null, progenyWeaningWeights, baseline.metrics.weaningWeight.mean, HERITABILITIES.milkProduction)
        : 0,
    // Habilidade Materna Total = DEP Desmame Direto + DEP Leite
    totalMaternal: 0, // Calculado abaixo
  };

  // Calcula Total Maternal para fêmeas
  if (animal.sexo === Sexo.Femea) {
    depValues.totalMaternal = depValues.weaningWeight + depValues.milkProduction;
  }

  // ============================================
  // CÁLCULO DAS ACURÁCIAS
  // ============================================

  const totalInfo = dataSource.ownRecords + dataSource.progenyRecords * 2 + dataSource.siblingsRecords * 0.5;

  const accuracy = {
    birthWeight: getAccuracyFactor(
      (ownBirthWeight ? 1 : 0) + progenyBirthWeights.length * 2
    ),
    weaningWeight: getAccuracyFactor(
      (ownWeaningWeight ? 1 : 0) + progenyWeaningWeights.length * 2
    ),
    yearlingWeight: getAccuracyFactor(
      (ownYearlingWeight ? 1 : 0) + progenyYearlingWeights.length * 2
    ),
    milkProduction: getAccuracyFactor(progenyWeaningWeights.length),
    totalMaternal: getAccuracyFactor(
      Math.floor((progenyWeaningWeights.length + (ownWeaningWeight ? 1 : 0)) / 2)
    ),
  };

  // ============================================
  // CÁLCULO DOS PERCENTIS
  // ============================================

  // Calcula DEPs para todos os animais da mesma raça para ranking
  const raceAnimals = allAnimals.filter((a) => a.raca === animal.raca);

  const allBirthDEPs = raceAnimals.map((a) => {
    const w = getWeightByType(a, WeighingType.Birth);
    return w && baseline.metrics.birthWeight.mean > 0
      ? (HERITABILITIES.birthWeight * (w - baseline.metrics.birthWeight.mean)) / 2
      : 0;
  });

  const allWeaningDEPs = raceAnimals.map((a) => {
    const w = getWeightByType(a, WeighingType.Weaning);
    return w && baseline.metrics.weaningWeight.mean > 0
      ? (HERITABILITIES.weaningWeight * (w - baseline.metrics.weaningWeight.mean)) / 2
      : 0;
  });

  const allYearlingDEPs = raceAnimals.map((a) => {
    const w = getWeightByType(a, WeighingType.Yearling);
    return w && baseline.metrics.yearlingWeight.mean > 0
      ? (HERITABILITIES.yearlingWeight * (w - baseline.metrics.yearlingWeight.mean)) / 2
      : 0;
  });

  const percentile = {
    birthWeight: calculatePercentile(depValues.birthWeight, allBirthDEPs),
    weaningWeight: calculatePercentile(depValues.weaningWeight, allWeaningDEPs),
    yearlingWeight: calculatePercentile(depValues.yearlingWeight, allYearlingDEPs),
    milkProduction: animal.sexo === Sexo.Femea ? 50 : 0, // Simplificado
    totalMaternal: animal.sexo === Sexo.Femea ? 50 : 0, // Simplificado
  };

  // ============================================
  // RECOMENDAÇÃO
  // ============================================

  let recommendation: DEPReport['recommendation'] = 'indefinido';

  const avgPercentile = (percentile.weaningWeight + percentile.yearlingWeight) / 2;
  const avgAccuracy = (accuracy.weaningWeight + accuracy.yearlingWeight) / 2;

  if (animal.sexo === Sexo.Macho) {
    if (avgPercentile >= 80 && avgAccuracy >= 0.5) {
      recommendation = 'reprodutor_elite';
    } else if (avgPercentile >= 60 && avgAccuracy >= 0.3) {
      recommendation = 'reprodutor';
    } else if (avgPercentile < 30) {
      recommendation = 'descarte';
    }
  } else {
    if (avgPercentile >= 80 && avgAccuracy >= 0.4) {
      recommendation = 'matriz_elite';
    } else if (avgPercentile >= 50) {
      recommendation = 'matriz';
    } else if (avgPercentile < 20) {
      recommendation = 'descarte';
    }
  }

  return {
    animalId: animal.id,
    brinco: animal.brinco,
    nome: animal.nome,
    sexo: animal.sexo,
    raca: animal.raca || 'Outros',
    dep: {
      ...depValues,
      // Arredonda valores
      birthWeight: Math.round(depValues.birthWeight * 10) / 10,
      weaningWeight: Math.round(depValues.weaningWeight * 10) / 10,
      yearlingWeight: Math.round(depValues.yearlingWeight * 10) / 10,
      milkProduction: Math.round(depValues.milkProduction * 10) / 10,
      totalMaternal: Math.round(depValues.totalMaternal * 10) / 10,
    },
    accuracy,
    percentile,
    dataSource,
    recommendation,
    calculatedAt: new Date(),
  };
};

// ============================================
// CÁLCULO EM LOTE
// ============================================

/**
 * Calcula DEPs para todos os animais do rebanho
 */
export const calculateAllDEPs = (animals: Animal[]): DEPReport[] => {
  const baselines = calculateHerdBaseline(animals);

  return animals.map((animal) => {
    const baseline = baselines.find((b) => b.raca === (animal.raca || 'Outros')) || baselines[0];

    if (!baseline) {
      // Retorna DEP vazio se não houver baseline
      return {
        animalId: animal.id,
        brinco: animal.brinco,
        nome: animal.nome,
        sexo: animal.sexo,
        raca: animal.raca || 'Outros',
        dep: {
          birthWeight: 0,
          weaningWeight: 0,
          yearlingWeight: 0,
          milkProduction: 0,
          totalMaternal: 0,
        },
        accuracy: {
          birthWeight: 0,
          weaningWeight: 0,
          yearlingWeight: 0,
          milkProduction: 0,
          totalMaternal: 0,
        },
        percentile: {
          birthWeight: 50,
          weaningWeight: 50,
          yearlingWeight: 50,
          milkProduction: 50,
          totalMaternal: 50,
        },
        dataSource: {
          ownRecords: 0,
          progenyRecords: 0,
          siblingsRecords: 0,
        },
        recommendation: 'indefinido',
        calculatedAt: new Date(),
      };
    }

    return calculateAnimalDEP({
      animal,
      allAnimals: animals,
      baseline,
    });
  });
};

/**
 * Filtra e ordena animais por DEP
 */
export const rankAnimalsByDEP = (
  reports: DEPReport[],
  metric: keyof DEPValues,
  ascending: boolean = false
): DEPReport[] => {
  return [...reports].sort((a, b) => {
    const valueA = a.dep[metric] || 0;
    const valueB = b.dep[metric] || 0;
    return ascending ? valueA - valueB : valueB - valueA;
  });
};

/**
 * Filtra reprodutores/matrizes de elite
 */
export const getEliteAnimals = (reports: DEPReport[]): DEPReport[] => {
  return reports.filter(
    (r) => r.recommendation === 'reprodutor_elite' || r.recommendation === 'matriz_elite'
  );
};

/**
 * Filtra animais para descarte
 */
export const getCullAnimals = (reports: DEPReport[]): DEPReport[] => {
  return reports.filter((r) => r.recommendation === 'descarte');
};
