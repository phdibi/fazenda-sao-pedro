import { useState, useCallback, useMemo } from 'react';
import { useFarmData } from '../contexts/FarmContext';
import { recoverLostBirthDates, RecoveryStats } from '../services/recoveryService';
import { WeighingType } from '../types';

// Range típico de peso ao nascer (em kg) para bovinos
const BIRTH_WEIGHT_MIN = 20;
const BIRTH_WEIGHT_MAX = 55;

export const useBirthDateRecovery = () => {
  const { firestore } = useFarmData();
  const { state, updateAnimal } = firestore;

  const [isRecovering, setIsRecovering] = useState(false);
  const [stats, setStats] = useState<RecoveryStats | null>(null);

  // Computed property to check if there are potential candidates for display
  // Agora considera QUALQUER animal sem data de nascimento que tenha peso ao nascimento
  // OU que tenha um peso antigo na faixa de peso ao nascimento
  const eligibleCount = useMemo(() => {
    return state.animals.filter(a => {
      if (a.dataNascimento) return false; // Já tem data, não precisa recuperar
      if (!a.historicoPesagens || a.historicoPesagens.length === 0) return false;

      // Estratégia 1: Tem peso explicitamente marcado como "Nascimento"
      const hasExplicitBirthWeight = a.historicoPesagens.some(w => w.type === WeighingType.Birth);
      if (hasExplicitBirthWeight) return true;

      // Estratégia 2: Peso mais antigo está na faixa de peso ao nascimento
      const sortedWeights = [...a.historicoPesagens].sort(
        (x, y) => new Date(x.date).getTime() - new Date(y.date).getTime()
      );
      const oldestWeight = sortedWeights[0];
      if (oldestWeight && oldestWeight.weightKg >= BIRTH_WEIGHT_MIN && oldestWeight.weightKg <= BIRTH_WEIGHT_MAX) {
        return true;
      }

      return false;
    }).length;
  }, [state.animals]);

  // Contagem de animais sem data de nascimento (total)
  const totalMissingDates = useMemo(() => {
    return state.animals.filter(a => !a.dataNascimento).length;
  }, [state.animals]);

  const runRecovery = useCallback(async () => {
    const message = eligibleCount > 0
      ? `Encontrados ${eligibleCount} animais com potencial para recuperação (de ${totalMissingDates} sem data de nascimento).\n\nDeseja tentar recuperar as datas usando:\n1. Data do "Peso ao Nascimento" (se existir)\n2. Data do peso mais antigo (se estiver na faixa 20-55kg)`
      : `Não encontramos animais com dados suficientes para recuperação automática.\n\n${totalMissingDates} animais estão sem data de nascimento.`;

    if (confirm(message)) {
      setIsRecovering(true);
      setStats(null);
      try {
        const result = await recoverLostBirthDates(state.animals, updateAnimal);
        setStats(result);
        if (result.recovered > 0) {
          alert(`✅ Recuperação concluída!\n\n${result.recovered} datas restauradas.\n${result.skippedSuspicious} ignorados por inconsistência.\n${result.errors.length} erros.`);
        } else if (result.foundMissing > 0) {
          alert(`ℹ️ Recuperação finalizada.\n\n${result.foundMissing} animais sem data foram encontrados, mas nenhum tinha dados suficientes para recuperação automática.\n${result.skippedSuspicious} foram ignorados por terem dados inconsistentes.`);
        } else {
          alert('✅ Todos os animais já têm data de nascimento!');
        }
      } catch (error) {
        console.error('Recovery failed:', error);
        alert('❌ Falha ao executar recuperação.');
      } finally {
        setIsRecovering(false);
      }
    }
  }, [state.animals, updateAnimal, eligibleCount, totalMissingDates]);

  return {
    runRecovery,
    isRecovering,
    stats,
    eligibleCount,
    totalMissingDates
  };
};
