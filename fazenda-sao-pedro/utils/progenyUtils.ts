// ============================================
// UTILITÁRIO DE PROGÊNIE UNIFICADA
// ============================================
// Unifica a busca de progênie de três fontes:
// 1. historicoProgenie (registro manual)
// 2. maeNome (busca reversa)
// 3. maeId (busca reversa - mais confiável)

import { Animal, Sexo, WeighingType } from '../types';

export interface UnifiedProgenyRecord {
  id: string;
  brinco: string;
  nome?: string;
  birthWeightKg?: number;
  weaningWeightKg?: number;
  yearlingWeightKg?: number;
  source: 'manual' | 'maeNome' | 'maeId';
  animalId?: string; // ID do animal se existir no rebanho
}

/**
 * Obtém peso por tipo de pesagem
 */
const getWeightByType = (animal: Animal, type: WeighingType): number | undefined => {
  const pesagem = animal.historicoPesagens?.find((p) => p.type === type);
  return pesagem?.weightKg;
};

/**
 * Verifica se um animal é realmente filho deste animal
 * Usado para validar registros manuais obsoletos
 */
const isActualChild = (
  child: Animal,
  parent: Animal
): boolean => {
  const parentBrinco = parent.brinco.toLowerCase().trim();
  const parentNome = parent.nome?.toLowerCase().trim();
  const parentId = parent.id;

  // Verifica se o filho aponta para este pai por ID
  if (child.maeId === parentId || child.paiId === parentId) {
    return true;
  }

  // Verifica se o filho aponta para este pai por nome/brinco
  if (child.maeNome) {
    const maeNome = child.maeNome.toLowerCase().trim();
    if (maeNome === parentBrinco || (parentNome && maeNome === parentNome)) {
      return true;
    }
  }

  if (child.paiNome) {
    const paiNome = child.paiNome.toLowerCase().trim();
    if (paiNome === parentBrinco || (parentNome && paiNome === parentNome)) {
      return true;
    }
  }

  // FIV: verifica mãe biológica
  if (child.isFIV && child.maeBiologicaNome) {
    const maeBio = child.maeBiologicaNome.toLowerCase().trim();
    if (maeBio === parentBrinco || (parentNome && maeBio === parentNome)) {
      return true;
    }
  }

  return false;
};

/**
 * Obtém progênie unificada de um animal
 * Combina três fontes de dados para garantir que todos os filhos sejam exibidos
 *
 * IMPORTANTE: Registros manuais são VALIDADOS - se o filho cadastrado
 * não aponta mais para este animal como mãe/pai, o registro é ignorado.
 */
