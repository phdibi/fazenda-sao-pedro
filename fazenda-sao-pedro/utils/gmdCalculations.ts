import { Animal, GainMetrics, WeightEntry, WeighingType } from '../types';

// ============================================
// 🧮 CÁLCULOS DE GMD (GANHO MÉDIO DIÁRIO)
// ============================================

/**
 * Calcula o GMD entre duas pesagens
 */
export const calcularGMDEntrePesagens = (
  pesoInicial: number,
  pesoFinal: number,
  dataInicial: Date,
  dataFinal: Date
): number => {
  const dias = Math.ceil(
    (new Date(dataFinal).getTime() - new Date(dataInicial).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (dias <= 0) return 0;
  return Number(((pesoFinal - pesoInicial) / dias).toFixed(3));
};

/**
 * Calcula todas as métricas de GMD a partir de um array de pesagens.
 * Versão pura que não depende do objeto Animal completo — pode ser chamada
 * diretamente do WeightTab ou de qualquer componente com acesso às pesagens.
 */
export const calcularGMDDePesagens = (pesagens: WeightEntry[]): GainMetrics => {
  if (pesagens.length < 2) {
    return {
      gmdTotal: 0,
      diasAcompanhamento: 0,
    };
  }

  // Ordena cronologicamente
  const sorted = [...pesagens].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const primeiro = sorted[0];
  const ultimo = sorted[sorted.length - 1];

  // GMD Total (primeira → última pesagem)
  const diasTotal = Math.ceil(
    (new Date(ultimo.date).getTime() - new Date(primeiro.date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const gmdTotal = diasTotal > 0
    ? Number(((ultimo.weightKg - primeiro.weightKg) / diasTotal).toFixed(3))
    : 0;

  // GMD Nascimento → Desmame
  const pesoNascimento = sorted.find(p => p.type === WeighingType.Birth);
  const pesoDesmame = sorted.find(p => p.type === WeighingType.Weaning);
  let gmdNascimentoDesmame: number | undefined;
  if (pesoNascimento && pesoDesmame) {
    gmdNascimentoDesmame = calcularGMDEntrePesagens(
      pesoNascimento.weightKg, pesoDesmame.weightKg,
      pesoNascimento.date, pesoDesmame.date
    );
  }

  // GMD Desmame → Sobreano
  const pesoSobreano = sorted.find(p => p.type === WeighingType.Yearling);
  let gmdDesmameSobreano: number | undefined;
  if (pesoDesmame && pesoSobreano) {
    gmdDesmameSobreano = calcularGMDEntrePesagens(
      pesoDesmame.weightKg, pesoSobreano.weightKg,
      pesoDesmame.date, pesoSobreano.date
    );
  }

  // GMD últimos 30 dias (apenas se houver 2 pesagens nesse janela)
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const pesagensRecentes = sorted.filter(p => new Date(p.date) >= trintaDiasAtras);
  let gmdUltimos30Dias: number | undefined;
  if (pesagensRecentes.length >= 2) {
    const primeiraRecente = pesagensRecentes[0];
    const ultimaRecente = pesagensRecentes[pesagensRecentes.length - 1];
    gmdUltimos30Dias = calcularGMDEntrePesagens(
      primeiraRecente.weightKg, ultimaRecente.weightKg,
      primeiraRecente.date, ultimaRecente.date
    );
  }

  // GMD do último período: entre as duas últimas pesagens registradas.
  // Reflete a fase de criação atual (recria, engorda, etc.) de forma mais
  // precisa do que o GMD total, que dilui a fase atual com toda a vida do animal.
  let gmdUltimoPeriodo: number | undefined;
  let diasUltimoPeriodo: number | undefined;
  if (sorted.length >= 2) {
    const penultimo = sorted[sorted.length - 2];
    diasUltimoPeriodo = Math.ceil(
      (new Date(ultimo.date).getTime() - new Date(penultimo.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diasUltimoPeriodo > 0) {
      gmdUltimoPeriodo = calcularGMDEntrePesagens(
        penultimo.weightKg, ultimo.weightKg,
        penultimo.date, ultimo.date
      );
    }
  }

  // Dias desde a última pesagem e peso estimado hoje.
  // O peso estimado usa gmdUltimoPeriodo (fase atual) com fallback para gmdTotal.
  const diasDesdeUltimaPesagem = Math.max(
    0,
    Math.floor((hoje.getTime() - new Date(ultimo.date).getTime()) / (1000 * 60 * 60 * 24))
  );
  const gmdParaEstimativa = gmdUltimoPeriodo ?? gmdTotal;
  const pesoEstimadoHoje = gmdParaEstimativa !== undefined
    ? Math.max(0, Number((ultimo.weightKg + gmdParaEstimativa * diasDesdeUltimaPesagem).toFixed(1)))
    : undefined;

  return {
    gmdTotal,
    gmdNascimentoDesmame,
    gmdDesmameSobreano,
    gmdUltimos30Dias,
    gmdUltimoPeriodo,
    diasUltimoPeriodo,
    diasAcompanhamento: diasTotal,
    pesoInicial: primeiro.weightKg,
    pesoFinal: ultimo.weightKg,
    diasDesdeUltimaPesagem,
    dataUltimaPesagem: new Date(ultimo.date),
    pesoEstimadoHoje,
  };
};

/**
 * Calcula todas as métricas de GMD de um animal.
 * Wrapper sobre calcularGMDDePesagens que lê o historicoPesagens do animal.
 */
export const calcularGMDAnimal = (animal: Animal): GainMetrics => {
  return calcularGMDDePesagens(animal.historicoPesagens || []);
};

/**
 * Calcula GMD médio de um grupo de animais
 */
export const calcularGMDMedio = (animals: Animal[]): number => {
  const gmds = animals
    .map(a => calcularGMDAnimal(a).gmdTotal)
    .filter((gmd): gmd is number => gmd !== undefined && gmd > 0);

  if (gmds.length === 0) return 0;
  return Number((gmds.reduce((sum, gmd) => sum + gmd, 0) / gmds.length).toFixed(3));
};

/**
 * Ranking de animais por GMD
 */
export const rankearPorGMD = (animals: Animal[]): Array<Animal & { gmd: GainMetrics; ranking: number }> => {
  const comGMD = animals
    .map(animal => ({
      ...animal,
      gmd: calcularGMDAnimal(animal),
    }))
    .filter(a => a.gmd.gmdTotal && a.gmd.gmdTotal > 0)
    .sort((a, b) => (b.gmd.gmdTotal || 0) - (a.gmd.gmdTotal || 0));

  return comGMD.map((animal, index) => ({
    ...animal,
    ranking: index + 1,
  }));
};

/**
 * Auto-classifica os tipos de pesagem Desmame e Sobreano com base na data de nascimento.
 *
 * Regras:
 * - Desmame: pesagem com idade mais próxima de 7 meses (aceita entre 5 e 9 meses)
 * - Sobreano: pesagem com idade mais próxima de 18 meses (aceita entre 12 e 23 meses)
 * - Sempre sobrescreve classificações manuais de Desmame/Sobreano
 * - Preserva tipos Nascimento e Peso de Virada
 * - Retorna cópia do array sem mutação
 */
export const autoClassifyWeightTypes = (
  pesagens: WeightEntry[],
  dataNascimento: Date | undefined
): WeightEntry[] => {
  if (!dataNascimento || pesagens.length === 0) return pesagens;

  const nascMs = new Date(dataNascimento).getTime();
  const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

  // Limpar tipos Desmame/Sobreano existentes, preservar Birth e Turn
  const cleaned = pesagens.map(p => {
    if (p.type === WeighingType.Weaning || p.type === WeighingType.Yearling) {
      return { ...p, type: WeighingType.None };
    }
    return { ...p };
  });

  // Calcular idade em meses para cada pesagem
  const withAge = cleaned.map(p => {
    const ageMonths = (new Date(p.date).getTime() - nascMs) / MS_PER_MONTH;
    return { entry: p, ageMonths };
  });

  // Desmame: mais próximo de 7 meses, entre 5 e 9 meses
  const desmameCandidates = withAge.filter(
    ({ ageMonths, entry }) =>
      ageMonths >= 5 && ageMonths <= 9 &&
      entry.type !== WeighingType.Birth && entry.type !== WeighingType.Turn
  );
  let bestDesmame: typeof desmameCandidates[0] | null = null;
  for (const c of desmameCandidates) {
    if (!bestDesmame || Math.abs(c.ageMonths - 7) < Math.abs(bestDesmame.ageMonths - 7)) {
      bestDesmame = c;
    }
  }
  if (bestDesmame) {
    bestDesmame.entry.type = WeighingType.Weaning;
  }

  // Sobreano: mais próximo de 18 meses, entre 12 e 23 meses
  const sobreanoCandidates = withAge.filter(
    ({ ageMonths, entry }) =>
      ageMonths >= 12 && ageMonths <= 23 &&
      entry.type !== WeighingType.Birth && entry.type !== WeighingType.Turn &&
      entry.type !== WeighingType.Weaning // Não reutilizar o que já foi marcado como Desmame
  );
  let bestSobreano: typeof sobreanoCandidates[0] | null = null;
  for (const c of sobreanoCandidates) {
    if (!bestSobreano || Math.abs(c.ageMonths - 18) < Math.abs(bestSobreano.ageMonths - 18)) {
      bestSobreano = c;
    }
  }
  if (bestSobreano) {
    bestSobreano.entry.type = WeighingType.Yearling;
  }

  return cleaned;
};

/**
 * Calcula idade em meses
 */
export const calcularIdadeMeses = (dataNascimento?: Date): number => {
  if (!dataNascimento) return 0;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  const diffMs = hoje.getTime() - nasc.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
};

/**
 * Formata GMD para exibição
 */
export const formatarGMD = (gmd: number | undefined): string => {
  if (gmd === undefined || gmd === null) return 'N/A';
  return `${gmd.toFixed(3)} kg/dia`;
};

/**
 * Classifica performance do GMD
 */
export const classificarGMD = (gmd: number): { label: string; color: string } => {
  if (gmd >= 1.5) return { label: 'Excelente', color: 'text-green-400' };
  if (gmd >= 1.0) return { label: 'Bom', color: 'text-blue-400' };
  if (gmd >= 0.7) return { label: 'Regular', color: 'text-yellow-400' };
  if (gmd >= 0.4) return { label: 'Abaixo', color: 'text-orange-400' };
  return { label: 'Crítico', color: 'text-red-400' };
};
