// ============================================
// TIPOS PARA FORMULÁRIOS
// ============================================

import { Animal, MedicationAdministration, WeighingType } from './animal';

/**
 * Estado editável de Animal (pesoKg como string para inputs)
 */
export type EditableAnimalState = Omit<Animal, 'pesoKg'> & { pesoKg: string };

/**
 * Estado de formulário de medicação
 */
export type MedicationFormState = Omit<MedicationAdministration, 'id' | 'dose'> & { dose: string };

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
  handleChange: (field: keyof T, value: any) => void;
  handleBlur: (field: keyof T) => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e: React.FormEvent) => void;
  reset: () => void;
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldError: (field: keyof T, error: string) => void;
}
