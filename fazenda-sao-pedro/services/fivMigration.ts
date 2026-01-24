// ============================================
// MIGRAÇÃO FIV - CORRIGIR GENEALOGIA
// ============================================
// Este script corrige animais FIV que foram cadastrados
// com maeNome apontando para a receptora ao invés da doadora.
//
// A correção garante que:
// - maeNome = maeBiologicaNome (doadora - mãe genética)
// - maeId = maeBiologicaId
// - maeReceptoraNome e maeReceptoraId continuam intactos
//
// Isso faz a genealogia exibir a mãe biológica corretamente.

import { Animal, Sexo } from '../types';

export interface FIVMigrationResult {
  totalAnimals: number;
  fivAnimals: number;
  animalsNeedingFix: number;
  fixedAnimals: Animal[];
  errors: string[];
}

/**
 * Analisa os animais e identifica quais FIVs precisam de correção
 */
export const analyzeFIVAnimals = (animals: Animal[]): {
  needsFix: Animal[];
  alreadyCorrect: Animal[];
  details: { id: string; brinco: string; issue: string }[];
} => {
  const needsFix: Animal[] = [];
  const alreadyCorrect: Animal[] = [];
  const details: { id: string; brinco: string; issue: string }[] = [];

  for (const animal of animals) {
    if (!animal.isFIV) continue;

    // Verifica se tem os campos necessários
    if (!animal.maeBiologicaNome) {
      details.push({
        id: animal.id,
        brinco: animal.brinco,
        issue: 'FIV sem maeBiologicaNome definido'
      });
      continue;
    }

    // Verifica se maeNome está correto (deve ser igual a maeBiologicaNome)
    const maeNomeNormalizado = (animal.maeNome || '').toLowerCase().trim();
    const maeBiologicaNormalizada = animal.maeBiologicaNome.toLowerCase().trim();
    const maeReceptoraNormalizada = (animal.maeReceptoraNome || '').toLowerCase().trim();

    if (maeNomeNormalizado === maeBiologicaNormalizada) {
      // Já está correto
      alreadyCorrect.push(animal);
    } else if (maeNomeNormalizado === maeReceptoraNormalizada) {
      // maeNome está apontando para receptora - PRECISA CORRIGIR
      needsFix.push(animal);
      details.push({
        id: animal.id,
        brinco: animal.brinco,
        issue: `maeNome="${animal.maeNome}" deveria ser "${animal.maeBiologicaNome}" (doadora)`
      });
    } else if (!animal.maeNome) {
      // maeNome vazio - PRECISA CORRIGIR
      needsFix.push(animal);
      details.push({
        id: animal.id,
        brinco: animal.brinco,
        issue: `maeNome vazio, deveria ser "${animal.maeBiologicaNome}" (doadora)`
      });
    } else {
      // maeNome tem um valor diferente - situação ambígua
      details.push({
        id: animal.id,
        brinco: animal.brinco,
        issue: `maeNome="${animal.maeNome}" diferente de doadora="${animal.maeBiologicaNome}" e receptora="${animal.maeReceptoraNome}"`
      });
    }
  }

  return { needsFix, alreadyCorrect, details };
};

/**
 * Prepara as correções para os animais FIV
 * Retorna os dados atualizados (não salva diretamente)
 */
export const prepareFIVFixes = (
  animalsToFix: Animal[],
  allAnimals: Animal[]
): { animalId: string; updates: Partial<Animal> }[] => {
  const fixes: { animalId: string; updates: Partial<Animal> }[] = [];

  for (const animal of animalsToFix) {
    if (!animal.maeBiologicaNome) continue;

    // Busca a doadora no rebanho para pegar ID e raça
    const donor = allAnimals.find(
      a => a.brinco.toLowerCase().trim() === animal.maeBiologicaNome!.toLowerCase().trim() &&
           a.sexo === Sexo.Femea
    );

    const updates: Partial<Animal> = {
      // Corrige maeNome para apontar para a doadora
      maeNome: animal.maeBiologicaNome,
    };

    // Se encontrou a doadora, atualiza também os IDs
    if (donor) {
      updates.maeId = donor.id;
      updates.maeBiologicaId = donor.id;
      updates.maeRaca = donor.raca;
    }

    // Se tem receptora e ainda não tem o ID, tenta buscar
    if (animal.maeReceptoraNome && !animal.maeReceptoraId) {
      const recipient = allAnimals.find(
        a => a.brinco.toLowerCase().trim() === animal.maeReceptoraNome!.toLowerCase().trim() &&
             a.sexo === Sexo.Femea
      );
      if (recipient) {
        updates.maeReceptoraId = recipient.id;
      }
    }

    fixes.push({
      animalId: animal.id,
      updates
    });
  }

  return fixes;
};

/**
 * Gera um relatório de migração para exibir ao usuário
 */
export const generateMigrationReport = (
  animals: Animal[]
): string => {
  const fivAnimals = animals.filter(a => a.isFIV);
  const { needsFix, alreadyCorrect, details } = analyzeFIVAnimals(animals);

  let report = `
╔════════════════════════════════════════════════════╗
║         RELATÓRIO DE MIGRAÇÃO FIV                  ║
╠════════════════════════════════════════════════════╣
║ Total de animais no rebanho: ${animals.length.toString().padEnd(20)}║
║ Animais FIV: ${fivAnimals.length.toString().padEnd(36)}║
║ Já corretos: ${alreadyCorrect.length.toString().padEnd(36)}║
║ Precisam correção: ${needsFix.length.toString().padEnd(30)}║
╚════════════════════════════════════════════════════╝
`;

  if (needsFix.length > 0) {
    report += `\n📋 ANIMAIS QUE SERÃO CORRIGIDOS:\n`;
    report += `─────────────────────────────────────────────────────\n`;
    for (const animal of needsFix) {
      report += `• Brinco ${animal.brinco}: maeNome será alterado de "${animal.maeNome || '(vazio)'}" para "${animal.maeBiologicaNome}"\n`;
    }
  }

  if (details.length > 0) {
    report += `\n⚠️ DETALHES/AVISOS:\n`;
    report += `─────────────────────────────────────────────────────\n`;
    for (const detail of details) {
      report += `• [${detail.brinco}] ${detail.issue}\n`;
    }
  }

  return report;
};
