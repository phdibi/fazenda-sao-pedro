import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Animal, AnimalStatus, GMDMetrics } from '../types';
import { calcularGMDAnimal, formatarGMD, classificarGMD } from '../utils/gmdCalculations';
import {
  SWIPE_THRESHOLD,
  LONG_PRESS_DURATION_MS,
  INTERSECTION_OBSERVER,
  RECENT_WEIGHING_DAYS
} from '../constants/app';

interface AnimalCardProps {
  animal: Animal;
  onClick: () => void;
  onQuickWeight?: (animal: Animal) => void;
  onQuickMedication?: (animal: Animal) => void;
  onLongPress?: (animal: Animal, position: { x: number; y: number }) => void;
  showGMD?: boolean;
  // 🔧 OTIMIZAÇÃO #3: GMD pré-calculado (opcional)
  cachedGMD?: GMDMetrics | null;
}

// ============================================
// 🔧 OTIMIZAÇÃO #4: LazyImage com Intersection Observer
// Carrega imagem apenas quando entra no viewport
// ============================================
const LazyImage: React.FC<{
  src: string;
  thumbnailSrc?: string;
  alt: string;
}> = ({ src, thumbnailSrc, alt }) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Usa thumbnail se disponível, senão usa imagem principal
  const displaySrc = thumbnailSrc || src;

  // 🔧 Intersection Observer para lazy loading inteligente
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      INTERSECTION_OBSERVER
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (hasError) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-700 to-base-800">
        <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Skeleton enquanto não carrega */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-base-700 animate-pulse" />
      )}

      {/* Só renderiza a tag img quando deve carregar */}
      {shouldLoad && (
        <img
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          src={displaySrc}
          alt={alt}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};

// Configuração de cores por status
const statusConfig: Record<string, { bg: string; border: string; text: string }> = {
  [AnimalStatus.Ativo]: {
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
    text: 'text-emerald-400'
  },
  [AnimalStatus.Vendido]: {
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-400'
  },
  [AnimalStatus.Obito]: {
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
    text: 'text-red-400'
  },
};

const AnimalCard: React.FC<AnimalCardProps> = ({
  animal,
  onClick,
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD = true,
  cachedGMD // 🔧 OTIMIZAÇÃO #3: Usa GMD pré-calculado se disponível
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const [actionExecuted, setActionExecuted] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 🔧 OTIMIZAÇÃO #3: Usa GMD em cache ou calcula (memoizado)
  const gmd = useMemo(() => {
    if (!showGMD) return null;
    if (cachedGMD !== undefined) return cachedGMD;
    return calcularGMDAnimal(animal);
  }, [showGMD, cachedGMD, animal.id, animal.historicoPesagens?.length]);

  const gmdClass = gmd?.gmdTotal ? classificarGMD(gmd.gmdTotal) : null;

  const config = statusConfig[animal.status] || statusConfig[AnimalStatus.Ativo];
  const mainPhoto = animal.fotos?.[0];
  const displayName = animal.nome || `Brinco ${animal.brinco}`;

  // Indicador de manejo recente (pesagem nos últimos N dias)
  const hasRecentWeighing = animal.historicoPesagens?.some(p => {
    const date = new Date(p.date);
    const recentThreshold = new Date(Date.now() - RECENT_WEIGHING_DAYS * 24 * 60 * 60 * 1000);
    return date >= recentThreshold;
  });

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
      }, LONG_PRESS_DURATION_MS);
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
      }, LONG_PRESS_DURATION_MS);
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
    <div className="animal-card relative overflow-hidden rounded-xl">
      {/* Fundo azul - Peso */}
      {onQuickWeight && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-start pl-3 rounded-xl"
          style={{
            opacity: showWeightAction ? Math.min(1, Math.abs(swipeOffset) / 100) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s'
          }}
        >
          <div className="text-white text-center">
            <span className="text-2xl">⚖️</span>
            <p className="text-xs font-medium">Peso</p>
          </div>
        </div>
      )}

      {/* Fundo vermelho - Medicação */}
      {onQuickMedication && (
        <div
          className="absolute inset-0 bg-gradient-to-l from-red-600 to-red-500 flex items-center justify-end pr-3 rounded-xl"
          style={{
            opacity: showMedicationAction ? Math.min(1, Math.abs(swipeOffset) / 100) : 0,
            transition: isSwiping ? 'none' : 'opacity 0.2s'
          }}
        >
          <div className="text-white text-center">
            <span className="text-2xl">💊</span>
            <p className="text-xs font-medium">Med</p>
          </div>
        </div>
      )}

      {/* Card principal com borda colorida por status */}
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
        className={`
          bg-base-800 rounded-xl shadow-lg overflow-hidden cursor-pointer relative
          border-l-4 ${config.border}
          hover:bg-base-750 transition-colors
        `}
      >
        {/* Foto */}
        <div className="relative aspect-square w-full">
          {mainPhoto ? (
            <LazyImage
              src={mainPhoto}
              thumbnailSrc={animal.thumbnailUrl}
              alt={displayName}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-700 to-base-800">
              <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Indicador de manejo recente */}
          {hasRecentWeighing && (
            <div className="absolute top-2 left-2">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full block shadow-lg shadow-emerald-400/50" title="Pesado recentemente" />
            </div>
          )}

          {/* Badge de status - Pill style */}
          <div className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-semibold rounded-full ${config.bg} ${config.text} backdrop-blur-sm`}>
            {animal.status}
          </div>

          {/* Badge FIV */}
          {animal.isFIV && (
            <div className="absolute top-2 right-[70px] px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-600/90 text-white backdrop-blur-sm">
              FIV
            </div>
          )}

          {/* GMD badge */}
          {gmdClass && gmd?.gmdTotal && gmd.gmdTotal > 0 && (
            <div className={`absolute bottom-2 right-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-base-900/80 backdrop-blur-sm ${gmdClass.color}`}>
              {gmd.gmdTotal.toFixed(2)} kg/d
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5">
          <h3 className="font-bold text-sm text-white truncate leading-tight">
            {displayName}
          </h3>

          {/* Dados principais */}
          <div className="mt-2 space-y-1 text-sm text-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Sexo:</span>
              <span className="font-semibold text-white">{animal.sexo}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Mãe:</span>
              <span className="font-semibold text-white">{animal.maeNome || 'Não inf.'}</span>
            </div>
          </div>

          {/* Info secundária */}
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
            <span className="truncate">{animal.raca}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AnimalCard, (prev, next) =>
  prev.animal === next.animal &&
  prev.onClick === next.onClick &&
  prev.showGMD === next.showGMD &&
  prev.cachedGMD === next.cachedGMD &&
  prev.onQuickWeight === next.onQuickWeight &&
  prev.onQuickMedication === next.onQuickMedication &&
  prev.onLongPress === next.onLongPress
);