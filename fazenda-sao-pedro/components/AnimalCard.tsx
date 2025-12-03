import React, { useState, useRef, useCallback } from 'react';
import { Animal } from '../types';
import { calcularGMDAnimal, formatarGMD, classificarGMD } from '../utils/gmdCalculations';

interface AnimalCardProps {
  animal: Animal;
  onClick: () => void;
  onQuickWeight?: (animal: Animal) => void;
  onQuickMedication?: (animal: Animal) => void;
  onLongPress?: (animal: Animal, position: { x: number; y: number }) => void;
  showGMD?: boolean;
}

const AnimalCard = ({ 
  animal, 
  onClick, 
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD = true 
}: AnimalCardProps) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 60;
  const LONG_PRESS_DURATION = 500;

  // Calcula GMD
  const gmd = showGMD ? calcularGMDAnimal(animal) : null;
  const gmdClass = gmd?.gmdTotal ? classificarGMD(gmd.gmdTotal) : null;

  const statusColor: Record<string, string> = {
    Ativo: 'bg-green-500',
    Vendido: 'bg-yellow-500',
    Óbito: 'bg-red-500',
  };

  const mainPhoto = animal.fotos?.[0];
  const badgeColor = statusColor[animal.status] ?? 'bg-gray-500';
  const displayName = animal.nome || `Brinco ${animal.brinco}`;

  // Touch handlers para swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setLongPressTriggered(false);
    setIsSwiping(true);

    // Inicia timer de long press
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          onLongPress(animal, { x: rect.left + rect.width / 2, y: rect.top });
        }
        setLongPressTriggered(true);
        setIsSwiping(false);
        setSwipeX(0);
      }, LONG_PRESS_DURATION);
    }
  }, [animal, onLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping || longPressTriggered) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

    // Cancela long press se mover
    if (longPressTimer.current && (Math.abs(deltaX) > 10 || deltaY > 10)) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Só permite swipe horizontal
    if (deltaY < 30) {
      setSwipeX(Math.max(-100, Math.min(100, deltaX)));
    }
  }, [isSwiping, longPressTriggered]);

  const handleTouchEnd = useCallback(() => {
    // Cancela long press
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (longPressTriggered) {
      setLongPressTriggered(false);
      setSwipeX(0);
      setIsSwiping(false);
      return;
    }

    if (swipeX > SWIPE_THRESHOLD && onQuickWeight) {
      // Swipe direita -> Peso
      onQuickWeight(animal);
    } else if (swipeX < -SWIPE_THRESHOLD && onQuickMedication) {
      // Swipe esquerda -> Medicação
      onQuickMedication(animal);
    }

    setSwipeX(0);
    setIsSwiping(false);
  }, [swipeX, animal, onQuickWeight, onQuickMedication, longPressTriggered]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setLongPressTriggered(false);
    setSwipeX(0);
    setIsSwiping(false);
  }, []);

  // Mouse handlers para desktop (long press)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress(animal, { x: e.clientX, y: e.clientY });
      }, LONG_PRESS_DURATION);
    }
  }, [animal, onLongPress]);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!longPressTriggered && Math.abs(swipeX) < 10) {
      onClick();
    }
  }, [swipeX, longPressTriggered, onClick]);

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Ação de swipe esquerda (medicação) */}
      <div 
        className={`absolute inset-y-0 right-0 w-20 bg-red-600 flex items-center justify-center transition-opacity ${
          swipeX < -20 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="text-white text-center">
          <span className="text-lg">💊</span>
          <p className="text-[9px]">Medicação</p>
        </div>
      </div>

      {/* Ação de swipe direita (peso) */}
      <div 
        className={`absolute inset-y-0 left-0 w-20 bg-blue-600 flex items-center justify-center transition-opacity ${
          swipeX > 20 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="text-white text-center">
          <span className="text-lg">⚖️</span>
          <p className="text-[9px]">Peso</p>
        </div>
      </div>

      {/* Card principal */}
      <div
        ref={cardRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ transform: `translateX(${swipeX}px)` }}
        className={`
          bg-base-800
          rounded-lg
          shadow-lg
          overflow-hidden
          cursor-pointer
          transform
          hover:-translate-y-1
          transition-all
          duration-300
          group
          relative
          text-xs
          ${isSwiping ? '' : 'transition-transform'}
        `}
        aria-label={displayName}
        role="button"
      >
        <div className="relative aspect-square w-full">
          {mainPhoto ? (
            <img
              className="w-full h-full object-cover"
              src={mainPhoto}
              alt={displayName}
              loading="lazy"
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

          {/* Badge de GMD */}
          {gmd?.gmdTotal && gmd.gmdTotal > 0 && (
            <div 
              className={`absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] ${gmdClass?.color}`}
              title={`GMD: ${formatarGMD(gmd.gmdTotal)}`}
            >
              GMD: {gmd.gmdTotal.toFixed(2)}
            </div>
          )}
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
              <span className="text-gray-400">Peso:</span>
              <span className="font-medium text-gray-200">
                {animal.pesoKg} kg
              </span>
            </div>
            <div className="flex justify-between gap-1">
              <span className="text-gray-400">Sexo:</span>
              <span className="font-medium text-gray-200 truncate">
                {animal.sexo}
              </span>
            </div>
          </div>
        </div>

        {/* Indicador de swipe */}
        {(onQuickWeight || onQuickMedication) && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-transparent to-red-500 opacity-30" />
        )}
      </div>
    </div>
  );
};

export default React.memo(
  AnimalCard,
  (prevProps, nextProps) =>
    prevProps.animal === nextProps.animal &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.showGMD === nextProps.showGMD
);
