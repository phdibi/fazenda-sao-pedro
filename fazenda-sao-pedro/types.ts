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
  thumbnailUrl?: string; // 🔧 OTIMIZAÇÃO: URL do thumbnail para listagens
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
  | 'weight-evolution'
  | 'weather';

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
  { id: 'w10', type: 'weather', title: 'Clima e Precipitação', enabled: true, order: 10, size: 'medium' },
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
  // GMD Stats (novo)
  gmdStats?: {
    averageGMD: number;
    animalsWithGMD: number;
    topPerformers: number;      // GMD > 1.0
    underperformers: number;    // GMD < 0.5
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

// ============================================
// 🆕 GMD - GANHO MÉDIO DIÁRIO
// ============================================

export interface GainMetrics {
  gmdNascimentoDesmame?: number;  // kg/dia
  gmdDesmameSobreano?: number;    // kg/dia
  gmdTotal?: number;              // kg/dia geral
  gmdUltimos30Dias?: number;      // kg/dia recente
  diasAcompanhamento?: number;
  pesoInicial?: number;
  pesoFinal?: number;
}

// ============================================
// 🆕 LOTES DE MANEJO
// ============================================

export interface ManagementBatch {
  id: string;
  name: string;
  description?: string;
  animalIds: string[];
  createdAt: Date;
  completedAt?: Date;
  purpose: BatchPurpose;
  status: 'active' | 'completed' | 'archived';
  notes?: string;
}

export enum BatchPurpose {
  Vacinacao = 'Vacinação',
  Vermifugacao = 'Vermifugação',
  Pesagem = 'Pesagem',
  Venda = 'Venda',
  Desmame = 'Desmame',
  Confinamento = 'Confinamento',
  Exposicao = 'Exposição',
  Apartacao = 'Apartação',
  Outros = 'Outros',
}

// ============================================
// 🆕 INTEGRAÇÃO BALANÇA DIGITAL
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
// 🆕 PREVISÃO DE PESO COM IA
// ============================================

export interface WeightPrediction {
  animalId: string;
  currentWeight: number;
  predictedWeight: number;
  targetDate: Date;
  confidence: number; // 0-100%
  basedOnDays: number;
  projectedGMD: number;
}

// ============================================
// 🆕 HISTÓRICO DE CLIMA
// ============================================

export interface WeatherData {
  id: string;
  date: Date;
  location: string;
  temperature: {
    min: number;
    max: number;
    avg: number;
  };
  humidity: number;
  precipitation: number; // mm
  condition: WeatherCondition;
}

export enum WeatherCondition {
  Ensolarado = 'Ensolarado',
  Nublado = 'Nublado',
  Chuvoso = 'Chuvoso',
  Tempestade = 'Tempestade',
  Geada = 'Geada',
  Seco = 'Seco',
}

export interface WeatherAlert {
  id: string;
  type: 'geada' | 'seca' | 'chuva_intensa' | 'calor_extremo';
  severity: 'low' | 'medium' | 'high';
  message: string;
  date: Date;
  isRead: boolean;
}

export interface WeatherCorrelation {
  period: string;
  avgTemperature: number;
  avgPrecipitation: number;
  avgGMD: number;
  animalCount: number;
}

// ============================================
// 🆕 PERFIS DE USUÁRIO
// ============================================

export enum UserRole {
  Proprietario = 'proprietario',
  Capataz = 'capataz',
  Veterinario = 'veterinario',
  Funcionario = 'funcionario',
}

export interface UserProfile extends AppUser {
  role: UserRole;
  permissions: UserPermissions;
}

export interface UserPermissions {
  canViewAnimals: boolean;
  canEditAnimals: boolean;
  canDeleteAnimals: boolean;
  canViewFinancial: boolean;
  canEditFinancial: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canViewCalendar: boolean;
  canEditCalendar: boolean;
  canViewTasks: boolean;
  canEditTasks: boolean;
}

export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  [UserRole.Proprietario]: {
    canViewAnimals: true,
    canEditAnimals: true,
    canDeleteAnimals: true,
    canViewFinancial: true,
    canEditFinancial: true,
    canViewReports: true,
    canManageUsers: true,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewTasks: true,
    canEditTasks: true,
  },
  [UserRole.Capataz]: {
    canViewAnimals: false,
    canEditAnimals: false,
    canDeleteAnimals: false,
    canViewFinancial: false,
    canEditFinancial: false,
    canViewReports: false,
    canManageUsers: false,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewTasks: true,
    canEditTasks: true,
  },
  [UserRole.Veterinario]: {
    canViewAnimals: true,
    canEditAnimals: true,
    canDeleteAnimals: false,
    canViewFinancial: false,
    canEditFinancial: false,
    canViewReports: true,
    canManageUsers: false,
    canViewCalendar: true,
    canEditCalendar: true,
    canViewTasks: true,
    canEditTasks: true,
  },
  [UserRole.Funcionario]: {
    canViewAnimals: true,
    canEditAnimals: false,
    canDeleteAnimals: false,
    canViewFinancial: false,
    canEditFinancial: false,
    canViewReports: false,
    canManageUsers: false,
    canViewCalendar: true,
    canEditCalendar: false,
    canViewTasks: true,
    canEditTasks: false,
  },
};

// ============================================
// 🆕 COMPARATIVO DE PERFORMANCE
// ============================================

export interface PerformanceComparison {
  animalId: string;
  brinco: string;
  nome?: string;
  raca: Raca;
  sexo: Sexo;
  idade: number; // em meses
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