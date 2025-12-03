import { Animal, WeightPrediction, Raca, Sexo } from '../types';
import { calcularGMDAnimal, calcularIdadeMeses } from '../utils/gmdCalculations';

// ============================================
// 🔮 PREVISÃO DE PESO
// ============================================

// Parâmetros médios por raça (kg/dia esperado)
const RACE_GMD_BENCHMARKS: Record<Raca, { min: number; avg: number; max: number }> = {
  [Raca.Hereford]: { min: 0.8, avg: 1.1, max: 1.4 },
  [Raca.Braford]: { min: 0.9, avg: 1.2, max: 1.5 },
  [Raca.HerefordPO]: { min: 0.85, avg: 1.15, max: 1.45 },
  [Raca.Outros]: { min: 0.7, avg: 1.0, max: 1.3 },
};

// Fator de ajuste por sexo
const SEX_FACTOR: Record<Sexo, number> = {
  [Sexo.Macho]: 1.1,  // Machos ganham ~10% mais
  [Sexo.Femea]: 0.95, // Fêmeas ganham ~5% menos
};

// Fator de ajuste por idade (meses) - curva de crescimento
const getAgeFactor = (idadeMeses: number): number => {
  if (idadeMeses <= 6) return 1.2;   // Bezerros crescem rápido
  if (idadeMeses <= 12) return 1.1;  // Desmame ainda bom
  if (idadeMeses <= 18) return 1.0;  // Novilhos normal
  if (idadeMeses <= 24) return 0.9;  // Começa a desacelerar
  if (idadeMeses <= 36) return 0.75; // Adulto jovem
  return 0.5; // Adulto - ganho mínimo
};

/**
 * Prevê peso futuro baseado no histórico do animal
 */
export const predictWeight = (
  animal: Animal,
  targetDate: Date
): WeightPrediction => {
  const hoje = new Date();
  const diasFuturos = Math.ceil(
    (targetDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diasFuturos <= 0) {
    return {
      animalId: animal.id,
      currentWeight: animal.pesoKg,
      predictedWeight: animal.pesoKg,
      targetDate,
      confidence: 100,
      basedOnDays: 0,
      projectedGMD: 0,
    };
  }

  const gmdMetrics = calcularGMDAnimal(animal);
  const idadeMeses = calcularIdadeMeses(animal.dataNascimento);
  const raceBenchmark = RACE_GMD_BENCHMARKS[animal.raca] || RACE_GMD_BENCHMARKS[Raca.Outros];
  const sexFactor = SEX_FACTOR[animal.sexo];
  const ageFactor = getAgeFactor(idadeMeses);

  let projectedGMD: number;
  let confidence: number;

  // Se tem GMD histórico, usa como base principal
  if (gmdMetrics.gmdTotal && gmdMetrics.gmdTotal > 0 && gmdMetrics.diasAcompanhamento && gmdMetrics.diasAcompanhamento >= 30) {
    // Ajusta GMD histórico pelo fator de idade futura
    const idadeFutura = idadeMeses + Math.floor(diasFuturos / 30);
    const futureAgeFactor = getAgeFactor(idadeFutura);
    
    projectedGMD = gmdMetrics.gmdTotal * (futureAgeFactor / ageFactor);
    
    // Confiança baseada na quantidade de dados
    confidence = Math.min(90, 50 + gmdMetrics.diasAcompanhamento! / 3);
  } else {
    // Sem histórico, usa benchmark da raça
    projectedGMD = raceBenchmark.avg * sexFactor * ageFactor;
    confidence = 40; // Baixa confiança sem dados históricos
  }

  // Limita GMD aos valores razoáveis
  projectedGMD = Math.max(0.3, Math.min(2.0, projectedGMD));

  // Calcula peso previsto
  const predictedWeight = Math.round(
    animal.pesoKg + (projectedGMD * diasFuturos)
  );

  // Ajusta confiança baseada no horizonte de previsão
  if (diasFuturos > 180) confidence *= 0.7;
  else if (diasFuturos > 90) confidence *= 0.85;
  else if (diasFuturos > 30) confidence *= 0.95;

  return {
    animalId: animal.id,
    currentWeight: animal.pesoKg,
    predictedWeight: Math.max(animal.pesoKg, predictedWeight), // Nunca prever perda
    targetDate,
    confidence: Math.round(confidence),
    basedOnDays: gmdMetrics.diasAcompanhamento || 0,
    projectedGMD: Number(projectedGMD.toFixed(3)),
  };
};

/**
 * Prevê quando o animal atingirá um peso alvo
 */
export const predictDateForWeight = (
  animal: Animal,
  targetWeight: number
): { date: Date; confidence: number; daysNeeded: number } | null => {
  if (targetWeight <= animal.pesoKg) {
    return {
      date: new Date(),
      confidence: 100,
      daysNeeded: 0,
    };
  }

  const gmdMetrics = calcularGMDAnimal(animal);
  const idadeMeses = calcularIdadeMeses(animal.dataNascimento);
  const raceBenchmark = RACE_GMD_BENCHMARKS[animal.raca] || RACE_GMD_BENCHMARKS[Raca.Outros];
  const sexFactor = SEX_FACTOR[animal.sexo];
  const ageFactor = getAgeFactor(idadeMeses);

  let avgGMD: number;
  let confidence: number;

  if (gmdMetrics.gmdTotal && gmdMetrics.gmdTotal > 0) {
    avgGMD = gmdMetrics.gmdTotal * ageFactor;
    confidence = Math.min(85, 50 + (gmdMetrics.diasAcompanhamento || 0) / 3);
  } else {
    avgGMD = raceBenchmark.avg * sexFactor * ageFactor;
    confidence = 35;
  }

  if (avgGMD <= 0) return null;

  const kgNeeded = targetWeight - animal.pesoKg;
  const daysNeeded = Math.ceil(kgNeeded / avgGMD);

  // Limite razoável de 2 anos
  if (daysNeeded > 730) {
    return null; // Muito distante para prever
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysNeeded);

  return {
    date: targetDate,
    confidence: Math.round(confidence * (1 - daysNeeded / 1000)),
    daysNeeded,
  };
};

/**
 * Gera previsões para múltiplos animais
 */
export const batchPredictWeights = (
  animals: Animal[],
  targetDate: Date
): WeightPrediction[] => {
  return animals.map(animal => predictWeight(animal, targetDate));
};

/**
 * Prevê peso de abate (ex: 18 arrobas = 270kg carcaça ≈ 540kg vivo)
 */
export const predictSlaughterDate = (
  animal: Animal,
  targetArrobas: number = 18
): { date: Date; confidence: number; daysNeeded: number; currentArrobas: number } | null => {
  const targetWeight = targetArrobas * 30; // ~30kg por arroba (peso vivo)
  const currentArrobas = Number((animal.pesoKg / 30).toFixed(1));
  
  const prediction = predictDateForWeight(animal, targetWeight);
  
  if (!prediction) return null;
  
  return {
    ...prediction,
    currentArrobas,
  };
};

/**
 * Formata previsão para exibição
 */
export const formatPrediction = (prediction: WeightPrediction): string => {
  const diffKg = prediction.predictedWeight - prediction.currentWeight;
  const diasAte = Math.ceil(
    (prediction.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  return `Peso previsto: ${prediction.predictedWeight}kg (+${diffKg}kg em ${diasAte} dias) | Confiança: ${prediction.confidence}%`;
};