export const getUnifiedProgeny = (
  animal: Animal,
  allAnimals: Animal[]
): UnifiedProgenyRecord[] => {
  const progenyMap = new Map<string, UnifiedProgenyRecord>();

  // Fonte 1: historicoProgenie (registro manual) - COM VALIDAÇÃO
  if (animal.historicoProgenie) {
    for (const record of animal.historicoProgenie) {
      const key = record.offspringBrinco.toLowerCase().trim();

      // Tenta encontrar o animal no rebanho para pegar dados atualizados
      const offspringAnimal = allAnimals.find(
        (a) => a.brinco.toLowerCase().trim() === key
      );

      // VALIDAÇÃO: Se o animal existe no rebanho, verifica se ele ainda
      // aponta para este animal como mãe/pai. Se não aponta, IGNORA o registro.
      if (offspringAnimal && !isActualChild(offspringAnimal, animal)) {
        // O filho foi reatribuído a outro pai/mãe - ignora este registro obsoleto
        continue;
      }

      progenyMap.set(key, {
        id: record.id,
        brinco: record.offspringBrinco,
        nome: offspringAnimal?.nome,
        // Usa os pesos do animal se existir, senão usa os do registro manual
        birthWeightKg: offspringAnimal
          ? getWeightByType(offspringAnimal, WeighingType.Birth)
          : record.birthWeightKg,
        weaningWeightKg: offspringAnimal
          ? getWeightByType(offspringAnimal, WeighingType.Weaning)
          : record.weaningWeightKg,
        yearlingWeightKg: offspringAnimal
          ? getWeightByType(offspringAnimal, WeighingType.Yearling)
          : record.yearlingWeightKg,
        source: 'manual',
        animalId: offspringAnimal?.id,
      });
    }
  }

  // Para fêmeas: busca filhos por maeNome e maeId
  if (animal.sexo === Sexo.Femea) {
    const animalNames = [
      animal.nome?.toLowerCase().trim(),
      animal.brinco.toLowerCase().trim(),
    ].filter(Boolean) as string[];

    for (const childAnimal of allAnimals) {
      const childKey = childAnimal.brinco.toLowerCase().trim();

      // Já foi adicionado pelo historicoProgenie?
      if (progenyMap.has(childKey)) continue;

      // Fonte 2: Busca por maeNome
      if (childAnimal.maeNome) {
        const maeNome = childAnimal.maeNome.toLowerCase().trim();
        if (animalNames.includes(maeNome)) {
          progenyMap.set(childKey, {
            id: `auto-${childAnimal.id}`,
            brinco: childAnimal.brinco,
            nome: childAnimal.nome,
            birthWeightKg: getWeightByType(childAnimal, WeighingType.Birth),
            weaningWeightKg: getWeightByType(childAnimal, WeighingType.Weaning),
            yearlingWeightKg: getWeightByType(childAnimal, WeighingType.Yearling),
            source: 'maeNome',
            animalId: childAnimal.id,
          });
          continue;
        }
      }

      // Fonte 3: Busca por maeId (mais confiável)
      if (childAnimal.maeId && childAnimal.maeId === animal.id) {
        progenyMap.set(childKey, {
          id: `auto-${childAnimal.id}`,
          brinco: childAnimal.brinco,
          nome: childAnimal.nome,
          birthWeightKg: getWeightByType(childAnimal, WeighingType.Birth),
          weaningWeightKg: getWeightByType(childAnimal, WeighingType.Weaning),
          yearlingWeightKg: getWeightByType(childAnimal, WeighingType.Yearling),
          source: 'maeId',
          animalId: childAnimal.id,
        });
      }
    }
  }

  // Para machos: busca filhos por paiNome e paiId
  if (animal.sexo === Sexo.Macho) {
    const animalNames = [
      animal.nome?.toLowerCase().trim(),
      animal.brinco.toLowerCase().trim(),
    ].filter(Boolean) as string[];

    for (const childAnimal of allAnimals) {
      const childKey = childAnimal.brinco.toLowerCase().trim();

      // Já foi adicionado pelo historicoProgenie?
      if (progenyMap.has(childKey)) continue;

      // Busca por paiNome
      if (childAnimal.paiNome) {
        const paiNome = childAnimal.paiNome.toLowerCase().trim();
        if (animalNames.includes(paiNome)) {
          progenyMap.set(childKey, {
            id: `auto-${childAnimal.id}`,
            brinco: childAnimal.brinco,
            nome: childAnimal.nome,
            birthWeightKg: getWeightByType(childAnimal, WeighingType.Birth),
            weaningWeightKg: getWeightByType(childAnimal, WeighingType.Weaning),
            yearlingWeightKg: getWeightByType(childAnimal, WeighingType.Yearling),
            source: 'maeNome', // usando mesmo source para simplificar
            animalId: childAnimal.id,
          });
          continue;
        }
      }

      // Busca por paiId
      if (childAnimal.paiId && childAnimal.paiId === animal.id) {
        progenyMap.set(childKey, {
          id: `auto-${childAnimal.id}`,
          brinco: childAnimal.brinco,
          nome: childAnimal.nome,
          birthWeightKg: getWeightByType(childAnimal, WeighingType.Birth),
          weaningWeightKg: getWeightByType(childAnimal, WeighingType.Weaning),
          yearlingWeightKg: getWeightByType(childAnimal, WeighingType.Yearling),
          source: 'maeId', // usando mesmo source para simplificar
          animalId: childAnimal.id,
        });
      }
    }
  }

  return Array.from(progenyMap.values());
};

/**
 * Calcula estatísticas de progênie
 */
export const calculateProgenyStats = (progeny: UnifiedProgenyRecord[]) => {
  const withBirth = progeny.filter((p) => p.birthWeightKg != null);
  const withWeaning = progeny.filter((p) => p.weaningWeightKg != null);
  const withYearling = progeny.filter((p) => p.yearlingWeightKg != null);

  const mean = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return {
    total: progeny.length,
    avgBirthWeight: mean(withBirth.map((p) => p.birthWeightKg!)),
    avgWeaningWeight: mean(withWeaning.map((p) => p.weaningWeightKg!)),
    avgYearlingWeight: mean(withYearling.map((p) => p.yearlingWeightKg!)),
    countWithBirth: withBirth.length,
    countWithWeaning: withWeaning.length,
    countWithYearling: withYearling.length,
  };
};
