import { useState, useCallback, useMemo } from 'react';
import { useFarmData } from '../contexts/FarmContext';
import { recoverLostBirthDates, RecoveryStats } from '../services/recoveryService';
import { WeighingType } from '../types';

export const useBirthDateRecovery = () => {
  const { firestore } = useFarmData();
  const { state, updateAnimal } = firestore;

  const [isRecovering, setIsRecovering] = useState(false);
  const [stats, setStats] = useState<RecoveryStats | null>(null);

  // Computed property to check if there are potential candidates for display
  const eligibleCount = useMemo(() => {
    return state.animals.filter(a =>
      !a.dataNascimento &&
      a.historicoPesagens?.some(w => w.type === WeighingType.Birth)
    ).length;
  }, [state.animals]);

  const runRecovery = useCallback(async () => {
    if (confirm(`Deseja tentar recuperar datas de nascimento para ${eligibleCount} animais?\n\nIsso usará a data do registro de "Peso ao Nascimento" caso exista e seja consistente.`)) {
        setIsRecovering(true);
        setStats(null);
        try {
        const result = await recoverLostBirthDates(state.animals, updateAnimal);
        setStats(result);
        if (result.recovered > 0) {
            alert(`✅ Recuperação concluída!\n\n${result.recovered} datas restauradas.\n${result.skippedSuspicious} ignorados por inconsistência.`);
        } else {
            alert('ℹ️ Recuperação finalizada. Nenhuma data pôde ser restaurada automaticamente.');
        }
        } catch (error) {
        console.error('Recovery failed:', error);
        alert('❌ Falha ao executar recuperação.');
        } finally {
        setIsRecovering(false);
        }
    }
  }, [state.animals, updateAnimal, eligibleCount]);

  return {
    runRecovery,
    isRecovering,
    stats,
    eligibleCount
  };
};
