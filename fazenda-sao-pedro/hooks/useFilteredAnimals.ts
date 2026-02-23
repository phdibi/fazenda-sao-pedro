import { useMemo } from 'react';
import { Animal } from '../types';

/**
 * Hook reutilizável para filtrar animais por busca (brinco ou nome).
 * Substitui o padrão duplicado de filtragem encontrado em múltiplos componentes.
 */
export const useFilteredAnimals = (
  animals: Animal[],
  search: string,
  limit: number = 50
): Animal[] => {
  return useMemo(() => {
    if (!search.trim()) return animals.slice(0, limit);
    const s = search.toLowerCase();
    return animals.filter(
      (a) =>
        a.brinco.toLowerCase().includes(s) ||
        a.nome?.toLowerCase().includes(s)
    );
  }, [animals, search, limit]);
};
