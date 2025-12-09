/**
 * Utilitários gerais do sistema
 */

/**
 * Função debounced com método cancel
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

/**
 * Debounce: Executa a função apenas após N milissegundos de inatividade
 * Útil para otimizar buscas, filtros e inputs em tempo real
 * 
 * @param func - Função a ser executada
 * @param wait - Tempo de espera em milissegundos
 * @returns Função debounced com método cancel()
 * 
 * @example
 * const handleSearch = debounce((value: string) => {
 *   console.log('Buscando:', value);
 * }, 300);
 * 
 * // Cleanup no unmount:
 * useEffect(() => () => handleSearch.cancel(), []);
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
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