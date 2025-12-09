import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';
import { Animal, AnimalWithCachedGMD } from '../types';
import AnimalCard from './AnimalCard';
import { 
  CARD_HEIGHT, 
  CARD_GAP, 
  VIRTUALIZATION_THRESHOLD,
  GRID_OVERSCAN_ROWS,
  BREAKPOINTS,
  GRID_COLUMNS
} from '../constants/app';

// Tipo que aceita tanto Animal quanto AnimalWithCachedGMD
type AnimalType = Animal | AnimalWithCachedGMD;

interface DashboardProps {
  animals: AnimalType[];
  onSelectAnimal: (animal: AnimalType) => void;
  onQuickWeight?: (animal: AnimalType) => void;
  onQuickMedication?: (animal: AnimalType) => void;
  onLongPress?: (animal: AnimalType, position: { x: number; y: number }) => void;
  showGMD?: boolean;
}

// ============================================
// 🔧 HOOK: Calcular colunas responsivas
// ============================================
const useResponsiveColumns = () => {
  const [columns, setColumns] = useState(GRID_COLUMNS.default);
  
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width >= BREAKPOINTS['2xl']) setColumns(GRID_COLUMNS['2xl']);
      else if (width >= BREAKPOINTS.xl) setColumns(GRID_COLUMNS.xl);
      else if (width >= BREAKPOINTS.lg) setColumns(GRID_COLUMNS.lg);
      else if (width >= BREAKPOINTS.md) setColumns(GRID_COLUMNS.md);
      else if (width >= BREAKPOINTS.sm) setColumns(GRID_COLUMNS.sm);
      else setColumns(GRID_COLUMNS.default);
    };
    
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);
  
  return columns;
};

// ============================================
// 🔧 HOOK: Calcular largura do container
// ============================================
const useContainerWidth = (ref: React.RefObject<HTMLDivElement>) => {
  const [width, setWidth] = useState(0);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  
  return width;
};

// ============================================
// 🔧 COMPONENTE: Grid Virtualizado
// ============================================
interface VirtualizedGridProps {
  animals: AnimalType[];
  columnCount: number;
  containerWidth: number;
  onSelectAnimal: (animal: AnimalType) => void;
  onQuickWeight?: (animal: AnimalType) => void;
  onQuickMedication?: (animal: AnimalType) => void;
  onLongPress?: (animal: AnimalType, position: { x: number; y: number }) => void;
  showGMD: boolean;
}

const VirtualizedGrid = React.memo(({
  animals,
  columnCount,
  containerWidth,
  onSelectAnimal,
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD
}: VirtualizedGridProps) => {
  const rowCount = Math.ceil(animals.length / columnCount);
  const columnWidth = Math.floor((containerWidth - (columnCount - 1) * CARD_GAP) / columnCount);
  const rowHeight = CARD_HEIGHT + CARD_GAP;
  
  // Altura visível (80vh ou max 800px)
  const gridHeight = Math.min(window.innerHeight * 0.8, 800);

  const Cell = useCallback(({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= animals.length) return null;
    
    const animal = animals[index];
    
    return (
      <div 
        style={{
          ...style,
          left: Number(style.left) + (columnIndex * CARD_GAP),
          top: Number(style.top) + (rowIndex * CARD_GAP),
          width: columnWidth,
          height: CARD_HEIGHT,
        }}
      >
        <AnimalCard
          animal={animal}
          onClick={() => onSelectAnimal(animal)}
          onQuickWeight={onQuickWeight}
          onQuickMedication={onQuickMedication}
          onLongPress={onLongPress}
          showGMD={showGMD}
          cachedGMD={(animal as AnimalWithCachedGMD)._cachedGMD}
        />
      </div>
    );
  }, [animals, columnCount, columnWidth, onSelectAnimal, onQuickWeight, onQuickMedication, onLongPress, showGMD]);

  return (
    <Grid
      columnCount={columnCount}
      columnWidth={columnWidth + CARD_GAP}
      height={gridHeight}
      rowCount={rowCount}
      rowHeight={rowHeight}
      width={containerWidth}
      overscanRowCount={GRID_OVERSCAN_ROWS}
      className="scrollbar-thin scrollbar-thumb-base-600"
    >
      {Cell}
    </Grid>
  );
});

