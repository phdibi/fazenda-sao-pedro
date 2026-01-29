// ============================================
// TIPOS DE ANIMAL - DOMÍNIO PRINCIPAL
// ============================================

export enum Raca {
  Hereford = 'Hereford',
  Braford = 'Braford',
  HerefordPO = 'Hereford PO',
  Outros = 'Outros',
}

export enum Sexo {
  Macho = 'Macho',
  Femea = 'Fêmea',
}

export enum AnimalStatus {
  Ativo = 'Ativo',
  Vendido = 'Vendido',
  Obito = 'Óbito',
}

export enum WeighingType {
  None = 'Nenhum',
  Birth = 'Nascimento',
  Weaning = 'Desmame',
  Yearling = 'Sobreano',
  Turn = 'Peso de Virada',
}

export enum PregnancyType {
  FIV = 'FIV (Fertilização In Vitro)',
  InseminacaoArtificial = 'Inseminação Artificial',
  Monta = 'Monta Natural',
}

export interface MedicationAdministration {
  id: string;
  medicamento: string;
  dataAplicacao: Date;
  dose: number;
  unidade: 'ml' | 'mg' | 'dose';
  motivo: string;
  responsavel: string;
}

export interface WeightEntry {
  id: string;
  date: Date;
  weightKg: number;
  type?: WeighingType;
}

export interface PregnancyRecord {
  id: string;
  date: Date;
  type: PregnancyType;
  sireName: string;
  /** Resultado do DG vinculado: 'positive' | 'negative' | 'pending' */
  result?: 'positive' | 'negative' | 'pending';
}

export interface AbortionRecord {
  id: string;
  date: Date;
}

export interface OffspringWeightRecord {
  id: string;
  offspringBrinco: string;
  birthWeightKg?: number;
  weaningWeightKg?: number;
  yearlingWeightKg?: number;
}

export interface Animal {
  id: string;
  brinco: string;
  nome?: string;
  raca: Raca;
  sexo: Sexo;
  pesoKg: number;
  dataNascimento?: Date;
  status: AnimalStatus;
  fotos: string[];
  thumbnailUrl?: string;
  historicoSanitario: MedicationAdministration[];
  historicoPesagens: WeightEntry[];
  historicoPrenhez?: PregnancyRecord[];
  historicoAborto?: AbortionRecord[];
  historicoProgenie?: OffspringWeightRecord[];
  // Vínculos genealógicos por ID (mais confiável - preferência)
  paiId?: string;
  maeId?: string;
  // Nomes mantidos para compatibilidade, display e fallback
  paiNome?: string;
  maeNome?: string;
  maeRaca?: Raca;
  managementAreaId?: string;
  // Campos específicos para FIV (Fertilização In Vitro)
  // Se o animal nasceu de FIV, a mãe biológica (doadora) é diferente da gestante (receptora)
  isFIV?: boolean;                    // True se o animal nasceu de FIV
  maeBiologicaId?: string;            // ID da doadora (mãe genética) - para FIV
  maeBiologicaNome?: string;          // Brinco da doadora - para FIV
  maeReceptoraId?: string;            // ID da receptora (quem gestou) - para FIV
  maeReceptoraNome?: string;          // Brinco da receptora - para FIV
}

// GMD - Ganho Médio Diário
export interface GMDMetrics {
  gmdTotal: number | null;
  gmdRecente: number | null;
}

export interface AnimalWithCachedGMD extends Animal {
  _cachedGMD: GMDMetrics;
}

export interface GainMetrics {
  gmdNascimentoDesmame?: number;
  gmdDesmameSobreano?: number;
  gmdTotal?: number;
  gmdUltimos30Dias?: number;
  diasAcompanhamento?: number;
  pesoInicial?: number;
  pesoFinal?: number;
}

// Predição de peso
export interface WeightPrediction {
  animalId: string;
  currentWeight: number;
  predictedWeight: number;
  targetDate: Date;
  confidence: number;
  basedOnDays: number;
  projectedGMD: number;
}

// Comparativo de performance
export interface PerformanceComparison {
  animalId: string;
  brinco: string;
  nome?: string;
  raca: Raca;
  sexo: Sexo;
  idade: number;
  pesoAtual: number;
  gmd: number;
  rankingGeral: number;
  rankingRaca: number;
  paiNome?: string;
  maeNome?: string;
}

export interface BullProgenyComparison {
  bullName: string;
  offspringCount: number;
  avgGMD: number;
  avgWeaningWeight: number;
  avgYearlingWeight: number;
  bestOffspring: {
    brinco: string;
    gmd: number;
  };
}

export interface RaceBenchmark {
  raca: Raca;
  count: number;
  avgWeight: number;
  avgGMD: number;
  avgAge: number;
  topPerformers: PerformanceComparison[];
}
