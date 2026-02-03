// ============================================
// 🔧 OTIMIZAÇÃO: TIPOS ORGANIZADOS POR DOMÍNIO
// ============================================
// Este arquivo re-exporta todos os tipos para manter
// compatibilidade com imports existentes

// Animal e relacionados
export * from './animal';

// Calendário, tarefas e lotes
export * from './calendar';

// Usuário e permissões
export * from './user';

// Dashboard, filtros e clima
export * from './dashboard';

// Firestore e cache
export * from './firestore';

// Formulários
export * from './forms';

// ============================================
// TIPOS DE RELATÓRIOS (mantidos aqui por agora)
// ============================================

import { Raca } from './animal';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface MedicationUsageDetail {
  label: string;
  value: number;
  monthlyUsage: ChartDataPoint[];
}

export interface TopTreatedAnimal {
  animalId: string;
  brinco: string;
  nome: string;
  treatmentCount: number;
}

export interface MonthlyMedicationUsage {
  label: string;
  value: number;
  medications: ChartDataPoint[];
}

export interface SanitaryReportData {
  topTreatedAnimals: TopTreatedAnimal[];
  medicationUsage: MedicationUsageDetail[];
  seasonalAnalysis: MonthlyMedicationUsage[];
  reasonAnalysis: ChartDataPoint[];
  recommendations: string;
}

export interface DamPerformanceData {
  damId: string;
  damBrinco: string;
  damNome?: string;
  offspringCount: number;
  avgBirthWeight?: number;
  avgWeaningWeight?: number;
  avgYearlingWeight?: number;
}

export interface ReproductiveReportData {
  performanceData: DamPerformanceData[];
  recommendations: string;
}

export interface TurnWeightAnalysis {
  averageWeight: number;
  totalAnimals: number;
  topPerformers: { brinco: string; weight: number; raca: string }[];
  breedAnalysis: { raca: string; avgWeight: number; count: number }[];
  recommendations: string;
}

export interface ComprehensiveReport {
  sanitary: SanitaryReportData;
  reproductive: ReproductiveReportData;
  turnWeight: TurnWeightAnalysis;
}

// ============================================
// INTEGRAÇÃO BALANÇA DIGITAL
// ============================================

export interface ScaleReading {
  id: string;
  timestamp: Date;
  weight: number;
  unit: 'kg' | 'arroba';
  animalBrinco?: string;
  matched: boolean;
  animalId?: string;
  warnings?: string[];
}

export interface ScaleSkippedLine {
  lineNumber: number;
  content: string;
  reason: string;
}

export interface ScaleImportResult {
  total: number;
  matched: number;
  unmatched: number;
  readings: ScaleReading[];
  skippedLines: ScaleSkippedLine[];
}

// ============================================
// CORRELAÇÃO CLIMA
// ============================================

export interface WeatherCorrelation {
  period: string;
  avgTemperature: number;
  avgPrecipitation: number;
  avgGMD: number;
  animalCount: number;
}

// ============================================
// 🔧 KPIs ZOOTÉCNICOS
// ============================================

export interface ZootechnicalKPIs {
  // Taxa de desmame: bezerros desmamados / vacas expostas × 100
  weaningRate: number;
  // Peso médio ao desmame em kg
  avgWeaningWeight: number;
  // Intervalo entre partos em dias
  calvingInterval: number;
  // Taxa de prenhez: vacas prenhes / vacas expostas × 100
  pregnancyRate: number;
  // Kg de bezerro/vaca/ano: (peso desmame × taxa desmame) / vacas expostas
  kgCalfPerCowYear: number;
  // Taxa de mortalidade: óbitos / total × 100
  mortalityRate: number;
  // GMD médio do rebanho
  avgGMD: number;
  // Taxa de natalidade: nascimentos / vacas expostas × 100
  birthRate: number;
  // Idade média ao primeiro parto em meses
  avgFirstCalvingAge: number;
  // Peso médio ao nascimento
  avgBirthWeight: number;
  // Peso médio ao sobreano
  avgYearlingWeight: number;
}

export interface KPITarget {
  metric: keyof ZootechnicalKPIs;
  target: number;
  unit: string;
  description: string;
  minAcceptable: number;
  excellent: number;
}

