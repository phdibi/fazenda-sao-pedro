/**
 * Utilitários gerais do sistema
 */

/**
 * Debounce: Executa a função apenas após N milissegundos de inatividade
 * Útil para otimizar buscas, filtros e inputs em tempo real
 * 
 * @param func - Função a ser executada
 * @param wait - Tempo de espera em milissegundos
 * @returns Função debounced
 * 
 * @example
 * const handleSearch = debounce((value: string) => {
 *   console.log('Buscando:', value);
 * }, 300);
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Formata data para padrão brasileiro
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata número com separadores de milhar
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('pt-BR');
}
// utils/helpers.ts
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};