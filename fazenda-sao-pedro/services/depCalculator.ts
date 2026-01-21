/**
 * DEP Calculator - Diferença Esperada na Progênie
 *
 * ATUALIZADO: Agora usa índices pré-computados e progênie unificada
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
  Raca,
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
// ÍNDICES PRÉ-COMPUTADOS
// ============================================

interface DEPIndices {
  byId: Map<string, Animal>;
  byBrinco: Map<string, Animal>;
  byPaiNome: Map<string, Animal[]>;
  byMaeNome: Map<string, Animal[]>;
  // Índices por ID (mais confiáveis que por nome)
  byPaiId: Map<string, Animal[]>;
  byMaeId: Map<string, Animal[]>;
  byRaca: Map<string, Animal[]>;
}

/**
 * Constrói índices em uma única passagem O(n)
 */
const buildIndices = (animals: Animal[]): DEPIndices => {
  const byId = new Map<string, Animal>();
  const byBrinco = new Map<string, Animal>();
  const byPaiNome = new Map<string, Animal[]>();
  const byMaeNome = new Map<string, Animal[]>();
  const byPaiId = new Map<string, Animal[]>();
  const byMaeId = new Map<string, Animal[]>();
  const byRaca = new Map<string, Animal[]>();

  for (const animal of animals) {
    byId.set(animal.id, animal);
    byBrinco.set(animal.brinco.toLowerCase().trim(), animal);

    // Por paiNome
    if (animal.paiNome) {
      const key = animal.paiNome.toLowerCase().trim();
      if (!byPaiNome.has(key)) byPaiNome.set(key, []);
      byPaiNome.get(key)!.push(animal);
    }

    // Por maeNome
    if (animal.maeNome) {
      const key = animal.maeNome.toLowerCase().trim();
      if (!byMaeNome.has(key)) byMaeNome.set(key, []);
      byMaeNome.get(key)!.push(animal);
    }

    // Por paiId (mais confiável)
    if (animal.paiId) {
      if (!byPaiId.has(animal.paiId)) byPaiId.set(animal.paiId, []);
      byPaiId.get(animal.paiId)!.push(animal);
    }

    // Por maeId (mais confiável)
    if (animal.maeId) {
      if (!byMaeId.has(animal.maeId)) byMaeId.set(animal.maeId, []);
      byMaeId.get(animal.maeId)!.push(animal);
    }

    // Por raça
    const raca = animal.raca || Raca.Outros;
    if (!byRaca.has(raca)) byRaca.set(raca, []);
    byRaca.get(raca)!.push(animal);
  }

  return { byId, byBrinco, byPaiNome, byMaeNome, byPaiId, byMaeId, byRaca };
};

// ============================================
// HELPERS
// ============================================

/**
 * Obtém peso por tipo de pesagem (usa WeighingType enum padronizado)
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
// PROGÊNIE UNIFICADA
// ============================================

/**
 * Obtém progênie de um animal unificando três fontes:
 * 1. historicoProgenie (registro manual)
 * 2. paiNome/maeNome (busca reversa por índices)
 * 3. paiId/maeId (busca reversa por índices - mais confiável)
 */
