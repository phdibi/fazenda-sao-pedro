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

const AnimalCard: React.FC<AnimalCardProps> = ({ 
  animal, 
  onClick, 
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD = true 
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const [actionExecuted, setActionExecuted] = useState(false);
  
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const LONG_PRESS_DURATION = 600;

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

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    setLongPressTriggered(false);
    setActionExecuted(false);
    setIsSwiping(false);

    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if ('vibrate' in navigator) navigator.vibrate(50);
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          onLongPress(animal, { x: rect.left + rect.width / 2, y: rect.top });
        }
        setLongPressTriggered(true);
        setActionExecuted(true);
        setSwipeOffset(0);
      }, LONG_PRESS_DURATION);
    }
  }, [animal, onLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTriggered || actionExecuted) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    if (Math.abs(deltaX) > 10 || deltaY > 10) {
      clearTimer();
    }

    if (deltaY < 50 && Math.abs(deltaX) > 15) {
      setIsSwiping(true);
      setSwipeOffset(Math.max(-120, Math.min(120, deltaX)));
    }
  }, [longPressTriggered, actionExecuted]);

  const handleTouchEnd = useCallback(() => {
    clearTimer();

    if (longPressTriggered || actionExecuted) {
      setLongPressTriggered(false);
      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }

    if (swipeOffset > SWIPE_THRESHOLD && onQuickWeight) {
      if ('vibrate' in navigator) navigator.vibrate(30);
      setActionExecuted(true);
      onQuickWeight(animal);
    } else if (swipeOffset < -SWIPE_THRESHOLD && onQuickMedication) {
      if ('vibrate' in navigator) navigator.vibrate(30);
      setActionExecuted(true);
      onQuickMedication(animal);
    }

    setSwipeOffset(0);
    setTimeout(() => {
      setIsSwiping(false);
      setActionExecuted(false);
    }, 200);
  }, [swipeOffset, animal, onQuickWeight, onQuickMedication, longPressTriggered, actionExecuted]);

  const handleTouchCancel = useCallback(() => {
    clearTimer();
    setLongPressTriggered(false);
    setActionExecuted(false);
    setSwipeOffset(0);
    setIsSwiping(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress(animal, { x: e.clientX, y: e.clientY });
        setLongPressTriggered(true);
        setActionExecuted(true);
      }, LONG_PRESS_DURATION);
    }
  }, [animal, onLongPress]);

  const handleMouseUp = useCallback(() => {
    clearTimer();
  }, []);

  const handleClick = useCallback(() => {
    if (!longPressTriggered && !actionExecuted && !isSwiping && Math.abs(swipeOffset) < 20) {
      onClick();
    }
  }, [swipeOffset, longPressTriggered, actionExecuted, isSwiping, onClick]);

  const showWeightAction = swipeOffset > 30;
  const showMedicationAction = swipeOffset < -30;

  return (
    <div className="animal-card relative overflow-hidden rounded-lg">
      {/* Fundo azul - Peso */}
      {onQuickWeight && (
        <div 
          className="absolute inset-0 bg-blue-600 flex items-center justify-start pl-2 rounded-lg"
          style={{ 
            opacity: showWeightAction ? Math.min(1, Math.abs(swipeOffset) / 100) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s'
          }}
        >
          <div className="text-white text-center">
            <span className="text-xl">⚖️</span>
            <p className="text-[9px]">Peso</p>
          </div>
        </div>
      )}

      {/* Fundo vermelho - Medicação */}
      {onQuickMedication && (
        <div 
          className="absolute inset-0 bg-red-600 flex items-center justify-end pr-2 rounded-lg"
          style={{ 
            opacity: showMedicationAction ? Math.min(1, Math.abs(swipeOffset) / 100) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s'
          }}
        >
          <div className="text-white text-center">
            <span className="text-xl">💊</span>
            <p className="text-[9px]">Medicação</p>
          </div>
        </div>
      )}

      {/* Card */}
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
        style={{ 
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
        }}
        className="bg-base-800 rounded-lg shadow-lg overflow-hidden cursor-pointer relative"
      >
        {/* Foto */}
        <div className="relative aspect-square w-full">
          {mainPhoto ? (
            <img
              className="w-full h-full object-cover"
              src={mainPhoto}
              alt={displayName}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-base-700 text-[10px] text-gray-300">
              Sem foto
            </div>
          )}

          {/* Status badge */}
          <div className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full ${badgeColor}`}>
            {animal.status}
          </div>

          {/* GMD badge */}

        </div>

        {/* Info */}
        <div className="p-1.5">
          <h3 className="font-bold text-[11px] text-white truncate">
            {displayName}
          </h3>
          <div className="mt-1 pt-1 border-t border-base-700/50 space-y-0.5 text-[9px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Raça:</span>
              <span className="text-gray-200">{animal.raca}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sexo:</span>
              <span className="text-gray-200">{animal.sexo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mãe:</span>
              <span className="text-gray-200 truncate max-w-[55%]">{animal.maeNome || 'Não inf.'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AnimalCard, (prev, next) => 
  prev.animal === next.animal && 
  prev.onClick === next.onClick && 
  prev.showGMD === next.showGMD
);