VirtualizedGrid.displayName = 'VirtualizedGrid';

// ============================================
// 🔧 COMPONENTE: Grid Normal (poucos animais)
// ============================================
interface NormalGridProps {
  animals: AnimalType[];
  onSelectAnimal: (animal: AnimalType) => void;
  onQuickWeight?: (animal: AnimalType) => void;
  onQuickMedication?: (animal: AnimalType) => void;
  onLongPress?: (animal: AnimalType, position: { x: number; y: number }) => void;
  showGMD: boolean;
}

const NormalGrid = React.memo(({
  animals,
  onSelectAnimal,
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD
}: NormalGridProps) => (
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
        cachedGMD={(animal as AnimalWithCachedGMD)._cachedGMD}
      />
    ))}
  </div>
), (prev, next) => {
  // 🔧 FIX: Comparar IDs ao invés de referência
  if (prev.animals.length !== next.animals.length) return false;
  if (prev.showGMD !== next.showGMD) return false;
  
  // Comparação rápida por IDs
  for (let i = 0; i < prev.animals.length; i++) {
    if (prev.animals[i].id !== next.animals[i].id) return false;
  }
  
  return true;
});

NormalGrid.displayName = 'NormalGrid';

// ============================================
// 🔧 COMPONENTE PRINCIPAL
// ============================================
const Dashboard = ({ 
  animals, 
  onSelectAnimal,
  onQuickWeight,
  onQuickMedication,
  onLongPress,
  showGMD = true 
}: DashboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useResponsiveColumns();
  const containerWidth = useContainerWidth(containerRef as React.RefObject<HTMLDivElement>);
  
  // Decide se usa virtualização
  const useVirtualization = animals.length > VIRTUALIZATION_THRESHOLD;

  if (!animals || animals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
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
    <div ref={containerRef}>
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
      
      {/* 🔧 Renderização condicional: virtualizado ou normal */}
      {useVirtualization && containerWidth > 0 ? (
        <VirtualizedGrid
          animals={animals}
          columnCount={columnCount}
          containerWidth={containerWidth}
          onSelectAnimal={onSelectAnimal}
          onQuickWeight={onQuickWeight}
          onQuickMedication={onQuickMedication}
          onLongPress={onLongPress}
          showGMD={showGMD}
        />
      ) : (
        <NormalGrid
          animals={animals}
          onSelectAnimal={onSelectAnimal}
          onQuickWeight={onQuickWeight}
          onQuickMedication={onQuickMedication}
          onLongPress={onLongPress}
          showGMD={showGMD}
        />
      )}
      
      {/* Contador de resultados */}
      <div className="mt-4 text-center text-sm text-gray-500">
        {animals.length} {animals.length === 1 ? 'animal' : 'animais'}
        {useVirtualization && (
          <span className="ml-2 text-xs text-brand-primary-light">(virtualizado)</span>
        )}
      </div>
    </div>
  );
};

// 🔧 FIX #1: Memo com comparação por IDs ao invés de referência
export default React.memo(Dashboard, (prevProps, nextProps) => {
  // Comparação rápida
  if (prevProps.animals.length !== nextProps.animals.length) return false;
  if (prevProps.showGMD !== nextProps.showGMD) return false;
  
  // Comparar IDs (mais eficiente que comparar objetos inteiros)
  const prevIds = prevProps.animals.map(a => a.id).join(',');
  const nextIds = nextProps.animals.map(a => a.id).join(',');
  
  return prevIds === nextIds;
});
