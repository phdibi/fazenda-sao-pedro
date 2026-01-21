import {
  Animal,
  PerformanceComparison,
  BullProgenyComparison,
  RaceBenchmark,
  Raca,
  Sexo,
  WeighingType
} from '../types';
import { calcularGMDAnimal, calcularIdadeMeses } from './gmdCalculations';

// ============================================
// 📊 COMPARATIVO DE PERFORMANCE
// ============================================

/**
 * Gera comparativo de performance de todos os animais
 */
export const generatePerformanceComparison = (animals: Animal[]): PerformanceComparison[] => {
  const comparisons = animals
    .map(animal => {
      const gmd = calcularGMDAnimal(animal);
      const idade = calcularIdadeMeses(animal.dataNascimento);
      
      return {
        animalId: animal.id,
        brinco: animal.brinco,
        nome: animal.nome,
        raca: animal.raca,
        sexo: animal.sexo,
        idade,
        pesoAtual: animal.pesoKg,
        gmd: gmd.gmdTotal || 0,
        rankingGeral: 0, // Será calculado depois
        rankingRaca: 0,  // Será calculado depois
        paiNome: animal.paiNome,
        maeNome: animal.maeNome,
      };
    })
    .filter(c => c.gmd > 0)
    .sort((a, b) => b.gmd - a.gmd);

  // Calcula ranking geral
  comparisons.forEach((c, index) => {
    c.rankingGeral = index + 1;
  });

  // Calcula ranking por raça
  const racaGroups = new Map<Raca, PerformanceComparison[]>();
  comparisons.forEach(c => {
    if (!racaGroups.has(c.raca)) racaGroups.set(c.raca, []);
    racaGroups.get(c.raca)!.push(c);
  });

  racaGroups.forEach(group => {
    group.forEach((c, index) => {
      c.rankingRaca = index + 1;
    });
  });

  return comparisons;
};

/**
 * Compara filhos do mesmo touro
 */
export const compareBullProgeny = (animals: Animal[]): BullProgenyComparison[] => {
  const bullMap = new Map<string, Animal[]>();

  // Agrupa animais por pai
  animals.forEach(animal => {
    if (animal.paiNome) {
      const key = animal.paiNome.toUpperCase().trim();
      if (!bullMap.has(key)) bullMap.set(key, []);
      bullMap.get(key)!.push(animal);
    }
  });

  const comparisons: BullProgenyComparison[] = [];

  bullMap.forEach((offspring, bullName) => {
    if (offspring.length < 2) return; // Precisa de pelo menos 2 filhos para comparar

    const gmds = offspring
      .map(a => calcularGMDAnimal(a).gmdTotal || 0)
      .filter(g => g > 0);

    const weaningWeights = offspring
      .flatMap(a => a.historicoPesagens?.filter(p => p.type === WeighingType.Weaning) || [])
      .map(p => p.weightKg)
      .filter(w => w > 0);

    const yearlingWeights = offspring
      .flatMap(a => a.historicoPesagens?.filter(p => p.type === WeighingType.Yearling) || [])
      .map(p => p.weightKg)
      .filter(w => w > 0);

    // Encontra melhor filho
    let bestOffspring = { brinco: '', gmd: 0 };
    offspring.forEach(a => {
      const gmd = calcularGMDAnimal(a).gmdTotal || 0;
      if (gmd > bestOffspring.gmd) {
        bestOffspring = { brinco: a.brinco, gmd };
      }
    });

    comparisons.push({
      bullName,
      offspringCount: offspring.length,
      avgGMD: gmds.length ? average(gmds) : 0,
      avgWeaningWeight: weaningWeights.length ? average(weaningWeights) : 0,
      avgYearlingWeight: yearlingWeights.length ? average(yearlingWeights) : 0,
      bestOffspring,
    });
  });

  return comparisons.sort((a, b) => b.avgGMD - a.avgGMD);
};

/**
 * Gera benchmark por raça
 */