export const DEFAULT_KPI_TARGETS: KPITarget[] = [
  { metric: 'weaningRate', target: 80, unit: '%', description: 'Taxa de Desmame', minAcceptable: 70, excellent: 90 },
  { metric: 'avgWeaningWeight', target: 180, unit: 'kg', description: 'Peso Médio Desmame', minAcceptable: 150, excellent: 200 },
  { metric: 'calvingInterval', target: 365, unit: 'dias', description: 'Intervalo Entre Partos', minAcceptable: 400, excellent: 330 },
  { metric: 'pregnancyRate', target: 85, unit: '%', description: 'Taxa de Prenhez', minAcceptable: 75, excellent: 92 },
  { metric: 'kgCalfPerCowYear', target: 140, unit: 'kg', description: 'Kg Bezerro/Vaca/Ano', minAcceptable: 100, excellent: 160 },
  { metric: 'mortalityRate', target: 3, unit: '%', description: 'Taxa de Mortalidade', minAcceptable: 5, excellent: 2 },
  { metric: 'avgGMD', target: 0.8, unit: 'kg/dia', description: 'GMD Médio', minAcceptable: 0.5, excellent: 1.0 },
  { metric: 'birthRate', target: 85, unit: '%', description: 'Taxa de Natalidade', minAcceptable: 75, excellent: 92 },
  { metric: 'avgFirstCalvingAge', target: 24, unit: 'meses', description: 'Idade 1º Parto', minAcceptable: 30, excellent: 22 },
  { metric: 'avgBirthWeight', target: 32, unit: 'kg', description: 'Peso Médio Nascimento', minAcceptable: 28, excellent: 35 },
  { metric: 'avgYearlingWeight', target: 300, unit: 'kg', description: 'Peso Médio Sobreano', minAcceptable: 250, excellent: 350 },
];

// ============================================
// 🔧 ESTAÇÃO DE MONTA DIGITAL
// ============================================

export type BreedingSeasonStatus = 'planning' | 'active' | 'finished' | 'cancelled';
export type CoverageType = 'natural' | 'ia' | 'iatf' | 'fiv';

export interface RepasseBull {
  bullId: string;
  bullBrinco: string;
}

export interface RepasseData {
  enabled: boolean;
  /** @deprecated Use bulls[] instead. Kept for backward compat with single-bull records. */
  bullId?: string;
  /** @deprecated Use bulls[] instead. */
  bullBrinco?: string;
  /** Touros do repasse (suporta 1 ou 2 touros na monta natural) */
  bulls?: RepasseBull[];
  /** ID do touro confirmado como pai (preenchido após nascimento) */
  confirmedSireId?: string;
  confirmedSireBrinco?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  diagnosisDate?: Date;
  diagnosisResult?: 'positive' | 'negative' | 'pending';
  // Resultado do parto (para repasse com DG positivo)
  /** Resultado do parto do repasse: 'realizado' = terneiro nasceu, 'aborto' = não nasceu */
  calvingResult?: 'realizado' | 'aborto' | 'pending';
  /** Data real do parto do repasse */
  actualCalvingDate?: Date;
  /** ID do terneiro nascido do repasse */
  calfId?: string;
  /** Brinco do terneiro nascido do repasse */
  calfBrinco?: string;
  /** Observações sobre o parto ou aborto do repasse */
  calvingNotes?: string;
}

export interface CoverageRecord {
  id: string;
  cowId: string;
  cowBrinco: string;
  /** @deprecated Use bulls[] instead for natural coverage. Kept for backward compat with single-bull records. */
  bullId?: string;
  /** @deprecated Use bulls[] instead for natural coverage. */
  bullBrinco?: string;
  /** Touros da cobertura natural (suporta 1 ou 2 touros na monta natural direta) */
  bulls?: RepasseBull[];
  /** ID do touro confirmado como pai (quando 2 touros na monta natural) */
  confirmedSireId?: string;
  confirmedSireBrinco?: string;
  semenCode?: string; // Para IA/IATF/FIV - usado como nome do pai
  // Campos específicos para FIV (receptora vs doadora)
  donorCowId?: string; // ID da doadora (mãe biológica) para FIV
  donorCowBrinco?: string; // Brinco da doadora para FIV
  date: Date;
  type: CoverageType;
  technician?: string;
  notes?: string;
  // Resultado do diagnóstico de gestação
  pregnancyCheckDate?: Date;
  pregnancyResult?: 'positive' | 'negative' | 'pending';
  expectedCalvingDate?: Date;
  // Resultado do parto (verificação pós-nascimentos)
  /** Resultado do parto: 'realizado' = terneiro nasceu, 'aborto' = não nasceu/perdeu, 'pending' = aguardando */
  calvingResult?: 'realizado' | 'aborto' | 'pending';
  /** Data real do parto (quando realizado) */
  actualCalvingDate?: Date;
  /** ID do terneiro nascido (link com animal cadastrado) */
  calfId?: string;
  /** Brinco do terneiro nascido */
  calfBrinco?: string;
  /** Observações sobre o parto ou aborto */
  calvingNotes?: string;
  // Repasse: monta natural para vacas vazias de IATF/FIV
  repasse?: RepasseData;
}

