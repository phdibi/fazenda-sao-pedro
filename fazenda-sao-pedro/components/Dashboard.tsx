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

// Skeleton loading component
const CardSkeleton = () => (
  <div className="bg-base-800 rounded-xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-base-700" />
    <div className="p-3 space-y-2">
      <div className="h-4 bg-base-700 rounded w-3/4" />
      <div className="h-3 bg-base-700 rounded w-1/2" />
      <div className="h-3 bg-base-700 rounded w-2/3" />
    </div>
  </div>
);

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
      <div className="flex flex-col items-center justify-center py-16 px-4">
        {/* Empty state com ilustração */}
        <div className="w-24 h-24 mb-4 rounded-full bg-base-800 flex items-center justify-center">
          <svg className="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Nenhum animal encontrado</h2>
        <p className="text-gray-400 text-center max-w-sm">
          Ajuste os filtros ou cadastre um novo animal para começar.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Dica de swipe para mobile */}
      {(onQuickWeight || onQuickMedication) && (
        <div className="flex items-center justify-center gap-4 mb-4 md:hidden">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center">
              <span className="text-blue-400">←</span>
            </span>
            <span>Peso</span>
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>Medicação</span>
            <span className="w-6 h-6 rounded-full bg-red-600/20 flex items-center justify-center">
              <span className="text-red-400">→</span>
            </span>
          </div>
        </div>
      )}
      
      {/* 
        🔧 LAYOUT OTIMIZADO:
        - Mobile: 2 colunas (mais legível)
        - Tablet: 3-4 colunas
        - Desktop: 5-7 colunas
      */}
      <div
        className="
          grid
          grid-cols-2
          gap-3
          sm:grid-cols-3
          md:grid-cols-4
          lg:grid-cols-5
          xl:grid-cols-6
          2xl:grid-cols-7
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
      
      {/* Contador de resultados */}
      <div className="mt-4 text-center text-sm text-gray-500">
        {animals.length} {animals.length === 1 ? 'animal' : 'animais'}
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
