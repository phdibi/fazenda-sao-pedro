/**
 * Utilitario para migracao de registros de medicamentos
 *
 * Converte registros legados (um medicamento por registro) para o novo formato
 * (multiplos medicamentos por tratamento), agrupando por data e motivo.
 */

import { MedicationAdministration, MedicationItem } from '../types';

/**
 * Normaliza uma data para comparacao (remove hora/minuto/segundo)
 */
const normalizeDate = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

/**
 * Normaliza um motivo para comparacao (lowercase, trim)
 */
const normalizeMotivo = (motivo: string): string => {
  return motivo.toLowerCase().trim();
};

/**
 * Gera uma chave unica para agrupar tratamentos (data + motivo)
 */
const generateGroupKey = (record: MedicationAdministration): string => {
  const dateKey = normalizeDate(record.dataAplicacao);
  const motivoKey = normalizeMotivo(record.motivo || '');
  return `${dateKey}__${motivoKey}`;
};

/**
 * Verifica se um registro esta no formato legado (sem medicamentos[])
 */
const isLegacyRecord = (record: MedicationAdministration): boolean => {
  // E legado se nao tem medicamentos[] ou esta vazio, mas tem medicamento (singular)
  const hasLegacyFields = Boolean(record.medicamento);
  const hasNewFormat = record.medicamentos && Array.isArray(record.medicamentos) && record.medicamentos.length > 0;
  return hasLegacyFields && !hasNewFormat;
};

/**
 * Converte um registro legado para o novo formato
 */
const convertLegacyToNew = (record: MedicationAdministration): MedicationAdministration => {
  if (!isLegacyRecord(record)) return record;

  const medicamentos: MedicationItem[] = [{
    medicamento: record.medicamento || '',
    dose: record.dose || 0,
    unidade: record.unidade || 'ml',
  }];

  return {
    ...record,
    medicamentos,
  };
};

/**
 * Mescla multiplos registros do mesmo dia/motivo em um unico registro
 */
const mergeRecords = (records: MedicationAdministration[]): MedicationAdministration => {
  if (records.length === 0) {
    throw new Error('Nao e possivel mesclar lista vazia de registros');
  }

  if (records.length === 1) {
    return convertLegacyToNew(records[0]);
  }

  // Usa o primeiro registro como base
  const baseRecord = records[0];

  // Coleta todos os medicamentos de todos os registros
  const allMedicamentos: MedicationItem[] = [];
  const seenMedicamentos = new Set<string>(); // Para evitar duplicatas

  for (const record of records) {
    // Verifica medicamentos[] (novo formato)
    if (record.medicamentos && Array.isArray(record.medicamentos)) {
      for (const med of record.medicamentos) {
        const key = `${med.medicamento}__${med.dose}__${med.unidade}`;
        if (!seenMedicamentos.has(key)) {
          seenMedicamentos.add(key);
          allMedicamentos.push(med);
        }
      }
    }
    // Verifica formato legado
    else if (record.medicamento) {
      const key = `${record.medicamento}__${record.dose}__${record.unidade}`;
      if (!seenMedicamentos.has(key)) {
        seenMedicamentos.add(key);
        allMedicamentos.push({
          medicamento: record.medicamento,
          dose: record.dose || 0,
          unidade: record.unidade || 'ml',
        });
      }
    }
  }

  // Retorna registro mesclado
  return {
    id: baseRecord.id, // Mantem o ID do primeiro registro
    medicamentos: allMedicamentos,
    dataAplicacao: baseRecord.dataAplicacao,
    motivo: baseRecord.motivo,
    responsavel: baseRecord.responsavel || records.find(r => r.responsavel)?.responsavel || 'Equipe Campo',
    // Campos legados para compatibilidade (usa o primeiro medicamento)
    medicamento: allMedicamentos[0]?.medicamento,
    dose: allMedicamentos[0]?.dose,
    unidade: allMedicamentos[0]?.unidade,
  };
};

/**
 * Migra o historico sanitario de um animal para o novo formato
 * Agrupa registros do mesmo dia/motivo em um unico tratamento
 *
 * @param historicoSanitario - Array de registros de medicamentos
 * @returns Array migrado com registros agrupados
 */
export const migrateHealthHistory = (
  historicoSanitario: MedicationAdministration[]
): MedicationAdministration[] => {
  if (!historicoSanitario || historicoSanitario.length === 0) {
    return [];
  }

  // Agrupa registros por data + motivo
  const groups = new Map<string, MedicationAdministration[]>();

  for (const record of historicoSanitario) {
    const key = generateGroupKey(record);
    const existing = groups.get(key) || [];
    existing.push(record);
    groups.set(key, existing);
  }

  // Mescla cada grupo em um unico registro
  const migratedRecords: MedicationAdministration[] = [];

  for (const [, records] of groups) {
    migratedRecords.push(mergeRecords(records));
  }

  // Ordena por data
  migratedRecords.sort((a, b) =>
    new Date(a.dataAplicacao).getTime() - new Date(b.dataAplicacao).getTime()
  );

  return migratedRecords;
};

/**
 * Verifica se o historico precisa de migracao
 * Retorna true se houver registros legados ou registros que podem ser mesclados
 */
export const needsMigration = (historicoSanitario: MedicationAdministration[]): boolean => {
  if (!historicoSanitario || historicoSanitario.length === 0) {
    return false;
  }

  // Verifica se ha registros legados
  const hasLegacyRecords = historicoSanitario.some(isLegacyRecord);
  if (hasLegacyRecords) return true;

  // Verifica se ha registros que podem ser mesclados (mesmo dia/motivo)
  const groups = new Map<string, number>();
  for (const record of historicoSanitario) {
    const key = generateGroupKey(record);
    groups.set(key, (groups.get(key) || 0) + 1);
  }

  // Se algum grupo tem mais de 1 registro, precisa mesclar
  for (const count of groups.values()) {
    if (count > 1) return true;
  }

  return false;
};

/**
 * Relatorio de migracao
 */
export interface MigrationReport {
  originalCount: number;
  migratedCount: number;
  mergedGroups: number;
  legacyConverted: number;
}

/**
 * Migra e retorna um relatorio detalhado
 */
export const migrateWithReport = (
  historicoSanitario: MedicationAdministration[]
): { migrated: MedicationAdministration[]; report: MigrationReport } => {
  if (!historicoSanitario || historicoSanitario.length === 0) {
    return {
      migrated: [],
      report: {
        originalCount: 0,
        migratedCount: 0,
        mergedGroups: 0,
        legacyConverted: 0,
      },
    };
  }

  const originalCount = historicoSanitario.length;
  const legacyCount = historicoSanitario.filter(isLegacyRecord).length;

  const migrated = migrateHealthHistory(historicoSanitario);

  const mergedGroups = originalCount - migrated.length;

  return {
    migrated,
    report: {
      originalCount,
      migratedCount: migrated.length,
      mergedGroups,
      legacyConverted: legacyCount,
    },
  };
};
