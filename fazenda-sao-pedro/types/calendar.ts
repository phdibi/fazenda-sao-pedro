// ============================================
// TIPOS DE CALENDÁRIO E TAREFAS
// ============================================

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

// Lotes de manejo
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
