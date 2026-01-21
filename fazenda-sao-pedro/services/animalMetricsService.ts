/**
 * AnimalMetricsService - Serviço Centralizado de Cálculo de Métricas
 *
 * Este serviço resolve os seguintes problemas:
 * 1. Recálculo redundante de GMD em múltiplos lugares
 * 2. Busca linear por nome de pai/mãe (agora usa índices)
 * 3. Fontes desconectadas de progênie
 * 4. Inconsistência no cálculo de prenhez
 *
 * Todos os cálculos são feitos uma única vez e cacheados.
 */

import {
  Animal,
  AnimalStatus,
  Sexo,
  WeighingType,
  GainMetrics,
  BreedingSeason,
  DEPReport,
  DEPValues,
  HerdDEPBaseline,
  ZootechnicalKPIs,
  Raca,
} from '../types';
import { KPICalculationResult } from './kpiCalculator';

// ============================================
// TIPOS DE DADOS DERIVADOS
// ============================================

export interface AnimalDerivedData {
  animalId: string;
  brinco: string;

  // Métricas de peso/crescimento
  gmd: GainMetrics;

  // Genética
  dep?: DEPReport;
  progenyIds: string[];
  siblingIds: string[];
  parentIds: {
    paiId?: string;
    maeId?: string;
  };

  // Reprodução (apenas fêmeas)
  reproductiveData?: {
    isPregnant: boolean;
    pregnancySource: 'manual' | 'breeding_season' | 'none';
    expectedCalvingDate?: Date;
    calvingIntervals: number[];
    firstCalvingAgeMonths?: number;
  };

  // Rankings
  rankings: {
    gmdGeral: number;
    gmdRaca: number;
    depWeaningPercentile?: number;
    depYearlingPercentile?: number;
  };

  // Idade em meses
  ageMonths: number;

  // Cache timestamp
  calculatedAt: Date;
}

// ============================================
// ÍNDICES PRÉ-COMPUTADOS
// ============================================

export interface AnimalIndices {
  byId: Map<string, Animal>;
  byBrinco: Map<string, Animal>;
  byPaiNome: Map<string, Animal[]>;
  byMaeNome: Map<string, Animal[]>;
  // Índices por ID (mais confiáveis que por nome)
  byPaiId: Map<string, Animal[]>;
  byMaeId: Map<string, Animal[]>;
  byRaca: Map<Raca, Animal[]>;
  bySexo: Map<Sexo, Animal[]>;
  byStatus: Map<AnimalStatus, Animal[]>;
}

// ============================================
// HELPERS
// ============================================

const getAgeInMonths = (birthDate?: Date): number => {
  if (!birthDate) return 0;
  const now = new Date();
  const birth = new Date(birthDate);
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
};

const getDaysBetween = (date1: Date, date2: Date): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
};

const getWeightByType = (animal: Animal, type: WeighingType): number | null => {
  const pesagem = animal.historicoPesagens?.find((p) => p.type === type);
  return pesagem?.weightKg ?? null;
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

const calculatePercentile = (value: number, allValues: number[]): number => {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sorted.length) * 100);
};

// ============================================
// CONSTANTES DE CONFIGURAÇÃO
// ============================================

const HERITABILITIES = {
  birthWeight: 0.35,
  weaningWeight: 0.25,
  yearlingWeight: 0.30,
  milkProduction: 0.20,
};

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
// CLASSE PRINCIPAL
// ============================================

export class AnimalMetricsService {
  private animals: Animal[];
  private breedingSeasons: BreedingSeason[];
  private indices: AnimalIndices;
  private cache: Map<string, AnimalDerivedData>;
  private depBaselines: HerdDEPBaseline[];
  private allGMDs: Map<string, number>;
  private allDEPs: Map<string, DEPReport>;

  constructor(animals: Animal[], breedingSeasons: BreedingSeason[] = []) {
    this.animals = animals;
    this.breedingSeasons = breedingSeasons;
    this.cache = new Map();
    this.allGMDs = new Map();
    this.allDEPs = new Map();
    this.depBaselines = [];
    this.indices = this.buildIndices();
  }

  // ============================================
  // CONSTRUÇÃO DE ÍNDICES (O(n) uma única vez)
  // ============================================

