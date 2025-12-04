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
  const [actionExecuted, setActionExecuted] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const LONG_PRESS_DURATION = 600;

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

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Touch handlers para swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    setLongPressTriggered(false);
    setActionExecuted(false);
    setIsSwiping(false);

    // Inicia timer de long press
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          onLongPress(animal, { x: rect.left + rect.width / 2, y: rect.top });
        }
        setLongPressTriggered(true);
        setActionExecuted(true);
        setIsSwiping(false);
        setSwipeX(0);
      }, LONG_PRESS_DURATION);
    }
  }, [animal, onLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (longPressTriggered || actionExecuted) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    // Cancela long press se mover
    if (Math.abs(deltaX) > 10 || deltaY > 10) {
      clearLongPressTimer();
    }

    // Só permite swipe horizontal se movimento Y for pequeno
    if (deltaY < 50 && Math.abs(deltaX) > 15) {
      setIsSwiping(true);
      setSwipeX(Math.max(-120, Math.min(120, deltaX)));
    }
  }, [longPressTriggered, actionExecuted]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();

    if (longPressTriggered || actionExecuted) {
      setLongPressTriggered(false);
      setSwipeX(0);
      setIsSwiping(false);
      return;
    }

    // Executa ação de swipe
    if (swipeX > SWIPE_THRESHOLD && onQuickWeight) {
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
      setActionExecuted(true);
      onQuickWeight(animal);
    } else if (swipeX < -SWIPE_THRESHOLD && onQuickMedication) {
      if ('vibrate' in navigator) {
        navigator.vibrate(30);
      }
      setActionExecuted(true);
      onQuickMedication(animal);
    }

    // Reset com animação
    setSwipeX(0);
    setTimeout(() => {
      setIsSwiping(false);
      setActionExecuted(false);
    }, 200);
  }, [swipeX, animal, onQuickWeight, onQuickMedication, longPressTriggered, actionExecuted]);

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    setLongPressTriggered(false);
    setActionExecuted(false);
    setSwipeX(0);
    setIsSwiping(false);
  }, []);

  // Mouse handlers para desktop (long press)
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
    clearLongPressTimer();
  }, []);

  const handleClick = useCallback(() => {
    // Só abre modal normal se não houve swipe nem long press nem ação
    if (!longPressTriggered && !actionExecuted && !isSwiping && Math.abs(swipeX) < 20) {
      onClick();
    }
  }, [swipeX, longPressTriggered, actionExecuted, isSwiping, onClick]);

  // Calcula se deve mostrar indicadores de ação
  const showWeightIndicator = swipeX > 30;
  const showMedicationIndicator = swipeX < -30;

  return (
    <div className="animal-card relative overflow-hidden rounded-lg">
      {/* Fundo de ação - Peso (swipe direita) */}
      {onQuickWeight && (
        <div 
          className="absolute inset-0 bg-blue-600 flex items-center justify-start pl-3 rounded-lg"
          style={{ 
            opacity: showWeightIndicator ? Math.min(1, Math.abs(swipeX) / 100) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s'
          }}
        >
          <div className="text-white text-center">
            <span className="text-2xl">⚖️</span>
            <p className="text-xs font-medium">Peso</p>
          </div>
        </div>
      )}

      {/* Fundo de ação - Medicação (swipe esquerda) */}
      {onQuickMedication && (
        <div 
          className="absolute inset-0 bg-red-600 flex items-center justify-end pr-3 rounded-lg"
          style={{ 
            opacity: showMedicationIndicator ? Math.min(1, Math.abs(swipeX) / 100) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s'
          }}
        >
          <div className="text-white text-center">
            <span className="text-2xl">💊</span>
            <p className="text-xs font-medium">Medicação</p>
          </div>
        </div>
      )}

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
        style={{ 
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
        }}
        className="bg-base-800 rounded-lg shadow-lg overflow-hidden cursor-pointer relative"
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
            <div className="w-full h-full flex items-center justify-center bg-base-700 text-[10px] text-gray-300">
              Sem foto
            </div>
          )}

          {/* Badge de status */}
          <div
            className={`absolute top-1 right-1 px-1.5 py-0.5 text-[8px] font-bold text-white rounded-full ${badgeColor}`}
          >
            {animal.status}
          </div>

          {/* Badge de GMD */}
          {gmd?.gmdTotal && gmd.gmdTotal > 0 && (
            <div 
              className={`absolute bottom-1 left-1 px-1 py-0.5 bg-black/70 rounded text-[7px] ${gmdClass?.color}`}
              title={`GMD: ${formatarGMD(gmd.gmdTotal)}`}
            >
              GMD: {gmd.gmdTotal.toFixed(2)}
            </div>
          )}
        </div>

        <div className="p-1.5">
          <h3 className="font-bold text-[11px] text-white truncate leading-tight" title={displayName}>
            {displayName}
          </h3>

          <div className="mt-0.5 pt-0.5 border-t border-base-700/50 space-y-0 text-[8px] leading-tight">
            <div className="flex justify-between gap-0.5">
              <span className="text-gray-400">Raça:</span>
              <span className="font-medium text-gray-200">{animal.raca}</span>
            </div>
            <div className="flex justify-between gap-0.5">
              <span className="text-gray-400">Sexo:</span>
              <span className="font-medium text-gray-200">{animal.sexo}</span>
            </div>
            <div className="flex justify-between gap-0.5">
              <span className="text-gray-400">Mãe:</span>
              <span className="font-medium text-gray-200 truncate max-w-[60%]">
                {animal.maeNome || 'Não inf.'}
              </span>
            </div>
          </div>
        </div>

        {/* Indicador visual de swipe disponível */}
        {(onQuickWeight || onQuickMedication) && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-transparent to-red-500 opacity-20" />
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