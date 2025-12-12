// ============================================
// TIPOS DE DASHBOARD E FILTROS
// ============================================

import { Raca } from './animal';

// Ordenação e filtros
export type SortField = 'brinco' | 'nome' | 'pesoKg' | 'dataNascimento' | 'raca' | 'status';
export type SortDirection = 'asc' | 'desc';
export type SearchField = 'brinco' | 'nome' | 'paiNome' | 'maeNome' | 'medicamento' | 'motivo';

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
  searchTerm: string;
  selectedMedication: string;
  selectedReason: string;
  selectedStatus: string;
  selectedSexo: string;
  selectedRaca: string;
  selectedAreaId: string;
  weightRange: WeightRange;
  ageRange: AgeRange;
  searchFields: SearchField[];
  sortConfig: SortConfig;
}

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

// Widgets do Dashboard
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

// Estatísticas filtradas
export interface FilteredStats {
  totalAnimals: number;
  totalWeight: number;
  averageWeight: number;
  maleCount: number;
  femaleCount: number;
  activeCount: number;
  breedDistribution: Record<string, number>;
  ageDistribution: {
    bezerros: number;
    jovens: number;
    novilhos: number;
    adultos: number;
  };
  weightRangeDistribution: {
    leve: number;
    medio: number;
    pesado: number;
  };
  areaDistribution: Record<string, number>;
  healthStats: {
    totalTreatments: number;
    animalsWithTreatments: number;
    mostUsedMedication: string;
  };
  gmdStats?: {
    averageGMD: number;
    animalsWithGMD: number;
    topPerformers: number;
    underperformers: number;
  };
}

// Clima
export enum WeatherCondition {
  Ensolarado = 'Ensolarado',
  Nublado = 'Nublado',
  Chuvoso = 'Chuvoso',
  Tempestade = 'Tempestade',
  Geada = 'Geada',
  Seco = 'Seco',
}

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
  precipitation: number;
  condition: WeatherCondition;
}

export interface WeatherAlert {
  id: string;
  type: 'geada' | 'seca' | 'chuva_intensa' | 'calor_extremo';
  severity: 'low' | 'medium' | 'high';
  message: string;
  date: Date;
  isRead: boolean;
}
