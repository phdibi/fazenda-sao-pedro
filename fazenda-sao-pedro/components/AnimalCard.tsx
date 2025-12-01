import React from 'react';
import { Animal } from '../types';

interface AnimalCardProps {
  animal: Animal;
  onClick: () => void;
}

const AnimalCard = ({ animal, onClick }: AnimalCardProps) => {
  const statusColor: Record<string, string> = {
    Ativo: 'bg-green-500',
    Vendido: 'bg-yellow-500',
    Óbito: 'bg-red-500',
  };

  const mainPhoto = animal.fotos?.[0];
  const badgeColor = statusColor[animal.status] ?? 'bg-gray-500';
  const displayName = animal.nome || `Brinco ${animal.brinco}`;

  return (
    <div
      onClick={onClick}
      className="
        bg-base-800
        rounded-lg
        shadow-lg
        overflow-hidden
        cursor-pointer
        transform
        hover:-translate-y-1
        transition-transform
        duration-300
        group
        relative
        text-xs
      "
      aria-label={displayName}
      role="button"
    >
      <div className="relative aspect-square w-full">
        {mainPhoto ? (
          <img
            className="w-full h-full object-cover"
            src={mainPhoto}
            alt={displayName}
            loading="lazy" // Lazy loading nativo para performance
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-base-700 text-[11px] text-gray-300">
            Sem foto
          </div>
        )}

        <div
          className={`
            absolute top-2 right-2
            px-2 py-0.5
            text-[10px]
            font-bold
            text-white
            rounded-full
            ${badgeColor}
          `}
        >
          {animal.status}
        </div>
      </div>

      <div className="p-2">
        <h3
          className="font-bold text-[13px] text-white truncate"
          title={displayName}
        >
          {displayName}
        </h3>

        {animal.nome && (
          <p className="text-[11px] text-brand-primary-light">
            Brinco: {animal.brinco}
          </p>
        )}

        <div className="mt-1 pt-1 border-t border-base-700/50 space-y-0.5 text-[10px]">
          <div className="flex justify-between gap-1">
            <span className="text-gray-400">Raça:</span>
            <span className="font-medium text-gray-200 truncate">
              {animal.raca}
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="text-gray-400">Sexo:</span>
            <span className="font-medium text-gray-200 truncate">
              {animal.sexo}
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span className="text-gray-400">Mãe:</span>
            <span className="font-medium text-gray-200 truncate">
              {animal.maeNome || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoização simples: se o objeto do animal não mudar de referência, não re-renderiza.
// Isso evita bugs caso alguma propriedade mude e o card não seja atualizado.
export default React.memo(
  AnimalCard,
  (prevProps, nextProps) =>
    prevProps.animal === nextProps.animal &&
    prevProps.onClick === nextProps.onClick
);