export interface BreedingSeason {
  id: string;
  userId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: BreedingSeasonStatus;
  // Touros utilizados
  bulls: {
    id: string;
    brinco: string;
    nome?: string;
    type: 'natural' | 'semen';
  }[];
  // Vacas expostas
  exposedCowIds: string[];
  // Registros de cobertura
  coverageRecords: CoverageRecord[];
  // Configurações
  config: {
    useIATF: boolean;
    iatfProtocol?: string;
    pregnancyCheckDays: number; // Dias após cobertura para diagnóstico
    targetPregnancyRate: number;
  };
  // Métricas calculadas
  metrics?: {
    totalExposed: number;
    totalCovered: number;
    totalPregnant: number;
    pregnancyRate: number;
    serviceRate: number; // Vacas cobertas / Vacas expostas
    conceptionRate: number; // Prenhes / Cobertas
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 🔧 CONFIGURAÇÃO DE TROCA DE TOUROS
// ============================================

/** Configuração de troca de touros por cobertura para confirmação de paternidade */
export interface BullSwitchConfig {
  /** ID da cobertura */
  coverageId: string;
  /** Se é do repasse (true) ou cobertura principal (false) */
  isRepasse: boolean;
  /** Data de troca de touros - usado para calcular qual touro é o pai */
  switchDate?: Date;
  /** Índice do touro selecionado diretamente (0 = primeiro, 1 = segundo) - se definido, ignora switchDate */
  selectedBullIndex?: 0 | 1;
}

// ============================================
// 🔧 DEP - DIFERENÇA ESPERADA NA PROGÊNIE
// ============================================

export interface DEPValues {
  // Pesos
  birthWeight: number;      // DEP Peso ao Nascimento (kg)
  weaningWeight: number;    // DEP Peso ao Desmame (kg)
  yearlingWeight: number;   // DEP Peso ao Sobreano (kg)
  // Maternais
  milkProduction: number;   // DEP Produção de Leite (kg)
  totalMaternal: number;    // DEP Habilidade Materna Total (kg)
  // Carcaça (se disponível)
  ribeyeArea?: number;      // DEP Área de Olho de Lombo (cm²)
  fatThickness?: number;    // DEP Espessura de Gordura (mm)
  // Fertilidade
  scrotalCircumference?: number; // DEP Circunferência Escrotal (cm)
  stayability?: number;     // DEP Permanência (%)
}

export interface DEPReport {
  animalId: string;
  brinco: string;
  nome?: string;
  sexo: string;
  raca: string;
  // Valores DEP calculados
  dep: DEPValues;
  // Acurácias (% confiança baseado no número de informações)
  accuracy: {
    birthWeight: number;
    weaningWeight: number;
    yearlingWeight: number;
    milkProduction: number;
    totalMaternal: number;
  };
  // Percentis dentro do rebanho
  percentile: {
    birthWeight: number;
    weaningWeight: number;
    yearlingWeight: number;
    milkProduction: number;
    totalMaternal: number;
  };
  // Informações usadas no cálculo
  dataSource: {
    ownRecords: number;       // Registros próprios
    progenyRecords: number;   // Registros de progênie
    siblingsRecords: number;  // Registros de irmãos
  };
  // Recomendação de uso
  recommendation: 'reprodutor_elite' | 'reprodutor' | 'descarte' | 'matriz_elite' | 'matriz' | 'indefinido';
  calculatedAt: Date;
}

// Médias e desvios padrão do rebanho para cálculo de DEP
export interface HerdDEPBaseline {
  raca: string;
  metrics: {
    birthWeight: { mean: number; stdDev: number };
    weaningWeight: { mean: number; stdDev: number };
    yearlingWeight: { mean: number; stdDev: number };
  };
  updatedAt: Date;
}

// ============================================
// 🔧 FILA OFFLINE PERSISTENTE
// ============================================

export type OfflineOperationType =
  | 'add_animal'
  | 'update_animal'
  | 'delete_animal'
  | 'add_weight'
  | 'add_medication'
  | 'add_pregnancy'
  | 'add_calendar_event'
  | 'update_calendar_event'
  | 'delete_calendar_event'
  | 'add_task'
  | 'update_task'
  | 'delete_task'
  | 'add_breeding_coverage';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  collection: string;
  documentId?: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}