export const generateRaceBenchmarks = (animals: Animal[]): RaceBenchmark[] => {
  const racaMap = new Map<Raca, Animal[]>();

  // Agrupa por raça
  Object.values(Raca).forEach(raca => racaMap.set(raca, []));
  animals.forEach(animal => {
    racaMap.get(animal.raca)?.push(animal);
  });

  const benchmarks: RaceBenchmark[] = [];

  racaMap.forEach((group, raca) => {
    if (group.length === 0) return;

    const performances = generatePerformanceComparison(group);
    const weights = group.map(a => a.pesoKg);
    const ages = group.map(a => calcularIdadeMeses(a.dataNascimento)).filter(a => a > 0);
    const gmds = performances.map(p => p.gmd).filter(g => g > 0);

    benchmarks.push({
      raca,
      count: group.length,
      avgWeight: average(weights),
      avgGMD: gmds.length ? average(gmds) : 0,
      avgAge: ages.length ? average(ages) : 0,
      topPerformers: performances.slice(0, 5), // Top 5 da raça
    });
  });

  return benchmarks.filter(b => b.count > 0).sort((a, b) => b.avgGMD - a.avgGMD);
};

/**
 * Compara animais lado a lado
 */
export const compareAnimals = (
  animal1: Animal,
  animal2: Animal
): {
  animal1: { brinco: string; nome?: string; gmd: number; peso: number; idade: number };
  animal2: { brinco: string; nome?: string; gmd: number; peso: number; idade: number };
  winner: {
    gmd: '1' | '2' | 'tie';
    peso: '1' | '2' | 'tie';
  };
  percentDiff: {
    gmd: number;
    peso: number;
  };
} => {
  const gmd1 = calcularGMDAnimal(animal1).gmdTotal || 0;
  const gmd2 = calcularGMDAnimal(animal2).gmdTotal || 0;
  const idade1 = calcularIdadeMeses(animal1.dataNascimento);
  const idade2 = calcularIdadeMeses(animal2.dataNascimento);

  const result = {
    animal1: {
      brinco: animal1.brinco,
      nome: animal1.nome,
      gmd: gmd1,
      peso: animal1.pesoKg,
      idade: idade1,
    },
    animal2: {
      brinco: animal2.brinco,
      nome: animal2.nome,
      gmd: gmd2,
      peso: animal2.pesoKg,
      idade: idade2,
    },
    winner: {
      gmd: gmd1 > gmd2 ? '1' : gmd2 > gmd1 ? '2' : 'tie',
      peso: animal1.pesoKg > animal2.pesoKg ? '1' : animal2.pesoKg > animal1.pesoKg ? '2' : 'tie',
    },
    percentDiff: {
      gmd: gmd2 !== 0 ? ((gmd1 - gmd2) / gmd2) * 100 : 0,
      peso: animal2.pesoKg !== 0 ? ((animal1.pesoKg - animal2.pesoKg) / animal2.pesoKg) * 100 : 0,
    },
  };

  return result as any;
};

/**
 * Identifica animais com performance abaixo da média
 */
export const identifyUnderperformers = (
  animals: Animal[],
  threshold: number = 0.7 // 70% da média
): Animal[] => {
  const gmds = animals
    .map(a => ({ animal: a, gmd: calcularGMDAnimal(a).gmdTotal || 0 }))
    .filter(item => item.gmd > 0);

  if (gmds.length === 0) return [];

  const avgGMD = average(gmds.map(g => g.gmd));
  const cutoff = avgGMD * threshold;

  return gmds
    .filter(item => item.gmd < cutoff)
    .map(item => item.animal);
};

/**
 * Identifica top performers
 */
export const identifyTopPerformers = (
  animals: Animal[],
  count: number = 10
): Array<Animal & { gmd: number; ranking: number }> => {
  return animals
    .map(animal => ({
      ...animal,
      gmd: calcularGMDAnimal(animal).gmdTotal || 0,
      ranking: 0,
    }))
    .filter(a => a.gmd > 0)
    .sort((a, b) => b.gmd - a.gmd)
    .slice(0, count)
    .map((a, index) => ({ ...a, ranking: index + 1 }));
};

// Helper
const average = (arr: number[]): number =>
  arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : 0;