const getUnifiedProgeny = (
  animal: Animal,
  indices: DEPIndices
): Animal[] => {
  const progenySet = new Set<string>();
  const result: Animal[] = [];

  // Fonte 1: historicoProgenie
  if (animal.historicoProgenie) {
    for (const p of animal.historicoProgenie) {
      const key = p.offspringBrinco.toLowerCase().trim();
      if (!progenySet.has(key)) {
        const offspring = indices.byBrinco.get(key);
        if (offspring) {
          progenySet.add(key);
          result.push(offspring);
        }
      }
    }
  }

  // Fonte 2: Busca reversa por paiNome/maeNome usando índices
  const animalNames = [
    animal.nome?.toLowerCase().trim(),
    animal.brinco.toLowerCase().trim(),
  ].filter(Boolean) as string[];

  for (const name of animalNames) {
    // Se macho, busca por paiNome
    if (animal.sexo === Sexo.Macho) {
      const children = indices.byPaiNome.get(name) || [];
      for (const child of children) {
        const key = child.brinco.toLowerCase().trim();
        if (!progenySet.has(key)) {
          progenySet.add(key);
          result.push(child);
        }
      }
    }

    // Se fêmea, busca por maeNome
    if (animal.sexo === Sexo.Femea) {
      const children = indices.byMaeNome.get(name) || [];
      for (const child of children) {
        const key = child.brinco.toLowerCase().trim();
        if (!progenySet.has(key)) {
          progenySet.add(key);
          result.push(child);
        }
      }
    }
  }

  // Fonte 3: Busca por paiId/maeId usando índices (O(1) lookup - mais confiável)
  if (animal.sexo === Sexo.Macho) {
    const childrenByPaiId = indices.byPaiId.get(animal.id) || [];
    for (const child of childrenByPaiId) {
      const key = child.brinco.toLowerCase().trim();
      if (!progenySet.has(key)) {
        progenySet.add(key);
        result.push(child);
      }
    }
  }

  if (animal.sexo === Sexo.Femea) {
    const childrenByMaeId = indices.byMaeId.get(animal.id) || [];
    for (const child of childrenByMaeId) {
      const key = child.brinco.toLowerCase().trim();
      if (!progenySet.has(key)) {
        progenySet.add(key);
        result.push(child);
      }
    }
  }

  return result;
};

/**
 * Obtém irmãos de um animal usando índices
 * ATUALIZADO: Usa índices byPaiId/byMaeId para O(1) lookup
 */