  private buildIndices(): AnimalIndices {
    const byId = new Map<string, Animal>();
    const byBrinco = new Map<string, Animal>();
    const byPaiNome = new Map<string, Animal[]>();
    const byMaeNome = new Map<string, Animal[]>();
    const byPaiId = new Map<string, Animal[]>();
    const byMaeId = new Map<string, Animal[]>();
    const byRaca = new Map<Raca, Animal[]>();
    const bySexo = new Map<Sexo, Animal[]>();
    const byStatus = new Map<AnimalStatus, Animal[]>();

    // Inicializa maps para enums
    Object.values(Raca).forEach(r => byRaca.set(r, []));
    Object.values(Sexo).forEach(s => bySexo.set(s, []));
    Object.values(AnimalStatus).forEach(s => byStatus.set(s, []));

    // Single-pass para construir todos os índices
    for (const animal of this.animals) {
      // Por ID
      byId.set(animal.id, animal);

      // Por Brinco (normalizado)
      byBrinco.set(animal.brinco.toLowerCase().trim(), animal);

      // Por nome do pai
      if (animal.paiNome) {
        const key = animal.paiNome.toLowerCase().trim();
        if (!byPaiNome.has(key)) byPaiNome.set(key, []);
        byPaiNome.get(key)!.push(animal);
      }

      // Por nome da mãe
      if (animal.maeNome) {
        const key = animal.maeNome.toLowerCase().trim();
        if (!byMaeNome.has(key)) byMaeNome.set(key, []);
        byMaeNome.get(key)!.push(animal);
      }

      // Por ID do pai (mais confiável)
      if (animal.paiId) {
        if (!byPaiId.has(animal.paiId)) byPaiId.set(animal.paiId, []);
        byPaiId.get(animal.paiId)!.push(animal);
      }

      // Por ID da mãe (mais confiável)
      if (animal.maeId) {
        if (!byMaeId.has(animal.maeId)) byMaeId.set(animal.maeId, []);
        byMaeId.get(animal.maeId)!.push(animal);
      }

      // Por raça
      byRaca.get(animal.raca)?.push(animal);

      // Por sexo
      bySexo.get(animal.sexo)?.push(animal);

      // Por status
      byStatus.get(animal.status)?.push(animal);
    }

    return { byId, byBrinco, byPaiNome, byMaeNome, byPaiId, byMaeId, byRaca, bySexo, byStatus };
  }

  // ============================================
  // ACESSO AOS ÍNDICES
  // ============================================

  public getIndices(): AnimalIndices {
    return this.indices;
  }

  public getAnimalById(id: string): Animal | undefined {
    return this.indices.byId.get(id);
  }

  public getAnimalByBrinco(brinco: string): Animal | undefined {
    return this.indices.byBrinco.get(brinco.toLowerCase().trim());
  }

  public getChildrenByParentName(parentName: string, parentType: 'pai' | 'mae'): Animal[] {
    const key = parentName.toLowerCase().trim();
    const map = parentType === 'pai' ? this.indices.byPaiNome : this.indices.byMaeNome;
    return map.get(key) || [];
  }

  // ============================================
  // RESOLUÇÃO DE PARENTESCO (UNIFICADA)
  // ============================================

  /**
   * Resolve o pai/mãe de um animal
   * Prioriza ID se disponível, senão usa nome
   */
  public resolveParent(animal: Animal, parentType: 'pai' | 'mae'): Animal | null {
    // 1. Tenta por ID primeiro (se implementado)
    const idField = parentType === 'pai' ? 'paiId' : 'maeId';
    const id = (animal as any)[idField];
    if (id) {
      const parent = this.indices.byId.get(id);
      if (parent) return parent;
    }

    // 2. Fallback para nome
    const nameField = parentType === 'pai' ? 'paiNome' : 'maeNome';
    const name = animal[nameField];
    if (!name) return null;

    const normalizedName = name.toLowerCase().trim();

    // Busca por nome ou brinco
    for (const a of this.animals) {
      if (a.nome?.toLowerCase().trim() === normalizedName) return a;
      if (a.brinco.toLowerCase().trim() === normalizedName) return a;
    }

    return null;
  }

  // ============================================
  // PROGÊNIE UNIFICADA
  // ============================================

