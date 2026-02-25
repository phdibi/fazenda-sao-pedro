/**
 * DEP Calculator - Diferença Esperada na Progênie
 *
 * Implementação baseada em metodologia simplificada de índice de seleção
 * compatível com os princípios do BLUP (Best Linear Unbiased Prediction).
 *
 * Referências:
 * - Bourdon, R.M. (2000). Understanding Animal Breeding.
 * - BIF Guidelines for Uniform Beef Improvement Programs.
 * - Lôbo, R.B. et al. - PMGRN/ANCP (Programa de Melhoramento Genético de Raças Zebuínas)
 *
 * Calcula:
 * - DEPs para peso ao nascimento, desmame, sobreano
 * - Habilidade Materna (efeito materno separado do direto)
 * - Acurácia baseada na fórmula r = sqrt(1 - PEV/σ²a) simplificada
 * - Percentis consistentes dentro do rebanho
 * - Recomendações de seleção
 */

import {
  Animal,
  Sexo,
  Raca,
  AnimalStatus,
  WeighingType,
  BiometricType,
  DEPReport,
  DEPValues,
  HerdDEPBaseline,
} from '../types';
import { isInReferencePeriod } from '../utils/referencePeriod';

// ============================================
// CONFIGURAÇÃO - PARÂMETROS GENÉTICOS
// ============================================

// Heritabilidades médias (h²) - valores da literatura para raças de corte
const HERITABILITIES = {
  birthWeight: 0.30,       // PN: h² moderada-alta
  weaningWeight: 0.20,     // PD: h² moderada (efeito materno confunde)
  yearlingWeight: 0.30,    // PS: h² moderada-alta
  maternalWeaning: 0.15,   // Efeito materno sobre peso desmame
  // Carcaça (BIF Guidelines for Uniform Beef Improvement Programs)
  ribeyeArea: 0.40,        // AOL: h² alta (ultrassom)
  fatThickness: 0.40,      // EGS: h² alta (ultrassom)
  // Fertilidade
  scrotalCircumference: 0.45, // PE: h² alta (indicador de precocidade sexual)
  stayability: 0.15,       // Permanência: h² baixa (característica limiar/binária)
};

// ============================================
// CÁLCULO DE ACURÁCIA SIMPLIFICADA
// ============================================

/**
 * Calcula a acurácia de uma DEP usando aproximação simplificada
 * baseada no número e tipo de informações disponíveis.
 *
 * Fórmula: r ≈ sqrt(n × h² / (1 + (n-1) × h²))
 * onde n é o número efetivo de informações.
 *
 * - Registro próprio contribui com fator 1.0
 * - Cada progênie contribui com fator que depende de n_prog e h²
 * - Irmãos contribuem com fator reduzido
 *
 * @param nOwn - Número de registros próprios (0 ou 1)
 * @param nProgeny - Número de progênie com registro
 * @param nSiblings - Número de irmãos com registro
 * @param h2 - Herdabilidade da característica
 */
const calculateAccuracy = (
  nOwn: number,
  nProgeny: number,
  nSiblings: number,
  h2: number,
): number => {
  if (nOwn === 0 && nProgeny === 0 && nSiblings === 0) return 0;

  // Informação própria: contribui com h² diretamente
  // r² = h² quando só tem registro próprio
  let r2 = 0;

  if (nOwn > 0) {
    // Com registro próprio: r² = h²
    r2 = h2;
  }

  if (nProgeny > 0) {
    // Contribuição de progênie:
    // r² da progênie ≈ n_p / (n_p + (4 - h²) / h²)
    // Isso é derivado da fórmula de acurácia para informação de progênie
    // assumindo que os acasalamentos são com touros/vacas aleatórios
    const k = (4 - h2) / h2;
    const r2_progeny = nProgeny / (nProgeny + k);

    // Combina informação própria + progênie
    // Informação de progênie é mais valiosa que própria quando n é grande
    r2 = Math.max(r2, r2_progeny);

    // Se tem ambos, a acurácia é maior que qualquer um isolado
    if (nOwn > 0) {
      r2 = r2_progeny + h2 * (1 - r2_progeny);
    }
  }

  if (nSiblings > 0 && r2 < 0.9) {
    // Irmãos meio-irmãos: relação de parentesco = 0.25
    // Contribuição adicional pequena
    const sibContrib = (nSiblings * 0.25 * h2) / (1 + (nSiblings - 1) * 0.25 * h2);
    // Só adiciona o que não está já coberto
    r2 = r2 + sibContrib * (1 - r2) * 0.5;
  }

  // Limita entre 0 e 0.99
  r2 = Math.min(0.99, Math.max(0, r2));

  return Math.round(Math.sqrt(r2) * 100) / 100;
};

