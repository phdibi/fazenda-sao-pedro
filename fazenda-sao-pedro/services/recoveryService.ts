import { Animal, WeighingType } from '../types';

export interface RecoveryStats {
  totalScanned: number;
  foundMissing: number;
  recoverable: number;
  recovered: number;
  skippedSuspicious: number;
  errors: string[];
}

export const recoverLostBirthDates = async (
  animals: Animal[],
  updateAnimal: (id: string, data: Partial<Animal>) => Promise<void>
): Promise<RecoveryStats> => {
  const stats: RecoveryStats = {
    totalScanned: 0,
    foundMissing: 0,
    recoverable: 0,
    recovered: 0,
    skippedSuspicious: 0,
    errors: []
  };

  console.log('🔄 [RECOVERY] Starting birth date recovery scan...');

  for (const animal of animals) {
    stats.totalScanned++;

    // Only interested in animals with MISSING birth date
    if (!animal.dataNascimento) {
      stats.foundMissing++;

      // 1. Look for a weight entry with type 'Birth' (Nascimento)
      const birthWeightEntry = animal.historicoPesagens?.find(w => w.type === WeighingType.Birth);

      if (birthWeightEntry && birthWeightEntry.date) {
        const candidateDate = new Date(birthWeightEntry.date);

        // Validation: Check if there are ANY records (weight or health) older than this candidate date
        // If so, this candidate date is likely a "buggy" date (e.g. defaulted to today)
        let isSuspicious = false;

        // Check other weights
        const olderWeight = animal.historicoPesagens?.find(w =>
          w.id !== birthWeightEntry.id &&
          new Date(w.date) < candidateDate
        );

        if (olderWeight) {
          isSuspicious = true;
          console.warn(`⚠️ [RECOVERY] Suspicious birth date for ${animal.brinco}: ${candidateDate.toISOString()}. Found older weight from ${olderWeight.date}`);
        }

        // Check health records
        if (!isSuspicious && animal.historicoSanitario) {
          const olderMedication = animal.historicoSanitario.find(m =>
            new Date(m.dataAplicacao) < candidateDate
          );
          if (olderMedication) {
            isSuspicious = true;
            console.warn(`⚠️ [RECOVERY] Suspicious birth date for ${animal.brinco}: ${candidateDate.toISOString()}. Found older medication from ${olderMedication.dataAplicacao}`);
          }
        }

        if (isSuspicious) {
          stats.skippedSuspicious++;
          continue;
        }

        // If we passed checks, we attempt to recover
        stats.recoverable++;

        try {
          console.log(`🔧 [RECOVERY] Recovering birth date for ${animal.brinco}: ${candidateDate.toLocaleDateString()}`);

          await updateAnimal(animal.id, {
            dataNascimento: candidateDate
          });

          stats.recovered++;
        } catch (err: any) {
          console.error(`❌ [RECOVERY] Failed to update ${animal.brinco}:`, err);
          stats.errors.push(`Animal ${animal.brinco}: ${err.message}`);
        }
      }
    }
  }

  console.log('✅ [RECOVERY] Scan complete.', stats);
  return stats;
};
