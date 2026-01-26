/**
 * Período de Referência para Cálculos de DEPs e KPIs
 *
 * Este módulo implementa o filtro de período de referência para corrigir
 * o viés de seleção nos dados históricos.
 *
 * PROBLEMA: Apenas ~30% dos animais de cada geração permanecem no plantel.
 * Touros promissores e bezerros de alto valor vendidos não estão nos dados,
 * fazendo com que vacas que produziram bons animais apareçam com progênie
 * "pior" do que realmente foi.
 *
 * SOLUÇÃO: Calcular DEPs e KPIs apenas com animais nascidos a partir de
 * 01/01/2025, onde o plantel está mais completo.
 *
 * IMPORTANTE:
 * - Genealogia e Progênie NÃO são filtradas (mostram histórico completo)
 * - Apenas DEPs, KPIs e Análises Comparativas usam o período de referência
 */

import { Animal } from '../types';

// ============================================
// CONSTANTE: DATA DE REFERÊNCIA
// ============================================

/**
 * Data de início do período de referência para cálculos.
 * Animais nascidos ANTES dessa data são excluídos dos cálculos de DEP e KPI.
 */
export const REFERENCE_PERIOD_START = new Date('2025-01-01T00:00:00');

/**
 * Formato da data para exibição na UI
 */
export const REFERENCE_PERIOD_DISPLAY = '01/01/2025';

// ============================================
// HELPERS
// ============================================

/**
 * Verifica se um animal está dentro do período de referência
 * (nascido em ou após 01/01/2025)
 *
 * @param animal - Animal a ser verificado
 * @returns true se o animal nasceu dentro do período de referência
 */
export const isInReferencePeriod = (animal: Animal): boolean => {
  if (!animal.dataNascimento) return false;
  const birthDate = new Date(animal.dataNascimento);
  return birthDate >= REFERENCE_PERIOD_START;
};

/**
 * Filtra uma lista de animais pelo período de referência
 *
 * @param animals - Lista de animais a filtrar
 * @returns Apenas animais nascidos dentro do período de referência
 */
export const filterByReferencePeriod = (animals: Animal[]): Animal[] => {
  return animals.filter(isInReferencePeriod);
};

/**
 * Calcula estatísticas do período de referência
 * OTIMIZADO: Usa reduce para contar em uma única passagem
 *
 * @param animals - Lista completa de animais
 * @returns Estatísticas de quantos animais estão dentro/fora do período
 */
export const getReferencePeriodStats = (animals: Animal[]): {
  total: number;
  inPeriod: number;
  excluded: number;
  percentInPeriod: number;
} => {
  const total = animals.length;
  // Conta em uma única passagem
  const inPeriod = animals.reduce((count, animal) => {
    return count + (isInReferencePeriod(animal) ? 1 : 0);
  }, 0);
  const excluded = total - inPeriod;
  const percentInPeriod = total > 0 ? Math.round((inPeriod / total) * 100) : 0;

  return {
    total,
    inPeriod,
    excluded,
    percentInPeriod,
  };
};
