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
}

export interface ScaleImportResult {
  total: number;
  matched: number;
  unmatched: number;
  readings: ScaleReading[];
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
