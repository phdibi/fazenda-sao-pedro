// ============================================
// TIPOS PARA FORMULÁRIOS
// ============================================

import { Animal, MedicationAdministration, MedicationItem, WeighingType } from './animal';

/**
 * Estado editável de Animal (pesoKg como string para inputs)
 */
export type EditableAnimalState = Omit<Animal, 'pesoKg'> & { pesoKg: string };

/**
 * Item de medicação no formulário (dose como string para inputs)
 */
export interface MedicationItemFormState {
  id: string; // ID único para key no React
  medicamento: string;
  dose: string;
  unidade: 'ml' | 'mg' | 'dose';
}

/**
 * Estado de formulário de medicação - suporta múltiplos medicamentos por tratamento
 */
export interface MedicationFormState {
  medicamentos: MedicationItemFormState[];
  dataAplicacao: Date;
  motivo: string;
  responsavel: string;
}

/**
 * Helper para criar um item de medicação vazio
 */
export const createEmptyMedicationItem = (): MedicationItemFormState => ({
  id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  medicamento: '',
  dose: '',
  unidade: 'ml',
});

/**
 * Helper para criar o estado inicial do formulário de medicação
 */
export const createInitialMedicationFormState = (): MedicationFormState => ({
  medicamentos: [createEmptyMedicationItem()],
  dataAplicacao: new Date(),
  motivo: '',
  responsavel: 'Equipe Campo',
});

/**
 * Converte MedicationFormState para MedicationItem[] (para salvar)
 */
export const formStateToMedicationItems = (formState: MedicationFormState): MedicationItem[] => {
  return formState.medicamentos
    .filter(item => item.medicamento.trim() !== '')
    .map(item => ({
      medicamento: item.medicamento,
      dose: parseFloat(item.dose) || 0,
      unidade: item.unidade,
    }));
};

/**
 * @deprecated Use MedicationFormState com medicamentos[] em vez disso
 * Mantido para compatibilidade com código legado
 */
export type LegacyMedicationFormState = Omit<MedicationAdministration, 'id' | 'dose' | 'medicamentos'> & {
  dose: string;
  medicamento: string;
};

/**
 * Estado de formulário de progênie
 */
export interface OffspringFormState {
  id?: string;
  offspringBrinco: string;
  birthWeightKg: string;
  weaningWeightKg: string;
  yearlingWeightKg: string;
}

/**
 * Estado de formulário de peso
 */
export interface WeightFormState {
  weight: string;
  type: WeighingType;
}

/**
 * Tipo para validação de formulário
 */
export interface FormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Campo de formulário com metadados
 */
export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  dirty: boolean;
}

/**
 * Hook de formulário genérico
 */
export interface UseFormReturn<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isValid: boolean;
  isSubmitting: boolean;
  handleChange: (field: keyof T, value: T[keyof T]) => void;
  handleBlur: (field: keyof T) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e: React.FormEvent) => void;
  reset: () => void;
  setFieldValue: (field: keyof T, value: T[keyof T]) => void;
  setFieldError: (field: keyof T, error: string) => void;
}
