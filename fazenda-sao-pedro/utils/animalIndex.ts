import { Animal } from '../types';

/**
 * Índice pré-computado de animais para lookups O(1).
 * Substitui múltiplas chamadas de animals.find() que são O(n).
 */
export interface AnimalIndex {
  byId: Map<string, Animal>;
  byMotherId: Map<string, Animal[]>;
  byMotherBrinco: Map<string, Animal[]>;
  byReceptoraId: Map<string, Animal[]>;
  byReceptoraBrinco: Map<string, Animal[]>;
}

/**
 * Constrói índices de animais em uma única iteração O(n).
 * Usado para substituir buscas O(n) repetidas por lookups O(1).
 */
export const buildAnimalIndex = (animals: Animal[]): AnimalIndex => {
  const byId = new Map<string, Animal>();
  const byMotherId = new Map<string, Animal[]>();
  const byMotherBrinco = new Map<string, Animal[]>();
  const byReceptoraId = new Map<string, Animal[]>();
  const byReceptoraBrinco = new Map<string, Animal[]>();

  for (const animal of animals) {
    byId.set(animal.id, animal);

    if (animal.maeId) {
      const existing = byMotherId.get(animal.maeId);
      if (existing) existing.push(animal);
      else byMotherId.set(animal.maeId, [animal]);
    }

    if (animal.maeNome) {
      const key = animal.maeNome.toLowerCase().trim();
      const existing = byMotherBrinco.get(key);
      if (existing) existing.push(animal);
      else byMotherBrinco.set(key, [animal]);
    }

    if (animal.maeReceptoraId) {
      const existing = byReceptoraId.get(animal.maeReceptoraId);
      if (existing) existing.push(animal);
      else byReceptoraId.set(animal.maeReceptoraId, [animal]);
    }

    if (animal.maeReceptoraNome) {
      const key = animal.maeReceptoraNome.toLowerCase().trim();
      const existing = byReceptoraBrinco.get(key);
      if (existing) existing.push(animal);
      else byReceptoraBrinco.set(key, [animal]);
    }
  }

  return { byId, byMotherId, byMotherBrinco, byReceptoraId, byReceptoraBrinco };
};