// ============================================
// ÍNDICES PRÉ-COMPUTADOS
// ============================================

interface DEPIndices {
  byId: Map<string, Animal>;
  byBrinco: Map<string, Animal>;
  byPaiNome: Map<string, Animal[]>;
  byMaeNome: Map<string, Animal[]>;
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

    if (animal.paiNome) {
      const key = animal.paiNome.toLowerCase().trim();
      if (!byPaiNome.has(key)) byPaiNome.set(key, []);
      byPaiNome.get(key)!.push(animal);
    }

    if (animal.maeNome) {
      const key = animal.maeNome.toLowerCase().trim();
      if (!byMaeNome.has(key)) byMaeNome.set(key, []);
      byMaeNome.get(key)!.push(animal);
    }

    if (animal.paiId) {
      if (!byPaiId.has(animal.paiId)) byPaiId.set(animal.paiId, []);
      byPaiId.get(animal.paiId)!.push(animal);
    }

    if (animal.maeId) {
      if (!byMaeId.has(animal.maeId)) byMaeId.set(animal.maeId, []);
      byMaeId.get(animal.maeId)!.push(animal);
    }

    const raca = animal.raca || Raca.Outros;
    if (!byRaca.has(raca)) byRaca.set(raca, []);
    byRaca.get(raca)!.push(animal);
  }

  return { byId, byBrinco, byPaiNome, byMaeNome, byPaiId, byMaeId, byRaca };
};

// ============================================
// HELPERS
// ============================================

const getWeightByType = (animal: Animal, type: WeighingType): number | null => {
  const pesagem = animal.historicoPesagens?.find((p) => p.type === type);
  return pesagem?.weightKg ?? null;
};

/**
 * Obtém a medição biométrica mais recente de um animal por tipo.
 * Usado para AOL (ribeyeArea), Gordura (fatThickness) e PE (scrotalCircumference).
 */
const getLatestBiometric = (
  animal: Animal,
  type: BiometricType,
): number | null => {
  if (!animal.historicoBiometria || animal.historicoBiometria.length === 0) return null;
  const measurements = animal.historicoBiometria
    .filter(b => b.type === type)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return measurements.length > 0 ? measurements[0].value : null;
};

/**
 * Calcula a idade do animal em meses.
 */
const getAgeInMonths = (animal: Animal): number | null => {
  if (!animal.dataNascimento) return null;
  const now = new Date();
  const birth = new Date(animal.dataNascimento);
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
};

const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
};

/**
 * Calcula percentil de um valor em uma distribuição.
 * Usa interpolação para valores entre pontos.
 * Exclui zeros (animais sem dados) da distribuição.
 */
