import { CoverageType } from '../../types';

export const formatDate = (d: Date | string | undefined): string => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

export const toInputDate = (d: Date | string | undefined): string => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export const typeLabels: Record<CoverageType, string> = {
  natural: 'Monta Natural',
  ia: 'IA',
  iatf: 'IATF',
  fiv: 'FIV',
};

export const resultLabels: Record<string, string> = {
  positive: 'Prenhe',
  negative: 'Vazia',
  pending: 'Pendente',
};

export const resultColors: Record<string, string> = {
  positive: 'bg-emerald-500/20 text-emerald-400',
  negative: 'bg-red-500/20 text-red-400',
  pending: 'bg-amber-500/20 text-amber-400',
};