  /**
   * Obtém progênie de um animal unificando três fontes:
   * 1. historicoProgenie (manual)
   * 2. paiNome/maeNome dos outros animais (reverso)
   * 3. paiId/maeId dos outros animais (mais confiável)
   */
  public getUnifiedProgeny(animal: Animal): Animal[] {
    const progenySet = new Set<string>();
    const result: Animal[] = [];

    // Fonte 1: historicoProgenie (registros manuais)
    if (animal.historicoProgenie?.length) {
      for (const p of animal.historicoProgenie) {
        const key = p.offspringBrinco.toLowerCase().trim();
        if (!progenySet.has(key)) {
          const offspring = this.indices.byBrinco.get(key);
          if (offspring) {
            progenySet.add(key);
            result.push(offspring);
          }
        }
      }
    }

    // Fonte 2: Busca reversa por paiNome/maeNome
    const animalNames = [
      animal.nome?.toLowerCase().trim(),
      animal.brinco.toLowerCase().trim(),
    ].filter(Boolean) as string[];

    for (const name of animalNames) {
      // Se macho, busca por paiNome
      if (animal.sexo === Sexo.Macho) {
        const children = this.indices.byPaiNome.get(name) || [];
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
        const children = this.indices.byMaeNome.get(name) || [];
        for (const child of children) {
          const key = child.brinco.toLowerCase().trim();
          if (!progenySet.has(key)) {
            progenySet.add(key);
            result.push(child);
          }
        }
      }
    }

    // Fonte 3: Busca por paiId/maeId usando índices (O(1) lookup)
    if (animal.sexo === Sexo.Macho) {
      const childrenByPaiId = this.indices.byPaiId.get(animal.id) || [];
      for (const child of childrenByPaiId) {
        const key = child.brinco.toLowerCase().trim();
        if (!progenySet.has(key)) {
          progenySet.add(key);
          result.push(child);
        }
      }
    }

    if (animal.sexo === Sexo.Femea) {
      const childrenByMaeId = this.indices.byMaeId.get(animal.id) || [];
      for (const child of childrenByMaeId) {
        const key = child.brinco.toLowerCase().trim();
        if (!progenySet.has(key)) {
          progenySet.add(key);
          result.push(child);
        }
      }
    }

    return result;
  }

  /**
   * Obtém irmãos de um animal (mesmo pai ou mesma mãe)
   * Usa tanto paiNome/maeNome quanto paiId/maeId
   */
  public getSiblings(animal: Animal): Animal[] {
    const siblingSet = new Set<string>();
    const result: Animal[] = [];

    // Irmãos por pai (nome)
    if (animal.paiNome) {
      const siblings = this.getChildrenByParentName(animal.paiNome, 'pai');
      for (const sib of siblings) {
        if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
          siblingSet.add(sib.id);
          result.push(sib);
        }
      }
    }

