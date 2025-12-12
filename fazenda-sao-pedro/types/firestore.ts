// ============================================
// TIPOS DE FIRESTORE E OPERAÇÕES DE BANCO
// ============================================

import { Animal } from './animal';
import { CalendarEvent, Task, ManagementArea } from './calendar';
import { WeighingType } from './animal';

// Nomes das coleções
export type FirestoreCollectionName = 'animals' | 'calendar' | 'tasks' | 'areas';

export interface FirestoreCollectionMap {
  animals: Animal;
  calendar: CalendarEvent;
  tasks: Task;
  areas: ManagementArea;
}

export type LocalStateCollectionName = 'animals' | 'calendarEvents' | 'tasks' | 'managementAreas';

export interface LocalStateCollectionMap {
  animals: Animal;
  calendarEvents: CalendarEvent;
  tasks: Task;
  managementAreas: ManagementArea;
}

// Loading states
export type LoadingKey = 'animals' | 'calendar' | 'tasks' | 'areas';
export type LoadingState = Record<LoadingKey, boolean>;

// Resultados de operação
export interface FirestoreOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Erros tipados
export type FirestoreErrorCode = 
  | 'permission-denied'
  | 'unavailable'
  | 'not-found'
  | 'already-exists'
  | 'resource-exhausted'
  | 'cancelled'
  | 'unknown';

export interface FirestoreError {
  code: FirestoreErrorCode;
  message: string;
  details?: unknown;
}

export function isFirestoreError(error: unknown): error is FirestoreError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

// Props base para componentes
export interface WithFirestoreProps {
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

// Cache
export interface CacheConfig {
  version: string;
  expiryMs: number;
}

export interface CacheEntry<T> {
  data: T[];
  timestamp: number;
  version: string;
}

export interface CacheStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
}

// Rate limiting
export interface RateLimitConfig {
  calls: number;
  windowMs: number;
}

export interface RateLimitStats {
  used: number;
  remaining: number;
  total: number;
  resetInMs: number;
}
