import React from 'react';
import { Animal } from '../types';
import AnimalCard from './AnimalCard';

interface DashboardProps {
  animals: Animal[];
  onSelectAnimal: (animal: Animal) => void;
}

const Dashboard = ({ animals, onSelectAnimal }: DashboardProps) => {
  if (!animals || animals.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <h2 className="text-xl font-semibold">Nenhum animal encontrado</h2>
        <p className="mt-2">Tente ajustar seus filtros ou cadastre um novo animal.</p>
      </div>
    );
  }

  return (
    <div
      className="
        grid
        grid-cols-3          /* 3 animais por linha em telas pequenas */
        gap-3                /* espaço um pouco menor entre os cards para caber melhor */
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
        />
      ))}
    </div>
  );
};

// Mantido o memo para performance
export default React.memo(
  Dashboard,
  (prevProps, nextProps) => {
    return (
      prevProps.animals.length === nextProps.animals.length &&
      prevProps.animals === nextProps.animals &&
      prevProps.onSelectAnimal === nextProps.onSelectAnimal
    );
  }
);
