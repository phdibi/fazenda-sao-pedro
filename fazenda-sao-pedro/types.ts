// --- User Type ---
export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

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

export interface MedicationAdministration {
  id: string;
  medicamento: string;
  dataAplicacao: Date;
  dose: number;
  unidade: 'ml' | 'mg' | 'dose';
  motivo: string;
  responsavel: string;
}

export enum WeighingType {
  None = 'Nenhum',
  Birth = 'Nascimento',      // ✅ NOVO: Tipo nascimento
  Weaning = 'Desmame',
  Yearling = 'Sobreano',
}

export interface WeightEntry {
  id: string;
  date: Date;
  weightKg: number;
  type?: WeighingType;
}

export enum PregnancyType {
  TransferenciaEmbriao = 'Transferência de Embrião',
  InseminacaoArtificial = 'Inseminação Artificial',
  Monta = 'Monta Natural',
}

export interface PregnancyRecord {
  id: string;
  date: Date;
  type: PregnancyType;
  sireName: string;
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
  id:string;
  brinco: string;
  nome?: string;
  raca: Raca;
  sexo: Sexo;
  pesoKg: number; // Represents the latest weight
  dataNascimento: Date;
  status: AnimalStatus;
  fotos: string[];
  historicoSanitario: MedicationAdministration[];
  historicoPesagens: WeightEntry[];
  historicoPrenhez?: PregnancyRecord[];
  historicoAborto?: AbortionRecord[];
  historicoProgenie?: OffspringWeightRecord[];
  paiNome?: string;
  maeNome?: string;
  maeRaca?: Raca;
  managementAreaId?: string;
}

export enum CalendarEventType {
    Evento = 'Evento',
    Observacao = 'Observação',
    Compromisso = 'Compromisso',
}

export interface CalendarEvent {
    id: string;
    date: Date;
    title: string;
    type: CalendarEventType;
    description?: string;
}

export interface Task {
  id: string;
  description: string;
  dueDate?: Date;
  isCompleted: boolean;
}

export interface ManagementArea {
  id: string;
  name: string;
  areaHa: number;
}

// --- Report Types ---
export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface MedicationUsageDetail {
    label: string; // Medication name
    value: number; // Total count
    monthlyUsage: ChartDataPoint[]; // Usage breakdown by month
}

export interface TopTreatedAnimal {
    animalId: string;
    brinco: string;
    nome: string;
    treatmentCount: number;
}

export interface MonthlyMedicationUsage {
  label: string; // e.g. "ago/2024"
  value: number; // total treatments
  medications: ChartDataPoint[]; // Top meds for that month
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

export interface ComprehensiveReport {
    sanitary: SanitaryReportData;
    reproductive: ReproductiveReportData;
}
