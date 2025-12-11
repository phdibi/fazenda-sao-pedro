/**
 * VirtualizedAnimalGrid - Grid virtualizado para grandes listas de animais
 * Usa react-window para renderizar apenas itens visíveis
 */

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeGrid, GridChildComponentProps } from 'react-window';
import { Animal } from '../types';
import { VIRTUALIZATION_THRESHOLD, CARD_HEIGHT, CARD_GAP, GRID_OVERSCAN_ROWS, BREAKPOINTS, GRID_COLUMNS } from '../constants/app';

interface VirtualizedAnimalGridProps {
    animals: Animal[];
    onSelectAnimal: (animal: Animal) => void;
    onQuickWeight?: (animal: Animal) => void;
    onQuickMedication?: (animal: Animal) => void;
    onLongPress?: (animal: Animal) => void;
    renderCard: (props: CardRenderProps) => React.ReactNode;
    containerWidth?: number;
}

export interface CardRenderProps {
    animal: Animal;
    onSelect: () => void;
    onQuickWeight?: () => void;
    onQuickMedication?: () => void;
    onLongPress?: () => void;
    style?: React.CSSProperties;
}

// Hook para detectar largura da janela
const useWindowSize = () => {
    const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => {
            setSize({ width: window.innerWidth, height: window.innerHeight });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return size;
};

// Calcula número de colunas baseado na largura
const getColumnCount = (width: number): number => {
    if (width >= BREAKPOINTS['2xl']) return GRID_COLUMNS['2xl'];
    if (width >= BREAKPOINTS.xl) return GRID_COLUMNS.xl;
    if (width >= BREAKPOINTS.lg) return GRID_COLUMNS.lg;
    if (width >= BREAKPOINTS.md) return GRID_COLUMNS.md;
    if (width >= BREAKPOINTS.sm) return GRID_COLUMNS.sm;
    return GRID_COLUMNS.default;
};

// Calcula largura da coluna
const getColumnWidth = (containerWidth: number, columnCount: number): number => {
    const totalGaps = (columnCount - 1) * CARD_GAP;
    const padding = 32; // 16px cada lado
    return Math.floor((containerWidth - totalGaps - padding) / columnCount);
};

const VirtualizedAnimalGrid: React.FC<VirtualizedAnimalGridProps> = ({
    animals,
    onSelectAnimal,
    onQuickWeight,
    onQuickMedication,
    onLongPress,
    renderCard,
    containerWidth: propContainerWidth,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { width: windowWidth, height: windowHeight } = useWindowSize();
    
    // Largura do container (usa prop ou largura da janela - padding)
    const containerWidth = propContainerWidth || Math.min(windowWidth - 32, 1280);
    
    // Cálculos de grid
    const columnCount = useMemo(() => getColumnCount(containerWidth), [containerWidth]);
    const columnWidth = useMemo(() => getColumnWidth(containerWidth, columnCount), [containerWidth, columnCount]);
    const rowCount = useMemo(() => Math.ceil(animals.length / columnCount), [animals.length, columnCount]);
    const rowHeight = CARD_HEIGHT + CARD_GAP;

    // Se poucos animais, não virtualiza
    if (animals.length <= VIRTUALIZATION_THRESHOLD) {
        return (
            <div 
                ref={containerRef}
                className="grid gap-3"
                style={{
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
            >
                {animals.map((animal) => (
                    <div key={animal.id}>
                        {renderCard({
                            animal,
                            onSelect: () => onSelectAnimal(animal),
                            onQuickWeight: onQuickWeight ? () => onQuickWeight(animal) : undefined,
                            onQuickMedication: onQuickMedication ? () => onQuickMedication(animal) : undefined,
                            onLongPress: onLongPress ? () => onLongPress(animal) : undefined,
                        })}
                    </div>
                ))}
            </div>
        );
    }

    // Componente de célula virtualizado
    const Cell = useCallback(({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
        const index = rowIndex * columnCount + columnIndex;
        if (index >= animals.length) {
            return null;
        }

        const animal = animals[index];
        
        // Ajusta estilo para incluir gap
        const adjustedStyle: React.CSSProperties = {
            ...style,
            left: Number(style.left) + CARD_GAP / 2,
            top: Number(style.top) + CARD_GAP / 2,
            width: Number(style.width) - CARD_GAP,
            height: Number(style.height) - CARD_GAP,
            padding: 0,
        };

        return (
            <div style={adjustedStyle}>
                {renderCard({
                    animal,
                    onSelect: () => onSelectAnimal(animal),
                    onQuickWeight: onQuickWeight ? () => onQuickWeight(animal) : undefined,
                    onQuickMedication: onQuickMedication ? () => onQuickMedication(animal) : undefined,
                    onLongPress: onLongPress ? () => onLongPress(animal) : undefined,
                })}
            </div>
        );
    }, [animals, columnCount, onSelectAnimal, onQuickWeight, onQuickMedication, onLongPress, renderCard]);

    // Altura do grid (máximo 80vh)
    const gridHeight = Math.min(rowCount * rowHeight, windowHeight * 0.8);

    return (
        <div ref={containerRef} className="w-full">
            <FixedSizeGrid
                className="scrollbar-thin scrollbar-thumb-base-600 scrollbar-track-base-800"
                columnCount={columnCount}
                columnWidth={columnWidth + CARD_GAP}
                height={gridHeight}
                rowCount={rowCount}
                rowHeight={rowHeight}
                width={containerWidth}
                overscanRowCount={GRID_OVERSCAN_ROWS}
                itemKey={({ columnIndex, rowIndex }) => {
                    const index = rowIndex * columnCount + columnIndex;
                    return index < animals.length ? animals[index].id : `empty-${rowIndex}-${columnIndex}`;
                }}
            >
                {Cell}
            </FixedSizeGrid>
            
            {/* Indicador de contagem */}
            <div className="mt-2 text-center text-sm text-gray-500">
                Mostrando {animals.length} animais (virtualizado)
            </div>
        </div>
    );
};

export default VirtualizedAnimalGrid;

// Hook auxiliar para usar virtualização condicionalmente
export const useVirtualization = (itemCount: number) => {
    return {
        shouldVirtualize: itemCount > VIRTUALIZATION_THRESHOLD,
        threshold: VIRTUALIZATION_THRESHOLD,
    };
};