const calculatePercentile = (value: number, allValues: number[]): number => {
  // Filtra zeros - animais sem dados não devem estar na distribuição
  const nonZero = allValues.filter(v => v !== 0);
  if (nonZero.length === 0) return 50;

  const sorted = [...nonZero].sort((a, b) => a - b);

  // Se o valor é zero (sem dados), retorna 50 (indefinido)
  if (value === 0) return 50;

  let below = 0;
  for (const v of sorted) {
    if (v < value) below++;
    else break;
  }

  return Math.round((below / sorted.length) * 100);
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
 */
const getSiblings = (animal: Animal, indices: DEPIndices): Animal[] => {
  const siblingSet = new Set<string>();
  const result: Animal[] = [];

  if (animal.paiNome) {
    const siblings = indices.byPaiNome.get(animal.paiNome.toLowerCase().trim()) || [];
    for (const sib of siblings) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

  if (animal.maeNome) {
    const siblings = indices.byMaeNome.get(animal.maeNome.toLowerCase().trim()) || [];
    for (const sib of siblings) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

  if (animal.paiId) {
    const siblingsByPaiId = indices.byPaiId.get(animal.paiId) || [];
    for (const sib of siblingsByPaiId) {
      if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
        siblingSet.add(sib.id);
        result.push(sib);
      }
    }
  }

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
 * Calcula médias e desvios padrão do rebanho por raça.
 * Usado como base de comparação para DEPs.
 * Filtra animais pelo período de referência (2025+).
 */
export const calculateHerdBaseline = (animals: Animal[], indices?: DEPIndices): HerdDEPBaseline[] => {
  const idx = indices || buildIndices(animals);
  const baselines: HerdDEPBaseline[] = [];

  idx.byRaca.forEach((raceAnimals, raca) => {
    const raceAnimalsInPeriod = raceAnimals.filter(isInReferencePeriod);
    if (raceAnimalsInPeriod.length === 0) return;

    const birthWeights = raceAnimalsInPeriod
      .map((a) => getWeightByType(a, WeighingType.Birth))
      .filter((w): w is number => w !== null && w > 0);

    const weaningWeights = raceAnimalsInPeriod
      .map((a) => getWeightByType(a, WeighingType.Weaning))
      .filter((w): w is number => w !== null && w > 0);

    const yearlingWeights = raceAnimalsInPeriod
      .map((a) => getWeightByType(a, WeighingType.Yearling))
      .filter((w): w is number => w !== null && w > 0);

    // Biometria - Carcaça (todos os animais com medição)
    const ribeyeAreas = raceAnimalsInPeriod
      .map((a) => getLatestBiometric(a, 'ribeyeArea'))
      .filter((v): v is number => v !== null && v > 0);

    const fatThicknesses = raceAnimalsInPeriod
      .map((a) => getLatestBiometric(a, 'fatThickness'))
      .filter((v): v is number => v !== null && v > 0);

    // Biometria - Fertilidade (PE apenas machos)
    const scrotalCircumferences = raceAnimalsInPeriod
      .filter((a) => a.sexo === Sexo.Macho)
      .map((a) => getLatestBiometric(a, 'scrotalCircumference'))
      .filter((v): v is number => v !== null && v > 0);

    baselines.push({
      raca,
      metrics: {
        birthWeight: { mean: mean(birthWeights), stdDev: stdDev(birthWeights) },
        weaningWeight: { mean: mean(weaningWeights), stdDev: stdDev(weaningWeights) },
        yearlingWeight: { mean: mean(yearlingWeights), stdDev: stdDev(yearlingWeights) },
        // Carcaça (condicional: só se há medições suficientes para baseline)
        ...(ribeyeAreas.length >= 2 && {
          ribeyeArea: { mean: mean(ribeyeAreas), stdDev: stdDev(ribeyeAreas) },
        }),
        ...(fatThicknesses.length >= 2 && {
          fatThickness: { mean: mean(fatThicknesses), stdDev: stdDev(fatThicknesses) },
        }),
        // Fertilidade
        ...(scrotalCircumferences.length >= 2 && {
          scrotalCircumference: { mean: mean(scrotalCircumferences), stdDev: stdDev(scrotalCircumferences) },
        }),
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
 * Calcula a DEP para uma única característica usando índice de seleção.
 *
 * Fontes de informação e seus pesos:
 * 1. Registro próprio: DEP = h² × (valor - média) / 2
 *    O /2 é porque o animal transmite apenas metade dos genes.
 *
 * 2. Progênie: DEP = (média_prog - média_rebanho) × regressão
 *    A regressão para a média é: r = n / (n + k), onde k = (4 - h²)/h²
 *    NÃO se multiplica por 2 diretamente - a regressão já corrige.
 *
 * 3. Combinação: Quando há ambas fontes, combina pela acurácia relativa.
 */
const calculateSingleDEP = (
  ownValue: number | null,
  progenyValues: number[],
  baselineMean: number,
  h2: number,
): number => {
  if (baselineMean <= 0) return 0;

  let depOwn = 0;
  let accOwn = 0;
  let depProg = 0;
  let accProg = 0;

  // 1. DEP baseada no registro próprio
  if (ownValue !== null && ownValue > 0) {
    // DEP_own = (h² / 2) × (valor - média)
    // Dividido por 2 porque o animal transmite metade dos genes
    depOwn = (h2 * (ownValue - baselineMean)) / 2;
    accOwn = h2; // r² = h² para registro próprio
  }

  // 2. DEP baseada na progênie
  if (progenyValues.length > 0) {
    const progMean = mean(progenyValues);
    const n = progenyValues.length;

    // k = (4 - h²) / h² → constante de regressão para progênie
    const k = (4 - h2) / h2;

    // Fator de regressão: quanto mais progênie, mais confiável
    const regFactor = n / (n + k);

    // DEP = regressão × (média_progênie - média_rebanho)
    // O desvio da progênie em relação à média já contém metade do mérito
    // genético do pai/mãe, então multiplicamos por 2 para estimar o mérito
    // total do genitor, e depois aplicamos a regressão para a média
    depProg = regFactor * 2 * (progMean - baselineMean);

    accProg = n / (n + k); // r² para progênie
  }

  // 3. Combina informações por acurácia relativa
  const totalAcc = accOwn + accProg;

  if (totalAcc <= 0) return 0;

  // Média ponderada pela acurácia relativa
  const dep = (depOwn * accOwn + depProg * accProg) / totalAcc;

  return dep;
};

/**
 * Calcula DEP para um animal específico.
 *
 * Para Habilidade Materna:
 * - Efeito materno é estimado SEPARADAMENTE do efeito direto
 * - Usa o desvio do peso ao desmame da progênie corrigido pelo efeito direto
 *   estimado do pai da progênie (quando disponível)
 * - Quando o pai não é conhecido, usa uma estimativa conservadora
 */
export const calculateAnimalDEP = ({
  animal,
  baseline,
  indices,
}: DEPCalculationInput): DEPReport => {
  const animalInPeriod = isInReferencePeriod(animal);
  const ownBirthWeight = animalInPeriod ? getWeightByType(animal, WeighingType.Birth) : null;
  const ownWeaningWeight = animalInPeriod ? getWeightByType(animal, WeighingType.Weaning) : null;
  const ownYearlingWeight = animalInPeriod ? getWeightByType(animal, WeighingType.Yearling) : null;

  // Progênie filtrada pelo período de referência
  const allProgeny = getUnifiedProgeny(animal, indices);
  const progeny = allProgeny.filter(isInReferencePeriod);

  const progenyBirthWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Birth))
    .filter((w): w is number => w !== null && w > 0);

  const progenyWeaningWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Weaning))
    .filter((w): w is number => w !== null && w > 0);

  const progenyYearlingWeights = progeny
    .map((p) => getWeightByType(p, WeighingType.Yearling))
    .filter((w): w is number => w !== null && w > 0);

  // Irmãos filtrados
  const allSiblings = getSiblings(animal, indices);
  const siblings = allSiblings.filter(isInReferencePeriod);
  const siblingWeaningWeights = siblings
    .map((s) => getWeightByType(s, WeighingType.Weaning))
    .filter((w): w is number => w !== null && w > 0);

  // ============================================
  // CÁLCULO DOS DEPs
  // ============================================

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
    milkProduction: 0,
    totalMaternal: 0,
  };

  // ============================================
  // HABILIDADE MATERNA (somente fêmeas com progênie)
  // ============================================
  // O efeito materno é a contribuição da mãe ao peso do bezerro
  // ALÉM do efeito genético direto que ela transmite.
  // É estimado como o desvio do peso ao desmame da progênie
  // em relação ao esperado pelo efeito direto.
  //
  // Fórmula simplificada:
  // DEP_maternal ≈ (h²_m / 2) × (média_prog_desmame - média_rebanho - DEP_direto_esperado)
  // Onde DEP_direto_esperado é a contribuição genética direta média dos pais

  if (animal.sexo === Sexo.Femea && progenyWeaningWeights.length > 0) {
    const progMeanWeaning = mean(progenyWeaningWeights);
    const baselineWeaning = baseline.metrics.weaningWeight.mean;

    if (baselineWeaning > 0) {
      // O desvio total da progênie ao desmame
      const totalDeviation = progMeanWeaning - baselineWeaning;

      // Estima a parte que é efeito direto (genético do bezerro)
      // A mãe contribui com metade do efeito direto via seus genes
      const directContrib = depValues.weaningWeight;

      // O restante é atribuído ao efeito materno (ambiente + genética materna)
      // Aplicamos regressão pela herdabilidade materna
      const n = progenyWeaningWeights.length;
      const kMaternal = (4 - HERITABILITIES.maternalWeaning) / HERITABILITIES.maternalWeaning;
      const regFactorMaternal = n / (n + kMaternal);

      // Efeito materno = regressão × (desvio_total - contribuição_direta)
      const maternalDEP = regFactorMaternal * (totalDeviation - directContrib);

      depValues.milkProduction = maternalDEP;
      depValues.totalMaternal = depValues.weaningWeight + depValues.milkProduction;
    }
  }

  // ============================================
  // DEPs DE CARCAÇA (AOL e Espessura de Gordura)
  // ============================================
  // Calculados apenas se há baseline para a raça (mínimo 2 medições no rebanho)

  let ownRibeyeArea: number | null = null;
  let progenyRibeyeAreas: number[] = [];
  let ownFatThickness: number | null = null;
  let progenyFatThicknesses: number[] = [];

  if (baseline.metrics.ribeyeArea) {
    ownRibeyeArea = animalInPeriod ? getLatestBiometric(animal, 'ribeyeArea') : null;
    progenyRibeyeAreas = progeny
      .map((p) => getLatestBiometric(p, 'ribeyeArea'))
      .filter((v): v is number => v !== null && v > 0);

    depValues.ribeyeArea = calculateSingleDEP(
      ownRibeyeArea,
      progenyRibeyeAreas,
      baseline.metrics.ribeyeArea.mean,
      HERITABILITIES.ribeyeArea
    );
  }

  if (baseline.metrics.fatThickness) {
    ownFatThickness = animalInPeriod ? getLatestBiometric(animal, 'fatThickness') : null;
    progenyFatThicknesses = progeny
      .map((p) => getLatestBiometric(p, 'fatThickness'))
      .filter((v): v is number => v !== null && v > 0);

    depValues.fatThickness = calculateSingleDEP(
      ownFatThickness,
      progenyFatThicknesses,
      baseline.metrics.fatThickness.mean,
      HERITABILITIES.fatThickness
    );
  }

  // ============================================
  // DEPs DE FERTILIDADE (PE e Stayability)
  // ============================================

  let ownScrotalCirc: number | null = null;
  let progenyScrotalCircs: number[] = [];

  // Perímetro Escrotal: só para machos (medição própria + filhos machos)
  if (baseline.metrics.scrotalCircumference && animal.sexo === Sexo.Macho) {
    ownScrotalCirc = animalInPeriod ? getLatestBiometric(animal, 'scrotalCircumference') : null;
    progenyScrotalCircs = progeny
      .filter((p) => p.sexo === Sexo.Macho)
      .map((p) => getLatestBiometric(p, 'scrotalCircumference'))
      .filter((v): v is number => v !== null && v > 0);

    depValues.scrotalCircumference = calculateSingleDEP(
      ownScrotalCirc,
      progenyScrotalCircs,
      baseline.metrics.scrotalCircumference.mean,
      HERITABILITIES.scrotalCircumference
    );
  }

  // Stayability (Permanência): calculada automaticamente
  // Para fêmeas: verifica se a própria vaca está ativa com 6+ anos
  // Para machos: verifica suas filhas com 6+ anos
  // É uma característica binária (ativa=1, inativa=0)
  {
    const STAYABILITY_AGE_MONTHS = 72; // 6 anos

    // Valor próprio (somente fêmeas com idade >= 6 anos)
    let ownStayValue: number | null = null;
    if (animal.sexo === Sexo.Femea) {
      const ageMonths = getAgeInMonths(animal);
      if (ageMonths !== null && ageMonths >= STAYABILITY_AGE_MONTHS) {
        ownStayValue = animal.status === AnimalStatus.Ativo ? 1 : 0;
      }
    }

    // Progênie: filhas com 6+ anos (tanto para touros quanto para matrizes)
    const qualifiedDaughters = progeny.filter((p) => {
      if (p.sexo !== Sexo.Femea) return false;
      const age = getAgeInMonths(p);
      return age !== null && age >= STAYABILITY_AGE_MONTHS;
    });

    if (ownStayValue !== null || qualifiedDaughters.length > 0) {
      const daughterStayValues = qualifiedDaughters.map((d) =>
        d.status === AnimalStatus.Ativo ? 1 : 0
      );

      // Para stayability, a baseline é a taxa média de permanência do rebanho
      // Usamos 0.5 como default quando não há dados suficientes
      const allFemales = progeny.length > 0 ? qualifiedDaughters : [];
      const baselineStayRate = allFemales.length > 0
        ? mean(allFemales.map(d => d.status === AnimalStatus.Ativo ? 1 : 0))
        : 0.5;

      // Para stayability, usamos uma abordagem direta:
      // DEP = h²/2 × (taxa_observada - taxa_base) para registro próprio
      // DEP = regFactor × (taxa_filhas - taxa_base) para progênie
      const stayDep = calculateSingleDEP(
        ownStayValue,
        daughterStayValues,
        baselineStayRate > 0 ? baselineStayRate : 0.5,
        HERITABILITIES.stayability
      );

      // Converte para percentual (multiplica por 100 para exibição como %)
      depValues.stayability = stayDep * 100;
    }
  }

  // ============================================
  // CÁLCULO DAS ACURÁCIAS
  // ============================================

  const nOwnBirth = ownBirthWeight ? 1 : 0;
  const nOwnWeaning = ownWeaningWeight ? 1 : 0;
  const nOwnYearling = ownYearlingWeight ? 1 : 0;

  const nSibWeaning = siblingWeaningWeights.length;

  const accuracy = {
    birthWeight: calculateAccuracy(
      nOwnBirth,
      progenyBirthWeights.length,
      0,
      HERITABILITIES.birthWeight
    ),
    weaningWeight: calculateAccuracy(
      nOwnWeaning,
      progenyWeaningWeights.length,
      nSibWeaning,
      HERITABILITIES.weaningWeight
    ),
    yearlingWeight: calculateAccuracy(
      nOwnYearling,
      progenyYearlingWeights.length,
      0,
      HERITABILITIES.yearlingWeight
    ),
    milkProduction: calculateAccuracy(
      0,
      progenyWeaningWeights.length,
      0,
      HERITABILITIES.maternalWeaning
    ),
    totalMaternal: calculateAccuracy(
      nOwnWeaning,
      progenyWeaningWeights.length,
      nSibWeaning,
      (HERITABILITIES.weaningWeight + HERITABILITIES.maternalWeaning) / 2
    ),
    // Carcaça
    ...(depValues.ribeyeArea !== undefined && {
      ribeyeArea: calculateAccuracy(
        ownRibeyeArea ? 1 : 0,
        progenyRibeyeAreas.length,
        0,
        HERITABILITIES.ribeyeArea
      ),
    }),
    ...(depValues.fatThickness !== undefined && {
      fatThickness: calculateAccuracy(
        ownFatThickness ? 1 : 0,
        progenyFatThicknesses.length,
        0,
        HERITABILITIES.fatThickness
      ),
    }),
    // Fertilidade
    ...(depValues.scrotalCircumference !== undefined && {
      scrotalCircumference: calculateAccuracy(
        ownScrotalCirc ? 1 : 0,
        progenyScrotalCircs.length,
        0,
        HERITABILITIES.scrotalCircumference
      ),
    }),
    ...(depValues.stayability !== undefined && {
      stayability: calculateAccuracy(
        animal.sexo === Sexo.Femea && getAgeInMonths(animal) !== null && getAgeInMonths(animal)! >= 72 ? 1 : 0,
        progeny.filter(p => p.sexo === Sexo.Femea && getAgeInMonths(p) !== null && getAgeInMonths(p)! >= 72).length,
        0,
        HERITABILITIES.stayability
      ),
    }),
  };

  // Contagem de registros para exibição
  // progeny já está filtrado por isInReferencePeriod na linha acima
  const nOwnBiometric = (ownRibeyeArea ? 1 : 0) + (ownFatThickness ? 1 : 0) + (ownScrotalCirc ? 1 : 0);
  const dataSource = {
    ownRecords:
      (ownBirthWeight ? 1 : 0) + (ownWeaningWeight ? 1 : 0) + (ownYearlingWeight ? 1 : 0) + nOwnBiometric,
    progenyRecords: progeny.length,
    siblingsRecords: siblings.length,
  };

  // Percentis são calculados depois no batch (quando temos todos os DEPs)
  const percentile = {
    birthWeight: 50,
    weaningWeight: 50,
    yearlingWeight: 50,
    milkProduction: 50,
    totalMaternal: 50,
  };

  // Recomendação provisória (será recalculada com percentis reais no batch)
  const recommendation: DEPReport['recommendation'] = 'indefinido';

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
      // Carcaça
      ...(depValues.ribeyeArea !== undefined && {
        ribeyeArea: Math.round(depValues.ribeyeArea * 10) / 10,
      }),
      ...(depValues.fatThickness !== undefined && {
        fatThickness: Math.round(depValues.fatThickness * 10) / 10,
      }),
      // Fertilidade
      ...(depValues.scrotalCircumference !== undefined && {
        scrotalCircumference: Math.round(depValues.scrotalCircumference * 10) / 10,
      }),
      ...(depValues.stayability !== undefined && {
        stayability: Math.round(depValues.stayability * 10) / 10,
      }),
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
 * Calcula DEPs para todos os animais do rebanho.
 *
 * Fluxo em 3 passagens:
 * 1. Calcula baselines por raça
 * 2. Calcula DEPs individuais
 * 3. Calcula percentis e recomendações usando a distribuição completa
 */
export const calculateAllDEPs = (animals: Animal[]): DEPReport[] => {
  const indices = buildIndices(animals);
  const baselines = calculateHerdBaseline(animals, indices);

  // Passagem 1: Calcula DEPs individuais
  const reports = animals.map((animal) => {
    const baseline = baselines.find((b) => b.raca === (animal.raca || Raca.Outros)) || baselines[0];

    if (!baseline) {
      return {
        animalId: animal.id,
        brinco: animal.brinco,
        nome: animal.nome,
        sexo: animal.sexo,
        raca: animal.raca || Raca.Outros,
        dep: { birthWeight: 0, weaningWeight: 0, yearlingWeight: 0, milkProduction: 0, totalMaternal: 0 },
        accuracy: { birthWeight: 0, weaningWeight: 0, yearlingWeight: 0, milkProduction: 0, totalMaternal: 0 },
        percentile: { birthWeight: 50, weaningWeight: 50, yearlingWeight: 50, milkProduction: 50, totalMaternal: 50 },
        dataSource: { ownRecords: 0, progenyRecords: 0, siblingsRecords: 0 },
        recommendation: 'indefinido' as const,
        calculatedAt: new Date(),
      };
    }

    return calculateAnimalDEP({ animal, baseline, indices });
  });

  // Passagem 2: Calcula percentis por raça usando a distribuição real dos DEPs
  // Agrupa DEPs por raça para calcular percentis consistentes
  const depsByRaca = new Map<string, DEPReport[]>();
  for (const report of reports) {
    const raca = report.raca;
    if (!depsByRaca.has(raca)) depsByRaca.set(raca, []);
    depsByRaca.get(raca)!.push(report);
  }

  for (const [, raceReports] of depsByRaca) {
    // Coleta todas as DEPs da raça (os mesmos valores que foram calculados)
    const allBirthDEPs = raceReports.map(r => r.dep.birthWeight);
    const allWeaningDEPs = raceReports.map(r => r.dep.weaningWeight);
    const allYearlingDEPs = raceReports.map(r => r.dep.yearlingWeight);
    const allMaternalDEPs = raceReports
      .filter(r => r.sexo === Sexo.Femea)
      .map(r => r.dep.totalMaternal);

    // DEPs de carcaça e fertilidade (filtra apenas quem tem dados)
    const allRibeyeAreaDEPs = raceReports
      .filter(r => r.dep.ribeyeArea !== undefined)
      .map(r => r.dep.ribeyeArea!);
    const allFatThicknessDEPs = raceReports
      .filter(r => r.dep.fatThickness !== undefined)
      .map(r => r.dep.fatThickness!);
    const allScrotalCircDEPs = raceReports
      .filter(r => r.sexo === Sexo.Macho && r.dep.scrotalCircumference !== undefined)
      .map(r => r.dep.scrotalCircumference!);
    const allStayabilityDEPs = raceReports
      .filter(r => r.dep.stayability !== undefined)
      .map(r => r.dep.stayability!);

    // Atualiza percentis de cada animal
    for (const report of raceReports) {
      report.percentile.birthWeight = calculatePercentile(report.dep.birthWeight, allBirthDEPs);
      report.percentile.weaningWeight = calculatePercentile(report.dep.weaningWeight, allWeaningDEPs);
      report.percentile.yearlingWeight = calculatePercentile(report.dep.yearlingWeight, allYearlingDEPs);

      if (report.sexo === Sexo.Femea) {
        report.percentile.totalMaternal = calculatePercentile(report.dep.totalMaternal, allMaternalDEPs);
        report.percentile.milkProduction = calculatePercentile(report.dep.milkProduction,
          raceReports.filter(r => r.sexo === Sexo.Femea).map(r => r.dep.milkProduction));
      }

      // Percentis de carcaça
      if (report.dep.ribeyeArea !== undefined && allRibeyeAreaDEPs.length > 0) {
        report.percentile.ribeyeArea = calculatePercentile(report.dep.ribeyeArea, allRibeyeAreaDEPs);
      }
      if (report.dep.fatThickness !== undefined && allFatThicknessDEPs.length > 0) {
        report.percentile.fatThickness = calculatePercentile(report.dep.fatThickness, allFatThicknessDEPs);
      }

      // Percentis de fertilidade
      if (report.dep.scrotalCircumference !== undefined && allScrotalCircDEPs.length > 0) {
        report.percentile.scrotalCircumference = calculatePercentile(report.dep.scrotalCircumference, allScrotalCircDEPs);
      }
      if (report.dep.stayability !== undefined && allStayabilityDEPs.length > 0) {
        report.percentile.stayability = calculatePercentile(report.dep.stayability, allStayabilityDEPs);
      }
    }
  }

  // Passagem 3: Calcula recomendações com percentis reais
  // Combina crescimento (60%) + carcaça/fertilidade (40%) quando dados disponíveis
  for (const report of reports) {
    const growthPercentile = (report.percentile.weaningWeight + report.percentile.yearlingWeight) / 2;
    const avgAccuracy = (report.accuracy.weaningWeight + report.accuracy.yearlingWeight) / 2;

    // Coleta percentis complementares (carcaça + fertilidade) quando disponíveis
    const extraPercentiles: number[] = [];
    if (report.percentile.ribeyeArea !== undefined) extraPercentiles.push(report.percentile.ribeyeArea);
    if (report.percentile.fatThickness !== undefined) extraPercentiles.push(report.percentile.fatThickness);
    if (report.percentile.scrotalCircumference !== undefined) extraPercentiles.push(report.percentile.scrotalCircumference);
    if (report.percentile.stayability !== undefined) extraPercentiles.push(report.percentile.stayability);

    // Se há dados complementares, combina 60% crescimento + 40% carcaça/fertilidade
    let avgPercentile: number;
    if (extraPercentiles.length > 0) {
      const avgExtraPercentile = mean(extraPercentiles);
      avgPercentile = growthPercentile * 0.6 + avgExtraPercentile * 0.4;
    } else {
      avgPercentile = growthPercentile;
    }

    if (report.sexo === Sexo.Macho) {
      if (avgPercentile >= 80 && avgAccuracy >= 0.5) report.recommendation = 'reprodutor_elite';
      else if (avgPercentile >= 60 && avgAccuracy >= 0.3) report.recommendation = 'reprodutor';
      else if (avgPercentile < 30) report.recommendation = 'descarte';
      else report.recommendation = 'indefinido';
    } else {
      if (avgPercentile >= 80 && avgAccuracy >= 0.4) report.recommendation = 'matriz_elite';
      else if (avgPercentile >= 50) report.recommendation = 'matriz';
      else if (avgPercentile < 20) report.recommendation = 'descarte';
      else report.recommendation = 'indefinido';
    }
  }

  return reports;
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

export { buildIndices, getUnifiedProgeny, getSiblings, calculateAccuracy, calculateSingleDEP, getLatestBiometric, getAgeInMonths, HERITABILITIES };
export type { DEPIndices };
