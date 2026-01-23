/**
 * Migrações de Dados
 *
 * Este arquivo contém funções para migrar dados existentes no Firestore
 * para corrigir inconsistências ou atualizar estruturas.
 */

import { Animal, WeighingType, WeightEntry } from '../types';

/**
 * Identifica animais que precisam de migração de peso de nascimento.
 *
 * Animais elegíveis:
 * - Têm data de nascimento definida
 * - Têm pelo menos uma pesagem com type undefined, 'Nenhum', ou sem type
 * - A pesagem foi feita na mesma data (ou próxima) da data de nascimento
 * - Não possuem ainda uma pesagem com type 'Nascimento'
 *
 * @param animals Lista de animais a verificar
 * @returns Lista de animais que precisam de migração com os dados necessários
 */
export const identifyBirthWeightMigrations = (animals: Animal[]): {
  animal: Animal;
  weightEntryToUpdate: WeightEntry;
  reason: string;
}[] => {
  const migrations: {
    animal: Animal;
    weightEntryToUpdate: WeightEntry;
    reason: string;
  }[] = [];

  for (const animal of animals) {
    // Pula se não tem data de nascimento
    if (!animal.dataNascimento) continue;

    // Pula se não tem histórico de pesagens
    if (!animal.historicoPesagens || animal.historicoPesagens.length === 0) continue;

    // Verifica se já tem uma pesagem de nascimento
    const hasBirthWeight = animal.historicoPesagens.some(
      p => p.type === WeighingType.Birth
    );
    if (hasBirthWeight) continue;

    // Procura por pesagens sem tipo (ou com tipo 'Nenhum') que possam ser de nascimento
    const birthDate = new Date(animal.dataNascimento);

    for (const pesagem of animal.historicoPesagens) {
      // Verifica se é uma pesagem sem tipo definido ou com tipo 'Nenhum'
      const isUntypedOrNone = !pesagem.type || pesagem.type === WeighingType.None;
      if (!isUntypedOrNone) continue;

      // Verifica se a data da pesagem é próxima da data de nascimento (até 7 dias)
      const pesagemDate = new Date(pesagem.date);
      const diffDays = Math.abs(
        (pesagemDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Se a pesagem foi feita até 7 dias após o nascimento, provavelmente é peso de nascimento
      if (diffDays <= 7) {
        migrations.push({
          animal,
          weightEntryToUpdate: pesagem,
          reason: `Pesagem de ${pesagem.weightKg}kg feita ${diffDays.toFixed(0)} dias após nascimento`,
        });
        break; // Só migra a primeira pesagem elegível
      }
    }
  }

  return migrations;
};

/**
 * Prepara os dados de atualização para migrar peso de nascimento.
 *
 * @param animal Animal a ser atualizado
 * @param weightEntryId ID da entrada de peso a ser atualizada
 * @returns Objeto com o historicoPesagens atualizado
 */
export const prepareBirthWeightMigration = (
  animal: Animal,
  weightEntryId: string
): { historicoPesagens: WeightEntry[] } => {
  const updatedPesagens = animal.historicoPesagens.map(p => {
    if (p.id === weightEntryId) {
      return {
        ...p,
        type: WeighingType.Birth,
      };
    }
    return p;
  });

  return { historicoPesagens: updatedPesagens };
};

/**
 * Gera um relatório de migração para preview.
 */
export const generateMigrationReport = (animals: Animal[]): {
  total: number;
  eligible: number;
  details: {
    brinco: string;
    nome?: string;
    peso: number;
    dataNascimento: string;
    dataPesagem: string;
    reason: string;
  }[];
} => {
  const migrations = identifyBirthWeightMigrations(animals);

  return {
    total: animals.length,
    eligible: migrations.length,
    details: migrations.map(m => ({
      brinco: m.animal.brinco,
      nome: m.animal.nome,
      peso: m.weightEntryToUpdate.weightKg,
      dataNascimento: new Date(m.animal.dataNascimento!).toLocaleDateString('pt-BR'),
      dataPesagem: new Date(m.weightEntryToUpdate.date).toLocaleDateString('pt-BR'),
      reason: m.reason,
    })),
  };
};
