/**
 * Hook para Migração de Peso de Nascimento
 *
 * Permite identificar e migrar animais que têm peso inicial cadastrado
 * mas sem o tipo WeighingType.Birth definido.
 */

import { useState, useCallback, useMemo } from 'react';
import { useFarmData } from '../contexts/FarmContext';
import {
  identifyBirthWeightMigrations,
  prepareBirthWeightMigration,
  generateMigrationReport,
} from '../utils/migrations';

export interface MigrationStatus {
  isRunning: boolean;
  progress: number;
  total: number;
  completed: number;
  errors: string[];
  lastRun?: Date;
  successCount?: number; // Quantos foram migrados com sucesso na última execução
}

export const useBirthWeightMigration = () => {
  const { firestore } = useFarmData();
  const { state, updateAnimal } = firestore;

  const [status, setStatus] = useState<MigrationStatus>({
    isRunning: false,
    progress: 0,
    total: 0,
    completed: 0,
    errors: [],
  });

  // Gera relatório de preview sem executar migração
  const previewMigration = useMemo(() => {
    return generateMigrationReport(state.animals);
  }, [state.animals]);

  // Executa a migração
  const runMigration = useCallback(async () => {
    const migrations = identifyBirthWeightMigrations(state.animals);

    if (migrations.length === 0) {
      console.log('✅ Nenhum animal precisa de migração de peso de nascimento');
      return { success: true, migrated: 0, errors: [] };
    }

    setStatus({
      isRunning: true,
      progress: 0,
      total: migrations.length,
      completed: 0,
      errors: [],
    });

    const errors: string[] = [];
    let completed = 0;

    console.log(`🔄 Iniciando migração de ${migrations.length} animais...`);

    for (const migration of migrations) {
      try {
        const { animal, weightEntryToUpdate } = migration;
        const updateData = prepareBirthWeightMigration(animal, weightEntryToUpdate.id);

        await updateAnimal(animal.id, updateData);

        completed++;
        setStatus(prev => ({
          ...prev,
          completed,
          progress: Math.round((completed / migrations.length) * 100),
        }));

        console.log(
          `✅ [${completed}/${migrations.length}] Animal ${animal.brinco} atualizado - Peso ${weightEntryToUpdate.weightKg}kg → Nascimento`
        );
      } catch (error) {
        const errorMsg = `Erro ao migrar animal ${migration.animal.brinco}: ${error}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    setStatus(prev => ({
      ...prev,
      isRunning: false,
      errors,
      lastRun: new Date(),
      successCount: completed,
    }));

    console.log(`\n📊 Migração concluída: ${completed} sucesso, ${errors.length} erros`);

    return {
      success: errors.length === 0,
      migrated: completed,
      errors,
    };
  }, [state.animals, updateAnimal]);

  // Reseta o status
  const resetStatus = useCallback(() => {
    setStatus({
      isRunning: false,
      progress: 0,
      total: 0,
      completed: 0,
      errors: [],
    });
  }, []);

  return {
    // Preview da migração (quantos animais serão afetados)
    preview: previewMigration,
    // Status atual da migração
    status,
    // Executa a migração
    runMigration,
    // Reseta o status
    resetStatus,
    // Atalhos
    hasPendingMigrations: previewMigration.eligible > 0,
    eligibleCount: previewMigration.eligible,
  };
};
