import React from 'react';
import { BreedingSeasonStatus } from '../../types';

interface StatusBadgeProps {
  status: BreedingSeasonStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = {
    planning: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Planejamento' },
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Ativa' },
    finished: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Finalizada' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelada' },
  };
  const c = config[status];
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

export default StatusBadge;
