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
  BiometricType,
  GainMetrics,
  BreedingSeason,
  DEPReport,
  DEPValues,
  HerdDEPBaseline,
  ZootechnicalKPIs,
  Raca,
} from '../types';
import { KPICalculationResult } from './kpiCalculator';
import {
  isInReferencePeriod,
  filterByReferencePeriod,
  getReferencePeriodStats,
} from '../utils/referencePeriod';
import {
  calculateAccuracy,
  calculateSingleDEP,
  getLatestBiometric,
  getAgeInMonths as getAgeInMonthsFromAnimal,
  HERITABILITIES,
} from './depCalculator';

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

// HERITABILITIES e calculateAccuracy importados de depCalculator.ts
// para manter consistência entre os dois módulos.

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
  // Animais filtrados pelo período de referência (2025+) para cálculos
  private animalsInReferencePeriod: Animal[];
  private referencePeriodStats: { total: number; inPeriod: number; excluded: number; percentInPeriod: number };

  constructor(animals: Animal[], breedingSeasons: BreedingSeason[] = []) {
    this.animals = animals;
    this.breedingSeasons = breedingSeasons;
    this.cache = new Map();
    this.allGMDs = new Map();
    this.allDEPs = new Map();
    this.depBaselines = [];
    this.indices = this.buildIndices();
    // Filtra animais pelo período de referência para cálculos de DEP e KPI
    this.animalsInReferencePeriod = filterByReferencePeriod(animals);
    this.referencePeriodStats = getReferencePeriodStats(animals);
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

    // IMPORTANTE: Usa apenas animais do período de referência (2025+) para baseline
    // Isso corrige o viés de seleção dos dados históricos
    this.indices.byRaca.forEach((raceAnimals, raca) => {
      // Filtra animais da raça pelo período de referência
      const raceAnimalsInPeriod = raceAnimals.filter(isInReferencePeriod);
      if (raceAnimalsInPeriod.length === 0) return;

      const birthWeights = raceAnimalsInPeriod
        .map(a => getWeightByType(a, WeighingType.Birth))
        .filter((w): w is number => w !== null && w > 0);

      const weaningWeights = raceAnimalsInPeriod
        .map(a => getWeightByType(a, WeighingType.Weaning))
        .filter((w): w is number => w !== null && w > 0);

      const yearlingWeights = raceAnimalsInPeriod
        .map(a => getWeightByType(a, WeighingType.Yearling))
        .filter((w): w is number => w !== null && w > 0);

      // Biometria - Carcaça (todos os animais com medição)
      const ribeyeAreas = raceAnimalsInPeriod
        .map(a => getLatestBiometric(a, 'ribeyeArea'))
        .filter((v): v is number => v !== null && v > 0);

      const fatThicknesses = raceAnimalsInPeriod
        .map(a => getLatestBiometric(a, 'fatThickness'))
        .filter((v): v is number => v !== null && v > 0);

      // Biometria - Fertilidade (PE apenas machos)
      const scrotalCircumferences = raceAnimalsInPeriod
        .filter(a => a.sexo === Sexo.Macho)
        .map(a => getLatestBiometric(a, 'scrotalCircumference'))
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
  }

  private calculateDEP(animal: Animal, baseline: HerdDEPBaseline): DEPReport {
    // Dados do próprio animal (somente se nasceu no período de referência)
    const animalInPeriod = isInReferencePeriod(animal);
    const ownBirthWeight = animalInPeriod ? getWeightByType(animal, WeighingType.Birth) : null;
    const ownWeaningWeight = animalInPeriod ? getWeightByType(animal, WeighingType.Weaning) : null;
    const ownYearlingWeight = animalInPeriod ? getWeightByType(animal, WeighingType.Yearling) : null;

    // Dados de progênie (USANDO FUNÇÃO UNIFICADA)
    const allProgeny = this.getUnifiedProgeny(animal);
    const progeny = allProgeny.filter(isInReferencePeriod);

    const progenyBirthWeights = progeny
      .map(p => getWeightByType(p, WeighingType.Birth))
      .filter((w): w is number => w !== null && w > 0);

    const progenyWeaningWeights = progeny
      .map(p => getWeightByType(p, WeighingType.Weaning))
      .filter((w): w is number => w !== null && w > 0);

    const progenyYearlingWeights = progeny
      .map(p => getWeightByType(p, WeighingType.Yearling))
      .filter((w): w is number => w !== null && w > 0);

    // Dados de irmãos
    const allSiblings = this.getSiblings(animal);
    const siblings = allSiblings.filter(isInReferencePeriod);
    const siblingWeaningWeights = siblings
      .map(s => getWeightByType(s, WeighingType.Weaning))
      .filter((w): w is number => w !== null && w > 0);

    // Calcula DEPs usando a mesma fórmula do depCalculator (importada)
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

    // Habilidade Materna: efeito materno separado do direto
    if (animal.sexo === Sexo.Femea && progenyWeaningWeights.length > 0) {
      const progMeanWeaning = mean(progenyWeaningWeights);
      const baselineWeaning = baseline.metrics.weaningWeight.mean;

      if (baselineWeaning > 0) {
        const totalDeviation = progMeanWeaning - baselineWeaning;
        const directContrib = depValues.weaningWeight;
        const n = progenyWeaningWeights.length;
        const kMaternal = (4 - HERITABILITIES.maternalWeaning) / HERITABILITIES.maternalWeaning;
        const regFactorMaternal = n / (n + kMaternal);
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
        .map(p => getLatestBiometric(p, 'ribeyeArea'))
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
        .map(p => getLatestBiometric(p, 'fatThickness'))
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
        .filter(p => p.sexo === Sexo.Macho)
        .map(p => getLatestBiometric(p, 'scrotalCircumference'))
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
        const ageMonths = getAgeInMonthsFromAnimal(animal);
        if (ageMonths !== null && ageMonths >= STAYABILITY_AGE_MONTHS) {
          ownStayValue = animal.status === AnimalStatus.Ativo ? 1 : 0;
        }
      }

      // Progênie: filhas com 6+ anos (tanto para touros quanto para matrizes)
      const qualifiedDaughters = progeny.filter(p => {
        if (p.sexo !== Sexo.Femea) return false;
        const age = getAgeInMonthsFromAnimal(p);
        return age !== null && age >= STAYABILITY_AGE_MONTHS;
      });

      if (ownStayValue !== null || qualifiedDaughters.length > 0) {
        const daughterStayValues = qualifiedDaughters.map(d =>
          d.status === AnimalStatus.Ativo ? 1 : 0
        );

        // Para stayability, a baseline é a taxa média de permanência do rebanho
        // Usamos 0.5 como default quando não há dados suficientes
        const allFemales = progeny.length > 0 ? qualifiedDaughters : [];
        const baselineStayRate = allFemales.length > 0
          ? mean(allFemales.map(d => d.status === AnimalStatus.Ativo ? 1 : 0))
          : 0.5;

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

    // Acurácias usando fórmula baseada em PEV (importada de depCalculator)
    const nOwnBirth = ownBirthWeight ? 1 : 0;
    const nOwnWeaning = ownWeaningWeight ? 1 : 0;
    const nOwnYearling = ownYearlingWeight ? 1 : 0;
    const nSibWeaning = siblingWeaningWeights.length;

    const accuracy = {
      birthWeight: calculateAccuracy(nOwnBirth, progenyBirthWeights.length, 0, HERITABILITIES.birthWeight),
      weaningWeight: calculateAccuracy(nOwnWeaning, progenyWeaningWeights.length, nSibWeaning, HERITABILITIES.weaningWeight),
      yearlingWeight: calculateAccuracy(nOwnYearling, progenyYearlingWeights.length, 0, HERITABILITIES.yearlingWeight),
      milkProduction: calculateAccuracy(0, progenyWeaningWeights.length, 0, HERITABILITIES.maternalWeaning),
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
          animal.sexo === Sexo.Femea && getAgeInMonthsFromAnimal(animal) !== null && getAgeInMonthsFromAnimal(animal)! >= 72 ? 1 : 0,
          progeny.filter(p => p.sexo === Sexo.Femea && getAgeInMonthsFromAnimal(p) !== null && getAgeInMonthsFromAnimal(p)! >= 72).length,
          0,
          HERITABILITIES.stayability
        ),
      }),
    };

    // Contagem de registros para exibição
    const nOwnBiometric = (ownRibeyeArea ? 1 : 0) + (ownFatThickness ? 1 : 0) + (ownScrotalCirc ? 1 : 0);
    const dataSource = {
      ownRecords: (ownBirthWeight ? 1 : 0) + (ownWeaningWeight ? 1 : 0) + (ownYearlingWeight ? 1 : 0) + nOwnBiometric,
      progenyRecords: progeny.length,
      siblingsRecords: siblings.length,
    };

    // Percentis provisórios (serão atualizados no computeAll com a distribuição completa)
    const percentile = {
      birthWeight: 50,
      weaningWeight: 50,
      yearlingWeight: 50,
      milkProduction: 50,
      totalMaternal: 50,
    };

    // Recomendação provisória (será recalculada com percentis reais)
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
  }

  // ============================================
  // CÁLCULO PRINCIPAL (TUDO EM UMA PASSAGEM)
  // ============================================

  public computeAll(): Map<string, AnimalDerivedData> {
    // 1. Calcula baselines de DEP por raça
    this.depBaselines = this.calculateHerdBaselines();

    // 2. Primeira passagem: calcula GMD e DEP para todos
    const gmdCache = new Map<string, GainMetrics>();
    for (const animal of this.animals) {
      const gmd = this.calculateGMD(animal);
      gmdCache.set(animal.id, gmd);
      this.allGMDs.set(animal.id, gmd.gmdTotal || 0);

      const baseline = this.depBaselines.find(b => b.raca === animal.raca) || this.depBaselines[0];
      if (baseline) {
        const dep = this.calculateDEP(animal, baseline);
        this.allDEPs.set(animal.id, dep);
      }
    }

    // 3. Segunda passagem: prepara rankings e distribuições
    // Rankings de GMD usam período de referência para consistência
    const gmdArray = this.animalsInReferencePeriod
      .map(a => this.allGMDs.get(a.id) || 0)
      .filter(g => g > 0);
    // Ordena UMA vez fora do loop
    const sortedGmdGeral = [...gmdArray].sort((a, b) => b - a);

    const gmdByRaca = new Map<Raca, number[]>();
    const sortedGmdByRaca = new Map<Raca, number[]>();

    this.indices.byRaca.forEach((animals, raca) => {
      const animalsInPeriod = animals.filter(isInReferencePeriod);
      const gmds = animalsInPeriod
        .map(a => this.allGMDs.get(a.id) || 0)
        .filter(g => g > 0);
      gmdByRaca.set(raca, gmds);
      sortedGmdByRaca.set(raca, [...gmds].sort((a, b) => b - a));
    });

    // Distribuições de DEP por raça para cálculo de percentis
    const depByRaca = new Map<Raca, {
      birth: number[];
      weaning: number[];
      yearling: number[];
      maternal: number[];
      milk: number[];
      ribeyeArea: number[];
      fatThickness: number[];
      scrotalCircumference: number[];
      stayability: number[];
    }>();

    this.indices.byRaca.forEach((animals, raca) => {
      const racaDeps = {
        birth: [] as number[],
        weaning: [] as number[],
        yearling: [] as number[],
        maternal: [] as number[],
        milk: [] as number[],
        ribeyeArea: [] as number[],
        fatThickness: [] as number[],
        scrotalCircumference: [] as number[],
        stayability: [] as number[],
      };
      for (const a of animals) {
        const dep = this.allDEPs.get(a.id);
        if (dep) {
          racaDeps.birth.push(dep.dep.birthWeight);
          racaDeps.weaning.push(dep.dep.weaningWeight);
          racaDeps.yearling.push(dep.dep.yearlingWeight);
          if (a.sexo === Sexo.Femea) {
            racaDeps.maternal.push(dep.dep.totalMaternal);
            racaDeps.milk.push(dep.dep.milkProduction);
          }
          // Carcaça
          if (dep.dep.ribeyeArea !== undefined) {
            racaDeps.ribeyeArea.push(dep.dep.ribeyeArea);
          }
          if (dep.dep.fatThickness !== undefined) {
            racaDeps.fatThickness.push(dep.dep.fatThickness);
          }
          // Fertilidade
          if (a.sexo === Sexo.Macho && dep.dep.scrotalCircumference !== undefined) {
            racaDeps.scrotalCircumference.push(dep.dep.scrotalCircumference);
          }
          if (dep.dep.stayability !== undefined) {
            racaDeps.stayability.push(dep.dep.stayability);
          }
        }
      }
      depByRaca.set(raca, racaDeps);
    });

    // 4. Terceira passagem: monta dados derivados completos
    for (const animal of this.animals) {
      const gmd = gmdCache.get(animal.id)!;
      const gmdValue = gmd.gmdTotal || 0;

      // Rankings de GMD (arrays pré-ordenados)
      const gmdRankingGeral = gmdValue > 0 ? sortedGmdGeral.indexOf(gmdValue) + 1 : 0;

      const sortedRaca = sortedGmdByRaca.get(animal.raca) || [];
      const gmdRankingRaca = gmdValue > 0 ? sortedRaca.indexOf(gmdValue) + 1 : 0;

      // Percentis de DEP - usando distribuição completa dos DEPs calculados
      const dep = this.allDEPs.get(animal.id);
      let depWeaningPercentile: number | undefined;
      let depYearlingPercentile: number | undefined;

      if (dep) {
        const racaDeps = depByRaca.get(animal.raca);
        if (racaDeps) {
          dep.percentile.birthWeight = calculatePercentile(dep.dep.birthWeight, racaDeps.birth);
          dep.percentile.weaningWeight = calculatePercentile(dep.dep.weaningWeight, racaDeps.weaning);
          dep.percentile.yearlingWeight = calculatePercentile(dep.dep.yearlingWeight, racaDeps.yearling);

          if (animal.sexo === Sexo.Femea) {
            dep.percentile.totalMaternal = calculatePercentile(dep.dep.totalMaternal, racaDeps.maternal);
            dep.percentile.milkProduction = calculatePercentile(dep.dep.milkProduction, racaDeps.milk);
          }

          // Percentis de carcaça
          if (dep.dep.ribeyeArea !== undefined && racaDeps.ribeyeArea.length > 0) {
            dep.percentile.ribeyeArea = calculatePercentile(dep.dep.ribeyeArea, racaDeps.ribeyeArea);
          }
          if (dep.dep.fatThickness !== undefined && racaDeps.fatThickness.length > 0) {
            dep.percentile.fatThickness = calculatePercentile(dep.dep.fatThickness, racaDeps.fatThickness);
          }

          // Percentis de fertilidade
          if (dep.dep.scrotalCircumference !== undefined && racaDeps.scrotalCircumference.length > 0) {
            dep.percentile.scrotalCircumference = calculatePercentile(dep.dep.scrotalCircumference, racaDeps.scrotalCircumference);
          }
          if (dep.dep.stayability !== undefined && racaDeps.stayability.length > 0) {
            dep.percentile.stayability = calculatePercentile(dep.dep.stayability, racaDeps.stayability);
          }
        }

        depWeaningPercentile = dep.percentile.weaningWeight;
        depYearlingPercentile = dep.percentile.yearlingWeight;

        // Recalcula recomendação com percentis reais
        // Combina crescimento (60%) + carcaça/fertilidade (40%) quando dados disponíveis
        const growthPercentile = (dep.percentile.weaningWeight + dep.percentile.yearlingWeight) / 2;
        const avgAccuracy = (dep.accuracy.weaningWeight + dep.accuracy.yearlingWeight) / 2;

        // Coleta percentis complementares (carcaça + fertilidade) quando disponíveis
        const extraPercentiles: number[] = [];
        if (dep.percentile.ribeyeArea !== undefined) extraPercentiles.push(dep.percentile.ribeyeArea);
        if (dep.percentile.fatThickness !== undefined) extraPercentiles.push(dep.percentile.fatThickness);
        if (dep.percentile.scrotalCircumference !== undefined) extraPercentiles.push(dep.percentile.scrotalCircumference);
        if (dep.percentile.stayability !== undefined) extraPercentiles.push(dep.percentile.stayability);

        // Se há dados complementares, combina 60% crescimento + 40% carcaça/fertilidade
        let avgPercentile: number;
        if (extraPercentiles.length > 0) {
          const avgExtraPercentile = mean(extraPercentiles);
          avgPercentile = growthPercentile * 0.6 + avgExtraPercentile * 0.4;
        } else {
          avgPercentile = growthPercentile;
        }

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
    // KPIs operacionais usam TODOS os animais do rebanho (sem filtro de referência).
    // O período de referência é usado apenas para DEPs (correção de viés genético).
    // KPIs medem o desempenho real e atual do rebanho.
    const activeAnimals = this.indices.byStatus.get(AnimalStatus.Ativo) || [];
    const deadAnimals = this.indices.byStatus.get(AnimalStatus.Obito) || [];
    const soldAnimals = this.indices.byStatus.get(AnimalStatus.Vendido) || [];
    const allFemales = this.indices.bySexo.get(Sexo.Femea) || [];
    const allMales = this.indices.bySexo.get(Sexo.Macho) || [];
    const activeFemales = allFemales.filter(f => f.status === AnimalStatus.Ativo);

    const warnings: string[] = [];

    // Vacas em idade reprodutiva (>= 18 meses, ativas)
    const breedingAgeFemales = activeFemales.filter(a => {
      const derived = this.cache.get(a.id);
      return derived && derived.ageMonths >= 18;
    });

    // ============================================
    // TAXA DE MORTALIDADE
    // Total de óbitos / Total de animais registrados
    // ============================================
    const totalAnimals = this.animals.length;
    const mortalityRate = totalAnimals > 0
      ? (deadAnimals.length / totalAnimals) * 100
      : 0;

    // ============================================
    // PESOS MÉDIOS E DESMAMADOS
    // Usa período de referência (2025+) para evitar viés de seleção:
    // animais antigos no sistema são amostra enviesada (só os não vendidos).
    // ============================================
    const birthWeights: number[] = [];
    const weaningWeights: number[] = [];
    const yearlingWeights: number[] = [];
    const weanedCalves: Animal[] = [];

    for (const animal of this.animalsInReferencePeriod) {
      const bw = getWeightByType(animal, WeighingType.Birth);
      if (bw !== null && bw > 0) birthWeights.push(bw);

      const ww = getWeightByType(animal, WeighingType.Weaning);
      if (ww !== null && ww > 0) {
        weaningWeights.push(ww);
        weanedCalves.push(animal);
      }

      const yw = getWeightByType(animal, WeighingType.Yearling);
      if (yw !== null && yw > 0) yearlingWeights.push(yw);
    }

    const avgBirthWeight = mean(birthWeights);
    const avgWeaningWeight = mean(weaningWeights);
    const avgYearlingWeight = mean(yearlingWeights);

    if (birthWeights.length < 5) {
      warnings.push('Poucos registros de peso ao nascimento para cálculo preciso');
    }
    if (weaningWeights.length < 5) {
      warnings.push('Poucos registros de peso ao desmame para cálculo preciso');
    }

    // ============================================
    // TAXA DE PRENHEZ (SÍNTESE DE TODAS AS ESTAÇÕES DE MONTA)
    // Calcula a taxa de cada estação individualmente (com deduplicação por cowId
    // dentro de cada estação, mesma lógica do breedingSeasonService) e depois
    // faz a síntese somando expostas e prenhes de todas as estações.
    // Isso equivale a uma média ponderada pelo número de expostas.
    // ============================================
    let pregnantFromBreedingSeason = 0;
    let pregnantFromManualRecord = 0;
    let totalExposedInSeasons = 0;
    let totalPregnantInSeasons = 0;

    const activeSeasons = this.breedingSeasons.filter(
      s => s.status === 'active' || s.status === 'finished'
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
      breedingAgeFemales.forEach(a => {
        const derived = this.cache.get(a.id);
        if (derived?.reproductiveData?.isPregnant && derived.reproductiveData.pregnancySource === 'manual') {
          pregnantFromManualRecord++;
          totalPregnantInSeasons++;
        }
      });
      totalExposedInSeasons = breedingAgeFemales.length;
    }

    const pregnancyRate = totalExposedInSeasons > 0
      ? (totalPregnantInSeasons / totalExposedInSeasons) * 100
      : 0;

    const pregnantCowsCount = totalPregnantInSeasons;

    // ============================================
    // TAXA DE NATALIDADE (PRENHEZES × NASCIMENTOS)
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

    // Fallback: nascimentos últimos 12 meses
    if (activeSeasons.length === 0) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      totalConfirmedBirths = this.animals.filter(a =>
        a.dataNascimento && new Date(a.dataNascimento) >= oneYearAgo
      ).length;
      totalPregnancies = breedingAgeFemales.length;
    }

    const birthRate = totalPregnancies > 0
      ? (totalConfirmedBirths / totalPregnancies) * 100
      : 0;

    // ============================================
    // INTERVALO ENTRE PARTOS
    // Combina datas de parto de duas fontes:
    //   a) Progênie unificada (do cache, via calculateReproductiveData)
    //   b) Estações de monta (actualCalvingDate dos coverage records)
    // Consolida por vaca (cowId), deduplicando datas próximas (±30 dias),
    // e calcula intervalos entre partos consecutivos de cada vaca.
    // ============================================
    const calvingIntervals: number[] = [];

    // Coleta datas de parto por vaca de TODAS as fontes
    const calvingDatesByCow = new Map<string, Set<number>>();

    // Fonte A: Progênie unificada (datas de nascimento dos filhos)
    activeFemales.forEach(cow => {
      const progeny = this.getUnifiedProgeny(cow);
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
    });

    // Fonte B: Estações de monta (actualCalvingDate dos coverage records)
    for (const season of activeSeasons) {
      for (const record of season.coverageRecords) {
        if (record.calvingResult === 'realizado' && record.actualCalvingDate) {
          if (!calvingDatesByCow.has(record.cowId)) {
            calvingDatesByCow.set(record.cowId, new Set());
          }
          calvingDatesByCow.get(record.cowId)!.add(new Date(record.actualCalvingDate).getTime());
        }
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
    // GMD MÉDIO (todos os ativos com GMD > 0)
    // ============================================
    const gmdValues: number[] = [];
    activeAnimals.forEach(animal => {
      const gmd = this.cache.get(animal.id)?.gmd.gmdTotal;
      if (gmd && gmd > 0) {
        gmdValues.push(gmd);
      }
    });
    const avgGMD = mean(gmdValues);

    // ============================================
    // KG DE BEZERRO/VACA/ANO
    // Usa taxa de natalidade × peso médio ao desmame
    // ============================================
    const kgCalfPerCowYear = (avgWeaningWeight * birthRate) / 100;

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
        totalAnimals: this.animals.length,
        totalFemales: allFemales.length,
        totalMales: allMales.length,
        totalActive: activeAnimals.length,
        totalDeaths: deadAnimals.length,
        totalSold: soldAnimals.length,
        calvesWeaned: weanedCalves.length,
        exposedCows: totalExposedInSeasons > 0 ? totalExposedInSeasons : breedingAgeFemales.length,
        pregnantCows: pregnantCowsCount,
        births: totalConfirmedBirths,
        pregnantFromBreedingSeason,
        pregnantFromManualRecord,
        animalsInReferencePeriod: this.referencePeriodStats.inPeriod,
        animalsExcludedFromPeriod: this.referencePeriodStats.excluded,
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
