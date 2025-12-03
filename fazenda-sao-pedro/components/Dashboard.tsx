import React from 'react';
import { Animal } from '../types';
import AnimalCard from './AnimalCard';

interface DashboardProps {
  animals: Animal[];
  onSelectAnimal: (animal: Animal) => void;
  onQuickWeight?: (animal: Animal) => void;
  onQuickMedication?: (animal: Animal) => void;
  onLongPress?: (animal: Animal, position: { x: number; y: number }) => void;
  showGMD?: boolean;
}

const Dashboard = ({ 
  animals, 
  onSelectAnimal,
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD = true 
}: DashboardProps) => {
  if (!animals || animals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <h2 className="text-xl font-semibold">Nenhum animal encontrado</h2>
        <p className="mt-2">Tente ajustar seus filtros ou cadastre um novo animal.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Dica de swipe para mobile */}
      {(onQuickWeight || onQuickMedication) && (
        <p className="text-xs text-gray-500 text-center mb-3 md:hidden">
          💡 Deslize para ações rápidas • Segure para menu
        </p>
      )}
      
      <div
        className="
          grid
          grid-cols-3
          gap-3
          sm:grid-cols-4
          md:grid-cols-5
          lg:grid-cols-6
          xl:grid-cols-7
        "
      >
        {animals.map((animal) => (
          <AnimalCard
            key={animal.id}
            animal={animal}
            onClick={() => onSelectAnimal(animal)}
            onQuickWeight={onQuickWeight}
            onQuickMedication={onQuickMedication}
            onLongPress={onLongPress}
            showGMD={showGMD}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(
  Dashboard,
  (prevProps, nextProps) => {
    return (
      prevProps.animals.length === nextProps.animals.length &&
      prevProps.animals === nextProps.animals &&
      prevProps.onSelectAnimal === nextProps.onSelectAnimal &&
      prevProps.showGMD === nextProps.showGMD
    );
  }
);