    // Irmãos por mãe (nome)
    if (animal.maeNome) {
      const siblings = this.getChildrenByParentName(animal.maeNome, 'mae');
      for (const sib of siblings) {
        if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
          siblingSet.add(sib.id);
          result.push(sib);
        }
      }
    }

    // Irmãos por paiId usando índices (O(1) lookup)
    if (animal.paiId) {
      const siblingsByPaiId = this.indices.byPaiId.get(animal.paiId) || [];
      for (const sib of siblingsByPaiId) {
        if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
          siblingSet.add(sib.id);
          result.push(sib);
        }
      }
    }

    // Irmãos por maeId usando índices (O(1) lookup)
    if (animal.maeId) {
      const siblingsByMaeId = this.indices.byMaeId.get(animal.maeId) || [];
      for (const sib of siblingsByMaeId) {
        if (sib.id !== animal.id && !siblingSet.has(sib.id)) {
          siblingSet.add(sib.id);
          result.push(sib);
        }
      }
    }

    return result;
  }

  // ============================================
  // CÁLCULO DE GMD (CENTRALIZADO)
  // ============================================

  private calculateGMD(animal: Animal): GainMetrics {
    const pesagens = animal.historicoPesagens || [];

    if (pesagens.length < 2) {
      return { gmdTotal: 0, diasAcompanhamento: 0 };
    }

    // Ordenar por data
    const sorted = [...pesagens].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const primeiro = sorted[0];
    const ultimo = sorted[sorted.length - 1];

    // GMD Total
    const diasTotal = Math.ceil(
      (new Date(ultimo.date).getTime() - new Date(primeiro.date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const gmdTotal = diasTotal > 0
      ? Number(((ultimo.weightKg - primeiro.weightKg) / diasTotal).toFixed(3))
      : 0;

    // GMD Nascimento -> Desmame
    const pesoNascimento = sorted.find(p => p.type === WeighingType.Birth);
    const pesoDesmame = sorted.find(p => p.type === WeighingType.Weaning);

    let gmdNascimentoDesmame: number | undefined;
    if (pesoNascimento && pesoDesmame) {
      const dias = Math.ceil(
        (new Date(pesoDesmame.date).getTime() - new Date(pesoNascimento.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dias > 0) {
        gmdNascimentoDesmame = Number(((pesoDesmame.weightKg - pesoNascimento.weightKg) / dias).toFixed(3));
      }
    }

    // GMD Desmame -> Sobreano
    const pesoSobreano = sorted.find(p => p.type === WeighingType.Yearling);

    let gmdDesmameSobreano: number | undefined;
    if (pesoDesmame && pesoSobreano) {
      const dias = Math.ceil(
        (new Date(pesoSobreano.date).getTime() - new Date(pesoDesmame.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dias > 0) {
        gmdDesmameSobreano = Number(((pesoSobreano.weightKg - pesoDesmame.weightKg) / dias).toFixed(3));
      }
    }

    // GMD últimos 30 dias
    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pesagensRecentes = sorted.filter(p => new Date(p.date) >= trintaDiasAtras);

    let gmdUltimos30Dias: number | undefined;
    if (pesagensRecentes.length >= 2) {
      const primeiraRecente = pesagensRecentes[0];
      const ultimaRecente = pesagensRecentes[pesagensRecentes.length - 1];
      const dias = Math.ceil(
        (new Date(ultimaRecente.date).getTime() - new Date(primeiraRecente.date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (dias > 0) {
        gmdUltimos30Dias = Number(((ultimaRecente.weightKg - primeiraRecente.weightKg) / dias).toFixed(3));
      }
    }

    return {
      gmdTotal,
      gmdNascimentoDesmame,
      gmdDesmameSobreano,
      gmdUltimos30Dias,
      diasAcompanhamento: diasTotal,
      pesoInicial: primeiro.weightKg,
      pesoFinal: ultimo.weightKg,
    };
  }

  // ============================================
  // CÁLCULO DE STATUS REPRODUTIVO (INTEGRADO COM BREEDING SEASON)
  // ============================================

  private calculateReproductiveData(animal: Animal): AnimalDerivedData['reproductiveData'] | undefined {
    if (animal.sexo !== Sexo.Femea) return undefined;

    let isPregnant = false;
    let pregnancySource: 'manual' | 'breeding_season' | 'none' = 'none';
    let expectedCalvingDate: Date | undefined;

    // 1. Verifica breeding seasons (fonte mais confiável se existir)
    for (const season of this.breedingSeasons) {
      if (season.status === 'active' || season.status === 'finished') {
        const coverage = season.coverageRecords.find(
          c => c.cowId === animal.id && c.pregnancyResult === 'positive'
        );
        if (coverage) {
          isPregnant = true;
          pregnancySource = 'breeding_season';
          expectedCalvingDate = coverage.expectedCalvingDate;
          break;
        }
      }
    }

    // 2. Fallback para historicoPrenhez (se não encontrou em breeding season)
    if (!isPregnant && animal.historicoPrenhez?.length) {
      const lastPregnancy = animal.historicoPrenhez[animal.historicoPrenhez.length - 1];
      const hasAbortionAfter = animal.historicoAborto?.some(
        ab => new Date(ab.date) >= new Date(lastPregnancy.date)
      );
      if (!hasAbortionAfter) {
        isPregnant = true;
        pregnancySource = 'manual';
        // Calcula data prevista de parto (283 dias de gestação)
        const pregnancyDate = new Date(lastPregnancy.date);
        expectedCalvingDate = new Date(pregnancyDate.getTime() + 283 * 24 * 60 * 60 * 1000);
      }
    }

    // 3. Calcula intervalos entre partos
    const calvingIntervals: number[] = [];
    const progeny = this.getUnifiedProgeny(animal);

    if (progeny.length >= 2) {
      const birthDates = progeny
        .map(o => o.dataNascimento)
        .filter((d): d is Date => d !== undefined)
        .map(d => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());

      for (let i = 1; i < birthDates.length; i++) {
        const interval = getDaysBetween(birthDates[i - 1], birthDates[i]);
        if (interval > 200 && interval < 730) {
          calvingIntervals.push(interval);
        }
      }
    }

    // 4. Calcula idade ao primeiro parto
    let firstCalvingAgeMonths: number | undefined;
    if (progeny.length > 0 && animal.dataNascimento) {
      const sortedProgeny = progeny
        .filter(p => p.dataNascimento)
        .sort((a, b) => new Date(a.dataNascimento!).getTime() - new Date(b.dataNascimento!).getTime());

      if (sortedProgeny.length > 0) {
        const cowBirth = new Date(animal.dataNascimento);
        const firstCalfBirth = new Date(sortedProgeny[0].dataNascimento!);
        firstCalvingAgeMonths = (firstCalfBirth.getFullYear() - cowBirth.getFullYear()) * 12 +
          (firstCalfBirth.getMonth() - cowBirth.getMonth());

        // Valida se está em faixa razoável
        if (firstCalvingAgeMonths < 18 || firstCalvingAgeMonths > 48) {
          firstCalvingAgeMonths = undefined;
        }
      }
    }

    return {
      isPregnant,
      pregnancySource,
      expectedCalvingDate,
      calvingIntervals,
      firstCalvingAgeMonths,
    };
  }

  // ============================================
  // CÁLCULO DE DEP (OTIMIZADO COM ÍNDICES)
  // ============================================

  private calculateHerdBaselines(): HerdDEPBaseline[] {
    const baselines: HerdDEPBaseline[] = [];

    this.indices.byRaca.forEach((raceAnimals, raca) => {
      if (raceAnimals.length === 0) return;

      const birthWeights = raceAnimals
        .map(a => getWeightByType(a, WeighingType.Birth))
        .filter((w): w is number => w !== null && w > 0);

      const weaningWeights = raceAnimals
        .map(a => getWeightByType(a, WeighingType.Weaning))
        .filter((w): w is number => w !== null && w > 0);

      const yearlingWeights = raceAnimals
        .map(a => getWeightByType(a, WeighingType.Yearling))
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
  }

  private calculateDEP(animal: Animal, baseline: HerdDEPBaseline): DEPReport {
    // Dados do próprio animal
    const ownBirthWeight = getWeightByType(animal, WeighingType.Birth);
    const ownWeaningWeight = getWeightByType(animal, WeighingType.Weaning);
    const ownYearlingWeight = getWeightByType(animal, WeighingType.Yearling);

    // Dados de progênie (USANDO FUNÇÃO UNIFICADA)
    const progeny = this.getUnifiedProgeny(animal);

    const progenyBirthWeights = progeny
      .map(p => getWeightByType(p, WeighingType.Birth))
      .filter((w): w is number => w !== null && w > 0);

    const progenyWeaningWeights = progeny
      .map(p => getWeightByType(p, WeighingType.Weaning))
      .filter((w): w is number => w !== null && w > 0);

    const progenyYearlingWeights = progeny
      .map(p => getWeightByType(p, WeighingType.Yearling))
      .filter((w): w is number => w !== null && w > 0);

    // Dados de irmãos (USANDO FUNÇÃO OTIMIZADA)
    const siblings = this.getSiblings(animal);

    // Contagem de registros
    const dataSource = {
      ownRecords: (ownBirthWeight ? 1 : 0) + (ownWeaningWeight ? 1 : 0) + (ownYearlingWeight ? 1 : 0),
      progenyRecords: progenyBirthWeights.length + progenyWeaningWeights.length + progenyYearlingWeights.length,
      siblingsRecords: siblings.length,
    };

    // Função de cálculo de DEP individual
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
      milkProduction: animal.sexo === Sexo.Femea && progenyWeaningWeights.length > 0
        ? calculateSingleDEP(null, progenyWeaningWeights, baseline.metrics.weaningWeight.mean, HERITABILITIES.milkProduction)
        : 0,
      totalMaternal: 0,
    };

    if (animal.sexo === Sexo.Femea) {
      depValues.totalMaternal = depValues.weaningWeight + depValues.milkProduction;
    }

    // Acurácias
    const accuracy = {
      birthWeight: getAccuracyFactor((ownBirthWeight ? 1 : 0) + progenyBirthWeights.length * 2),
      weaningWeight: getAccuracyFactor((ownWeaningWeight ? 1 : 0) + progenyWeaningWeights.length * 2),
      yearlingWeight: getAccuracyFactor((ownYearlingWeight ? 1 : 0) + progenyYearlingWeights.length * 2),
      milkProduction: getAccuracyFactor(progenyWeaningWeights.length),
      totalMaternal: getAccuracyFactor(Math.floor((progenyWeaningWeights.length + (ownWeaningWeight ? 1 : 0)) / 2)),
    };

    // Percentis (calculados após todos os DEPs)
    const percentile = {
      birthWeight: 50,
      weaningWeight: 50,
      yearlingWeight: 50,
      milkProduction: 50,
      totalMaternal: 50,
    };

    // Recomendação
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
      raca: animal.raca || 'Outros',
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
  }

  // ============================================
  // CÁLCULO PRINCIPAL (TUDO EM UMA PASSAGEM)
  // ============================================

  public computeAll(): Map<string, AnimalDerivedData> {
    // 1. Calcula baselines de DEP por raça
    this.depBaselines = this.calculateHerdBaselines();

    // 2. Primeira passagem: calcula GMD e DEP para todos
    for (const animal of this.animals) {
      const gmd = this.calculateGMD(animal);
      this.allGMDs.set(animal.id, gmd.gmdTotal || 0);

      const baseline = this.depBaselines.find(b => b.raca === animal.raca) || this.depBaselines[0];
      if (baseline) {
        const dep = this.calculateDEP(animal, baseline);
        this.allDEPs.set(animal.id, dep);
      }
    }

    // 3. Segunda passagem: calcula rankings e dados derivados completos
    const gmdArray = Array.from(this.allGMDs.values()).filter(g => g > 0);
    const gmdByRaca = new Map<Raca, number[]>();

    this.indices.byRaca.forEach((animals, raca) => {
      const gmds = animals
        .map(a => this.allGMDs.get(a.id) || 0)
        .filter(g => g > 0);
      gmdByRaca.set(raca, gmds);
    });

    // Calcula percentis de DEP por raça
    const depWeaningByRaca = new Map<Raca, number[]>();
    const depYearlingByRaca = new Map<Raca, number[]>();

    this.indices.byRaca.forEach((animals, raca) => {
      const weaningDeps = animals
        .map(a => this.allDEPs.get(a.id)?.dep.weaningWeight || 0);
      const yearlingDeps = animals
        .map(a => this.allDEPs.get(a.id)?.dep.yearlingWeight || 0);
      depWeaningByRaca.set(raca, weaningDeps);
      depYearlingByRaca.set(raca, yearlingDeps);
    });

    // 4. Terceira passagem: monta dados derivados completos
    for (const animal of this.animals) {
      const gmd = this.calculateGMD(animal);
      const gmdValue = gmd.gmdTotal || 0;

      // Rankings de GMD
      const sortedGeral = [...gmdArray].sort((a, b) => b - a);
      const gmdRankingGeral = gmdValue > 0 ? sortedGeral.indexOf(gmdValue) + 1 : 0;

      const racaGmds = gmdByRaca.get(animal.raca) || [];
      const sortedRaca = [...racaGmds].sort((a, b) => b - a);
      const gmdRankingRaca = gmdValue > 0 ? sortedRaca.indexOf(gmdValue) + 1 : 0;

      // Percentis de DEP
      const dep = this.allDEPs.get(animal.id);
      let depWeaningPercentile: number | undefined;
      let depYearlingPercentile: number | undefined;

      if (dep) {
        const weaningDeps = depWeaningByRaca.get(animal.raca) || [];
        const yearlingDeps = depYearlingByRaca.get(animal.raca) || [];
        depWeaningPercentile = calculatePercentile(dep.dep.weaningWeight, weaningDeps);
        depYearlingPercentile = calculatePercentile(dep.dep.yearlingWeight, yearlingDeps);

        // Atualiza percentis no DEP
        dep.percentile.weaningWeight = depWeaningPercentile;
        dep.percentile.yearlingWeight = depYearlingPercentile;

        // Recalcula recomendação com percentis reais
        const avgPercentile = (depWeaningPercentile + depYearlingPercentile) / 2;
        const avgAccuracy = (dep.accuracy.weaningWeight + dep.accuracy.yearlingWeight) / 2;

        if (animal.sexo === Sexo.Macho) {
          if (avgPercentile >= 80 && avgAccuracy >= 0.5) dep.recommendation = 'reprodutor_elite';
          else if (avgPercentile >= 60 && avgAccuracy >= 0.3) dep.recommendation = 'reprodutor';
          else if (avgPercentile < 30) dep.recommendation = 'descarte';
          else dep.recommendation = 'indefinido';
        } else {
          if (avgPercentile >= 80 && avgAccuracy >= 0.4) dep.recommendation = 'matriz_elite';
          else if (avgPercentile >= 50) dep.recommendation = 'matriz';
          else if (avgPercentile < 20) dep.recommendation = 'descarte';
          else dep.recommendation = 'indefinido';
        }
      }

      // Progênie e irmãos
      const progeny = this.getUnifiedProgeny(animal);
      const siblings = this.getSiblings(animal);

      // Parentesco
      const pai = this.resolveParent(animal, 'pai');
      const mae = this.resolveParent(animal, 'mae');

      // Dados reprodutivos
      const reproductiveData = this.calculateReproductiveData(animal);

      const derived: AnimalDerivedData = {
        animalId: animal.id,
        brinco: animal.brinco,
        gmd,
        dep,
        progenyIds: progeny.map(p => p.id),
        siblingIds: siblings.map(s => s.id),
        parentIds: {
          paiId: pai?.id,
          maeId: mae?.id,
        },
        reproductiveData,
        rankings: {
          gmdGeral: gmdRankingGeral,
          gmdRaca: gmdRankingRaca,
          depWeaningPercentile,
          depYearlingPercentile,
        },
        ageMonths: getAgeInMonths(animal.dataNascimento),
        calculatedAt: new Date(),
      };

      this.cache.set(animal.id, derived);
    }

    return this.cache;
  }

  // ============================================
  // ACESSO AOS DADOS CALCULADOS
  // ============================================

  public getDerivedData(animalId: string): AnimalDerivedData | undefined {
    return this.cache.get(animalId);
  }

  public getAllDerivedData(): Map<string, AnimalDerivedData> {
    return this.cache;
  }

  public getGMD(animalId: string): GainMetrics | undefined {
    return this.cache.get(animalId)?.gmd;
  }

  public getDEP(animalId: string): DEPReport | undefined {
    return this.cache.get(animalId)?.dep;
  }

  public getAllDEPs(): DEPReport[] {
    return Array.from(this.cache.values())
      .map(d => d.dep)
      .filter((dep): dep is DEPReport => dep !== undefined);
  }

  public getDEPBaselines(): HerdDEPBaseline[] {
    return this.depBaselines;
  }

  // ============================================
  // CÁLCULO DE KPIs (USANDO DADOS PRÉ-CALCULADOS)
  // ============================================

  public calculateKPIs(): KPICalculationResult {
    const activeAnimals = this.indices.byStatus.get(AnimalStatus.Ativo) || [];
    const deadAnimals = this.indices.byStatus.get(AnimalStatus.Obito) || [];
    const soldAnimals = this.indices.byStatus.get(AnimalStatus.Vendido) || [];
    const females = this.indices.bySexo.get(Sexo.Femea) || [];
    const males = this.indices.bySexo.get(Sexo.Macho) || [];
    const activeFemales = females.filter(f => f.status === AnimalStatus.Ativo);

    const warnings: string[] = [];

    // Vacas em idade reprodutiva (>= 18 meses)
    const breedingAgeFemales = activeFemales.filter(a => {
      const derived = this.cache.get(a.id);
      return derived && derived.ageMonths >= 18;
    });

    // Taxa de mortalidade
    const mortalityRate = this.animals.length > 0
      ? (deadAnimals.length / this.animals.length) * 100
      : 0;

    // Pesos médios
    const birthWeights = this.animals
      .map(a => getWeightByType(a, WeighingType.Birth))
      .filter((w): w is number => w !== null && w > 0);

    const weaningWeights = this.animals
      .map(a => getWeightByType(a, WeighingType.Weaning))
      .filter((w): w is number => w !== null && w > 0);

    const yearlingWeights = this.animals
      .map(a => getWeightByType(a, WeighingType.Yearling))
      .filter((w): w is number => w !== null && w > 0);

    const avgBirthWeight = mean(birthWeights);
    const avgWeaningWeight = mean(weaningWeights);
    const avgYearlingWeight = mean(yearlingWeights);

    if (birthWeights.length < 5) {
      warnings.push('Poucos registros de peso ao nascimento para cálculo preciso');
    }
    if (weaningWeights.length < 5) {
      warnings.push('Poucos registros de peso ao desmame para cálculo preciso');
    }

    // Taxa de desmame
    const weanedCalves = this.animals.filter(a => getWeightByType(a, WeighingType.Weaning) !== null);
    const weaningRate = breedingAgeFemales.length > 0
      ? (weanedCalves.length / breedingAgeFemales.length) * 100
      : 0;

    // Taxa de prenhez (USANDO DADOS PRÉ-CALCULADOS)
    let pregnantFromBreedingSeason = 0;
    let pregnantFromManualRecord = 0;

    const pregnantCows = activeFemales.filter(a => {
      const derived = this.cache.get(a.id);
      if (derived?.reproductiveData?.isPregnant) {
        if (derived.reproductiveData.pregnancySource === 'breeding_season') {
          pregnantFromBreedingSeason++;
        } else if (derived.reproductiveData.pregnancySource === 'manual') {
          pregnantFromManualRecord++;
        }
        return true;
      }
      return false;
    });

    const pregnancyRate = breedingAgeFemales.length > 0
      ? (pregnantCows.length / breedingAgeFemales.length) * 100
      : 0;

    // Taxa de natalidade
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const birthsLastYear = this.animals.filter(a =>
      a.dataNascimento && new Date(a.dataNascimento) >= oneYearAgo
    );
    const birthRate = breedingAgeFemales.length > 0
      ? (birthsLastYear.length / breedingAgeFemales.length) * 100
      : 0;

    // Intervalo entre partos (USANDO DADOS PRÉ-CALCULADOS)
    const calvingIntervals: number[] = [];
    activeFemales.forEach(cow => {
      const derived = this.cache.get(cow.id);
      if (derived?.reproductiveData?.calvingIntervals) {
        calvingIntervals.push(...derived.reproductiveData.calvingIntervals);
      }
    });
    const calvingInterval = mean(calvingIntervals);

    if (calvingIntervals.length < 3) {
      warnings.push('Poucos registros de partos para cálculo preciso do IEP');
    }

    // GMD médio (USANDO DADOS PRÉ-CALCULADOS)
    const gmdValues: number[] = [];
    activeAnimals.forEach(animal => {
      const gmd = this.cache.get(animal.id)?.gmd.gmdTotal;
      if (gmd && gmd > 0) {
        gmdValues.push(gmd);
      }
    });
    const avgGMD = mean(gmdValues);

    // Kg de bezerro/vaca/ano
    const kgCalfPerCowYear = (avgWeaningWeight * weaningRate) / 100;

    // Idade média ao primeiro parto (USANDO DADOS PRÉ-CALCULADOS)
    const firstCalvingAges: number[] = [];
    females.forEach(cow => {
      const derived = this.cache.get(cow.id);
      if (derived?.reproductiveData?.firstCalvingAgeMonths) {
        firstCalvingAges.push(derived.reproductiveData.firstCalvingAgeMonths);
      }
    });
    const avgFirstCalvingAge = mean(firstCalvingAges);

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
        totalAnimals: this.animals.length,
        totalFemales: females.length,
        totalMales: males.length,
        totalActive: activeAnimals.length,
        totalDeaths: deadAnimals.length,
        totalSold: soldAnimals.length,
        calvesWeaned: weanedCalves.length,
        exposedCows: breedingAgeFemales.length,
        pregnantCows: pregnantCows.length,
        births: birthsLastYear.length,
        pregnantFromBreedingSeason,
        pregnantFromManualRecord,
      },
      warnings,
      calculatedAt: new Date(),
    };
  }
}

// ============================================
// HOOK PARA USO NO REACT
// ============================================

export const createAnimalMetricsService = (
  animals: Animal[],
  breedingSeasons: BreedingSeason[] = []
): AnimalMetricsService => {
  const service = new AnimalMetricsService(animals, breedingSeasons);
  service.computeAll();
  return service;
};
