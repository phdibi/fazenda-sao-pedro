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
  Birth = 'Nascimento',
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
  id: string;
  brinco: string;
  nome?: string;
  raca: Raca;
  sexo: Sexo;
  pesoKg: number;
  dataNascimento?: Date;
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

// ============================================
// 🆕 NOVOS TIPOS PARA FILTROS AVANÇADOS
// ============================================

export type SortField = 'brinco' | 'nome' | 'pesoKg' | 'dataNascimento' | 'raca' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface WeightRange {
  min: number | null;
  max: number | null;
}

export interface AgeRange {
  minMonths: number | null;
  maxMonths: number | null;
}

export interface AdvancedFilters {
  // Filtros básicos existentes
  searchTerm: string;
  selectedMedication: string;
  selectedReason: string;
  selectedStatus: string;
  selectedSexo: string;
  
  // Novos filtros
  selectedRaca: string;
  selectedAreaId: string;
  weightRange: WeightRange;
  ageRange: AgeRange;
  
  // Busca avançada
  searchFields: SearchField[];
  
  // Ordenação
  sortConfig: SortConfig;
}

export type SearchField = 'brinco' | 'nome' | 'paiNome' | 'maeNome' | 'medicamento' | 'motivo';

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  searchTerm: '',
  selectedMedication: '',
  selectedReason: '',
  selectedStatus: '',
  selectedSexo: '',
  selectedRaca: '',
  selectedAreaId: '',
  weightRange: { min: null, max: null },
  ageRange: { minMonths: null, maxMonths: null },
  searchFields: ['brinco', 'nome'],
  sortConfig: { field: 'brinco', direction: 'asc' },
};

// ============================================
// 🆕 NOVOS TIPOS PARA DASHBOARD CUSTOMIZÁVEL
// ============================================

export type DashboardWidgetType = 
  | 'breed-distribution'
  | 'sex-distribution'
  | 'weight-chart'
  | 'age-distribution'
  | 'calendar-preview'
  | 'tasks-preview'
  | 'area-distribution'
  | 'health-summary'
  | 'weight-evolution';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  enabled: boolean;
  order: number;
  size: 'small' | 'medium' | 'large';
}

export interface DashboardConfig {
  widgets: DashboardWidget[];
  layout: 'grid' | 'list';
  compactMode: boolean;
}

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'w1', type: 'breed-distribution', title: 'Distribuição por Raça', enabled: true, order: 1, size: 'medium' },
  { id: 'w2', type: 'sex-distribution', title: 'Distribuição por Sexo', enabled: true, order: 2, size: 'small' },
  { id: 'w3', type: 'weight-chart', title: 'Peso Médio por Mês', enabled: true, order: 3, size: 'large' },
  { id: 'w4', type: 'age-distribution', title: 'Distribuição por Idade', enabled: true, order: 4, size: 'medium' },
  { id: 'w5', type: 'calendar-preview', title: 'Próximos Eventos', enabled: true, order: 5, size: 'medium' },
  { id: 'w6', type: 'tasks-preview', title: 'Tarefas Pendentes', enabled: true, order: 6, size: 'medium' },
  { id: 'w7', type: 'area-distribution', title: 'Animais por Área', enabled: false, order: 7, size: 'medium' },
  { id: 'w8', type: 'health-summary', title: 'Resumo Sanitário', enabled: false, order: 8, size: 'medium' },
  { id: 'w9', type: 'weight-evolution', title: 'Evolução de Peso', enabled: false, order: 9, size: 'large' },
];

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  widgets: DEFAULT_DASHBOARD_WIDGETS,
  layout: 'grid',
  compactMode: false,
};

// ============================================
// 🆕 TIPOS PARA ESTATÍSTICAS FILTRADAS
// ============================================

export interface FilteredStats {
  totalAnimals: number;
  totalWeight: number;
  averageWeight: number;
  maleCount: number;
  femaleCount: number;
  activeCount: number;
  breedDistribution: Record<string, number>;
  ageDistribution: {
    bezerros: number;    // 0-6 meses
    jovens: number;      // 6-12 meses
    novilhos: number;    // 12-24 meses
    adultos: number;     // 24+ meses
  };
  weightRangeDistribution: {
    leve: number;        // < 200kg
    medio: number;       // 200-400kg
    pesado: number;      // > 400kg
  };
  areaDistribution: Record<string, number>;
  healthStats: {
    totalTreatments: number;
    animalsWithTreatments: number;
    mostUsedMedication: string;
  };
}

// --- Report Types ---
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

export interface ComprehensiveReport {
  sanitary: SanitaryReportData;
  reproductive: ReproductiveReportData;
}