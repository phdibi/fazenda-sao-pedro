import React from 'react';
import { Animal } from '../types';

interface AnimalCardProps {
  animal: Animal;
  onClick: () => void;
}

const AnimalCard = ({ animal, onClick }: AnimalCardProps) => {

  const statusColor = {
    'Ativo': 'bg-green-500',
    'Vendido': 'bg-yellow-500',
    'Óbito': 'bg-red-500'
  };

  return (
    <div
      onClick={onClick}
      className="bg-base-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transform hover:-translate-y-1 transition-transform duration-300 group relative"
    >
      <div className="relative aspect-square w-full">
        <img 
          className="w-full h-full object-cover" 
          src={animal.fotos[0]} 
          alt={`Animal ${animal.brinco}`}
          loading="lazy" // Lazy loading nativo para performance
        />
        <div className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-bold text-white rounded-full ${statusColor[animal.status]}`}>
            {animal.status}
        </div>
      </div>
      <div className="p-2">
        <h3 className="font-bold text-sm text-white truncate" title={animal.nome || `Brinco ${animal.brinco}`}>{animal.nome || `Brinco ${animal.brinco}`}</h3>
        {animal.nome && <p className="text-xs text-brand-primary-light">Brinco: {animal.brinco}</p>}
        
        <div className="mt-1 pt-1 border-t border-base-700/50 space-y-0.5 text-[11px]">
            <div className="flex justify-between"><span className="text-gray-400">Raça:</span> <span className="font-medium text-gray-200">{animal.raca}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Sexo:</span> <span className="font-medium text-gray-200">{animal.sexo}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Mãe:</span> <span className="font-medium text-gray-200 truncate">{animal.maeNome || 'N/A'}</span></div>
        </div>
      </div>
    </div>
  );
};

// Memoização para evitar re-renders desnecessários
export default React.memo(AnimalCard, (prevProps, nextProps) => {
  return (
    prevProps.animal.id === nextProps.animal.id &&
    prevProps.animal.fotos[0] === nextProps.animal.fotos[0] &&
    prevProps.animal.nome === nextProps.animal.nome &&
    prevProps.animal.status === nextProps.animal.status &&
    prevProps.animal.pesoKg === nextProps.animal.pesoKg
  );
});