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
 * Calcula todas as métricas de GMD de um animal
 */
export const calcularGMDAnimal = (animal: Animal): GainMetrics => {
  const pesagens = animal.historicoPesagens || [];
  
  if (pesagens.length < 2) {
    return {
      gmdTotal: 0,
      diasAcompanhamento: 0,
    };
  }

  // Ordenar por data
  const sorted = [...pesagens].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const primeiro = sorted[0];
  const ultimo = sorted[sorted.length - 1];

  // GMD Total
  const diasTotal = Math.ceil(
    (new Date(ultimo.date).getTime() - new Date(primeiro.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  const gmdTotal = diasTotal > 0 
    ? Number(((ultimo.weightKg - primeiro.weightKg) / diasTotal).toFixed(3))
    : 0;

  // GMD Nascimento -> Desmame
  const pesoNascimento = sorted.find(p => p.type === WeighingType.Birth);
  const pesoDesmame = sorted.find(p => p.type === WeighingType.Weaning);
  
  let gmdNascimentoDesmame: number | undefined;
  if (pesoNascimento && pesoDesmame) {
    gmdNascimentoDesmame = calcularGMDEntrePesagens(
      pesoNascimento.weightKg,
      pesoDesmame.weightKg,
      pesoNascimento.date,
      pesoDesmame.date
    );
  }

  // GMD Desmame -> Sobreano
  const pesoSobreano = sorted.find(p => p.type === WeighingType.Yearling);
  
  let gmdDesmameSobreano: number | undefined;
  if (pesoDesmame && pesoSobreano) {
    gmdDesmameSobreano = calcularGMDEntrePesagens(
      pesoDesmame.weightKg,
      pesoSobreano.weightKg,
      pesoDesmame.date,
      pesoSobreano.date
    );
  }

  // GMD últimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const pesagensRecentes = sorted.filter(
    p => new Date(p.date) >= trintaDiasAtras
  );

  let gmdUltimos30Dias: number | undefined;
  if (pesagensRecentes.length >= 2) {
    const primeiraRecente = pesagensRecentes[0];
    const ultimaRecente = pesagensRecentes[pesagensRecentes.length - 1];
    gmdUltimos30Dias = calcularGMDEntrePesagens(
      primeiraRecente.weightKg,
      ultimaRecente.weightKg,
      primeiraRecente.date,
      ultimaRecente.date
    );
  }

  return {
    gmdTotal,
    gmdNascimentoDesmame,
    gmdDesmameSobreano,
    gmdUltimos30Dias,
    diasAcompanhamento: diasTotal,
    pesoInicial: primeiro.weightKg,
    pesoFinal: ultimo.weightKg,
  };
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