const getSiblings = (animal: Animal, indices: DEPIndices): Animal[] => {
  const siblingSet = new Set<string>();
  const result: Animal[] = [];

  // Irmãos por paiNome
  if (animal.paiNome) {
    const siblings = indices.byPaiNome.get(animal.paiNome.toLowerCase().trim()) || [];
    for (const sib of siblings) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

  // Irmãos por maeNome
  if (animal.maeNome) {
    const siblings = indices.byMaeNome.get(animal.maeNome.toLowerCase().trim()) || [];
    for (const sib of siblings) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

  // Irmãos por paiId usando índice (O(1) lookup)
  if (animal.paiId) {
    const siblingsByPaiId = indices.byPaiId.get(animal.paiId) || [];
    for (const sib of siblingsByPaiId) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

  // Irmãos por maeId usando índice (O(1) lookup)
  if (animal.maeId) {
    const siblingsByMaeId = indices.byMaeId.get(animal.maeId) || [];
    for (const sib of siblingsByMaeId) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

  return result;
};

// ============================================
// CÁLCULO DE BASELINE DO REBANHO
// ============================================

/**
 * Calcula médias e desvios padrão do rebanho por raça
 * OTIMIZADO: Usa índices pré-computados
 */
export const calculateHerdBaseline = (animals: Animal[], indices?: DEPIndices): HerdDEPBaseline[] => {
  const idx = indices || buildIndices(animals);
  const baselines: HerdDEPBaseline[] = [];

  idx.byRaca.forEach((raceAnimals, raca) => {
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
        birthWeight: { mean: mean(birthWeights), stdDev: stdDev(birthWeights) },
        weaningWeight: { mean: mean(weaningWeights), stdDev: stdDev(weaningWeights) },
        yearlingWeight: { mean: mean(yearlingWeights), stdDev: stdDev(yearlingWeights) },
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
  baseline: HerdDEPBaseline;
  indices: DEPIndices;
}

/**
 * Calcula DEP para um animal específico
 * OTIMIZADO: Usa progênie unificada e índices (byPaiId/byMaeId)
 */
export const calculateAnimalDEP = ({
  animal,
  baseline,
  indices,
}: DEPCalculationInput): DEPReport => {
  // Coleta dados do próprio animal (usa WeighingType enum)
  const ownBirthWeight = getWeightByType(animal, WeighingType.Birth);
  const ownWeaningWeight = getWeightByType(animal, WeighingType.Weaning);
  const ownYearlingWeight = getWeightByType(animal, WeighingType.Yearling);

  // Coleta dados de progênie (USANDO FUNÇÃO UNIFICADA)
  const progeny = getUnifiedProgeny(animal, indices);

  const progenyBirthWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Birth))
    .filter((w): w is number => w !== null && w > 0);

  const progenyWeaningWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Weaning))
    .filter((w): w is number => w !== null && w > 0);

  const progenyYearlingWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Yearling))
    .filter((w): w is number => w !== null && w > 0);

  // Coleta dados de irmãos (USANDO ÍNDICES + paiId/maeId)
  const siblings = getSiblings(animal, indices);

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

  const calculateSingleDEP = (
    ownValue: number | null,
    progenyValues: number[],
    baselineMean: number,
    heritability: number
  ): number => {
    let dep = 0;
    let weight = 0;

    if (ownValue !== null && ownValue > 0 && baselineMean > 0) {
      const ownDEP = (heritability * (ownValue - baselineMean)) / 2;
      dep += ownDEP * 0.5;
      weight += 0.5;
    }

    if (progenyValues.length > 0 && baselineMean > 0) {
      const progenyMean = mean(progenyValues);
      const progenyDEP = 2 * (progenyMean - baselineMean);
      const progenyWeight = Math.min(1, progenyValues.length / 10);
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
    milkProduction:
      animal.sexo === Sexo.Femea && progenyWeaningWeights.length > 0
        ? calculateSingleDEP(null, progenyWeaningWeights, baseline.metrics.weaningWeight.mean, HERITABILITIES.milkProduction)
        : 0,
    totalMaternal: 0,
  };

  if (animal.sexo === Sexo.Femea) {
    depValues.totalMaternal = depValues.weaningWeight + depValues.milkProduction;
  }

  // ============================================
  // CÁLCULO DAS ACURÁCIAS
  // ============================================

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
  // CÁLCULO DOS PERCENTIS (USANDO ÍNDICES)
  // ============================================

  const raceAnimals = indices.byRaca.get(animal.raca || Raca.Outros) || [];

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
    milkProduction: animal.sexo === Sexo.Femea ? 50 : 0,
    totalMaternal: animal.sexo === Sexo.Femea ? 50 : 0,
  };

  // ============================================
  // RECOMENDAÇÃO
  // ============================================

  let recommendation: DEPReport['recommendation'] = 'indefinido';

  const avgPercentile = (percentile.weaningWeight + percentile.yearlingWeight) / 2;
  const avgAccuracy = (accuracy.weaningWeight + accuracy.yearlingWeight) / 2;

  if (animal.sexo === Sexo.Macho) {
    if (avgPercentile >= 80 && avgAccuracy >= 0.5) recommendation = 'reprodutor_elite';
    else if (avgPercentile >= 60 && avgAccuracy >= 0.3) recommendation = 'reprodutor';
    else if (avgPercentile < 30) recommendation = 'descarte';
  } else {
    if (avgPercentile >= 80 && avgAccuracy >= 0.4) recommendation = 'matriz_elite';
    else if (avgPercentile >= 50) recommendation = 'matriz';
    else if (avgPercentile < 20) recommendation = 'descarte';
  }

  return {
    animalId: animal.id,
    brinco: animal.brinco,
    nome: animal.nome,
    sexo: animal.sexo,
    raca: animal.raca || Raca.Outros,
    dep: {
      ...depValues,
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
// CÁLCULO EM LOTE (OTIMIZADO)
// ============================================

/**
 * Calcula DEPs para todos os animais do rebanho
 * OTIMIZADO: Constrói índices uma única vez
 */
export const calculateAllDEPs = (animals: Animal[]): DEPReport[] => {
  // Constrói índices uma única vez
  const indices = buildIndices(animals);

  // Calcula baselines usando índices
  const baselines = calculateHerdBaseline(animals, indices);

  return animals.map((animal) => {
    const baseline = baselines.find((b) => b.raca === (animal.raca || Raca.Outros)) || baselines[0];

    if (!baseline) {
      return {
        animalId: animal.id,
        brinco: animal.brinco,
        nome: animal.nome,
        sexo: animal.sexo,
        raca: animal.raca || Raca.Outros,
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
      baseline,
      indices,
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

// ============================================
// EXPORTA ÍNDICES PARA USO EXTERNO
// ============================================

export { buildIndices, getUnifiedProgeny, getSiblings };
export type { DEPIndices };
