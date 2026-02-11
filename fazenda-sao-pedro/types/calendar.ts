// ============================================
// TIPOS DE CALENDÁRIO E TAREFAS
// ============================================

import { WeighingType } from './animal';

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
  Medicamentos = 'Medicamentos',
  Pesagem = 'Pesagem',
  Venda = 'Venda',
  Desmame = 'Desmame',
  Confinamento = 'Confinamento',
  Exposicao = 'Exposição',
  Apartacao = 'Apartação',
  Outros = 'Outros',
}

/** Sub-tipos para a finalidade "Medicamentos" */
export type MedicationSubType = 'Vacinação' | 'Vermifugação' | 'Banho' | 'Protocolo Cio' | 'Outro';

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

  // Dados de sincronização ao concluir o lote

  // Para Vacinação/Vermifugação/Medicamentos: lista de medicações aplicadas (suporta múltiplos)
  medicationDataList?: {
    medicamento: string;
    dose: number;
    unidade: 'ml' | 'mg' | 'dose';
    responsavel: string;
    subType?: MedicationSubType;
  }[];

  /** @deprecated Use medicationDataList[] - mantido para backward compat com lotes já concluídos */
  medicationData?: {
    medicamento: string;
    dose: number;
    unidade: 'ml' | 'mg' | 'dose';
    responsavel: string;
  };

  /** Sub-tipo de medicamento (para purpose === 'Medicamentos') */
  medicationSubType?: MedicationSubType;

  // Para Pesagem/Desmame: pesos individuais por animal
  animalWeights?: Record<string, number>;

  // Para Pesagem: tipo de pesagem
  weighingType?: WeighingType;
}
