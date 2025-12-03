import React from 'react';
import { Animal } from '../types';

interface QuickActionsMenuProps {
  animal: Animal;
  position: { x: number; y: number };
  onClose: () => void;
  onAddWeight: (animal: Animal) => void;
  onAddMedication: (animal: Animal) => void;
  onViewDetails: (animal: Animal) => void;
  onAddToLot: (animal: Animal) => void;
  onPredict: (animal: Animal) => void;
}

const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({
  animal,
  position,
  onClose,
  onAddWeight,
  onAddMedication,
  onViewDetails,
  onAddToLot,
  onPredict,
}) => {
  const menuItems = [
    { icon: '⚖️', label: 'Adicionar Peso', action: () => onAddWeight(animal), color: 'hover:bg-blue-600' },
    { icon: '💊', label: 'Adicionar Medicação', action: () => onAddMedication(animal), color: 'hover:bg-red-600' },
    { icon: '📋', label: 'Ver Detalhes', action: () => onViewDetails(animal), color: 'hover:bg-gray-600' },
    { icon: '📦', label: 'Adicionar a Lote', action: () => onAddToLot(animal), color: 'hover:bg-purple-600' },
    { icon: '🔮', label: 'Previsão de Peso', action: () => onPredict(animal), color: 'hover:bg-green-600' },
  ];

  // Ajusta posição para não sair da tela
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 250),
  };

  return (
    <>
      {/* Overlay para fechar */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="fixed z-50 bg-base-800 rounded-lg shadow-xl border border-base-700 overflow-hidden animate-fade-in"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
          minWidth: '180px',
        }}
      >
        {/* Header com info do animal */}
        <div className="px-3 py-2 bg-base-900 border-b border-base-700">
          <p className="text-sm font-bold text-white truncate">
            {animal.nome || animal.brinco}
          </p>
          <p className="text-xs text-gray-400">
            {animal.pesoKg}kg • {animal.raca}
          </p>
        </div>

        {/* Ações */}
        <div className="py-1">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                item.action();
                onClose();
              }}
              className={`w-full px-3 py-2 text-left text-sm text-white flex items-center gap-2 transition-colors ${item.color}`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default QuickActionsMenu;
