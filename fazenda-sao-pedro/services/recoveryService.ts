import { Animal, WeighingType } from '../types';

export interface RecoveryStats {
  totalScanned: number;
  foundMissing: number;
  recoverable: number;
  recovered: number;
  skippedSuspicious: number;
  errors: string[];
}

// Birth weight range in kg (typical for cattle)
const BIRTH_WEIGHT_MIN = 20;
const BIRTH_WEIGHT_MAX = 55;

/**
 * Attempts to recover lost birth dates from weight history.
 * 
 * Strategy:
 * 1. First, look for weight entries with type WeighingType.Birth
 * 2. If not found, look for the oldest weight entry with a weight in birth range (20-55kg)
 * 3. Validate that no older records exist (would indicate suspicious data)
 */
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

      // Strategy 1: Look for a weight entry with type 'Birth' (Nascimento)
      let candidateEntry = animal.historicoPesagens?.find(w => w.type === WeighingType.Birth);
      let recoveryMethod = 'explicit_birth_type';

      // Strategy 2: If no explicit birth weight, look for oldest entry with birth-like weight
      if (!candidateEntry && animal.historicoPesagens && animal.historicoPesagens.length > 0) {
        // Sort by date ascending to find oldest
        const sortedWeights = [...animal.historicoPesagens].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Find oldest weight entry that looks like birth weight
        const oldestBirthLike = sortedWeights.find(w =>
          w.weightKg >= BIRTH_WEIGHT_MIN &&
          w.weightKg <= BIRTH_WEIGHT_MAX
        );

        if (oldestBirthLike && sortedWeights.indexOf(oldestBirthLike) === 0) {
          // Only use if it's actually the oldest entry
          candidateEntry = oldestBirthLike;
          recoveryMethod = 'oldest_birth_weight_range';
        }
      }

      if (candidateEntry && candidateEntry.date) {
        const candidateDate = new Date(candidateEntry.date);

        // Validation: Check if there are ANY records (weight or health) older than this candidate date
        // If so, this candidate date is likely a "buggy" date (e.g. defaulted to today)
        let isSuspicious = false;

        // Check other weights
        const olderWeight = animal.historicoPesagens?.find(w =>
          w.id !== candidateEntry!.id &&
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
          console.log(`🔧 [RECOVERY] Recovering birth date for ${animal.brinco}: ${candidateDate.toLocaleDateString()} (method: ${recoveryMethod})`);

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
