import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon } from './common/Icons';

interface ImageCropEditorProps {
    imageFile: File;
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

interface Position {
    x: number;
    y: number;
}

const ImageCropEditor: React.FC<ImageCropEditorProps> = ({
    imageFile,
    onCropComplete,
    onCancel
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [imageLoaded, setImageLoaded] = useState(false);

    // Transform state
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
    const [positionStart, setPositionStart] = useState<Position>({ x: 0, y: 0 });

    // Pinch zoom state
    const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
    const [initialScale, setInitialScale] = useState(1);

    // Image dimensions
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Load image
    useEffect(() => {
        const url = URL.createObjectURL(imageFile);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    // Handle image load
    const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        imageRef.current = img;
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setImageLoaded(true);

        // Calculate initial scale to fill the crop area
        if (containerRef.current) {
            const container = containerRef.current;
            const cropSize = Math.min(container.clientWidth, container.clientHeight) * 0.85;
            setContainerSize({ width: container.clientWidth, height: container.clientHeight });

            const scaleX = cropSize / img.naturalWidth;
            const scaleY = cropSize / img.naturalHeight;
            const initialScale = Math.max(scaleX, scaleY);
            setScale(initialScale);
        }
    }, []);

    // Crop size memoizado baseado no container
    const cropSize = useMemo(() => {
        if (containerSize.width === 0) return 280;
        return Math.min(containerSize.width, containerSize.height) * 0.85;
    }, [containerSize]);

    // Min scale para garantir que imagem cubra o crop
    const minScale = useMemo(() => {
        if (imageDimensions.width === 0 || imageDimensions.height === 0) return 0.1;
        return cropSize / Math.min(imageDimensions.width, imageDimensions.height);
    }, [cropSize, imageDimensions]);

    // Constrain position to keep image covering the crop area
    const constrainPosition = useCallback((pos: Position, currentScale: number): Position => {
        const scaledWidth = imageDimensions.width * currentScale;
        const scaledHeight = imageDimensions.height * currentScale;

        const minX = (cropSize / 2) - scaledWidth;
        const maxX = scaledWidth - (cropSize / 2);
        const minY = (cropSize / 2) - scaledHeight;
        const maxY = scaledHeight - (cropSize / 2);

        return {
            x: Math.max(minX, Math.min(maxX, pos.x)),
            y: Math.max(minY, Math.min(maxY, pos.y))
        };
    }, [imageDimensions, cropSize]);

    // Mouse/Touch handlers
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'touch') return; // Handle touch separately
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setPositionStart(position);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [position]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || e.pointerType === 'touch') return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const newPosition = constrainPosition({
            x: positionStart.x + dx,
            y: positionStart.y + dy
        }, scale);
        setPosition(newPosition);
    }, [isDragging, dragStart, positionStart, scale, constrainPosition]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (e.pointerType === 'touch') return;
        setIsDragging(false);
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }, []);

    // Touch handlers for mobile
    const getTouchDistance = (touches: React.TouchList): number => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: React.TouchList): Position => {
        if (touches.length < 2) {
            return { x: touches[0].clientX, y: touches[0].clientY };
        }
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    };

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
            setPositionStart(position);
        } else if (e.touches.length === 2) {
            setInitialPinchDistance(getTouchDistance(e.touches));
            setInitialScale(scale);
            setDragStart(getTouchCenter(e.touches));
            setPositionStart(position);
        }
    }, [position, scale]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - dragStart.x;
            const dy = e.touches[0].clientY - dragStart.y;
            const newPosition = constrainPosition({
                x: positionStart.x + dx,
                y: positionStart.y + dy
            }, scale);
            setPosition(newPosition);
        } else if (e.touches.length === 2 && initialPinchDistance !== null) {
            const newDistance = getTouchDistance(e.touches);
            const scaleChange = newDistance / initialPinchDistance;
            const newScale = Math.max(minScale, Math.min(5, initialScale * scaleChange));
            setScale(newScale);

            // Adjust position during zoom
            const center = getTouchCenter(e.touches);
            const dx = center.x - dragStart.x;
            const dy = center.y - dragStart.y;
            const newPosition = constrainPosition({
                x: positionStart.x + dx,
                y: positionStart.y + dy
            }, newScale);
            setPosition(newPosition);
        }
    }, [isDragging, dragStart, positionStart, scale, initialPinchDistance, initialScale, minScale, constrainPosition]);

    const handleTouchEnd = useCallback(() => {
        setIsDragging(false);
        setInitialPinchDistance(null);
    }, []);

    // Wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(minScale, Math.min(5, scale * delta));
        setScale(newScale);
        setPosition(prev => constrainPosition(prev, newScale));
    }, [scale, minScale, constrainPosition]);

    // Zoom buttons
    const handleZoomIn = useCallback(() => {
        const newScale = Math.min(5, scale * 1.2);
        setScale(newScale);
        setPosition(prev => constrainPosition(prev, newScale));
    }, [scale, constrainPosition]);

    const handleZoomOut = useCallback(() => {
        const newScale = Math.max(minScale, scale * 0.8);
        setScale(newScale);
        setPosition(prev => constrainPosition(prev, newScale));
    }, [scale, minScale, constrainPosition]);

    // Crop and save
    const handleCrop = useCallback(async () => {
        if (!imageRef.current) return;

        const outputSize = 800; // Output resolution

        // Calculate the crop region in original image coordinates
        const scaledWidth = imageDimensions.width * scale;
        const scaledHeight = imageDimensions.height * scale;

        // Center of container
        const centerX = containerSize.width / 2;
        const centerY = containerSize.height / 2;

        // Image position relative to center
        const imageLeft = centerX - (scaledWidth / 2) + position.x;
        const imageTop = centerY - (scaledHeight / 2) + position.y;

        // Crop area position
        const cropLeft = centerX - (cropSize / 2);
        const cropTop = centerY - (cropSize / 2);

        // Source coordinates in original image
        const srcX = (cropLeft - imageLeft) / scale;
        const srcY = (cropTop - imageTop) / scale;
        const srcSize = cropSize / scale;

        // Create canvas and crop
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            imageRef.current,
            srcX, srcY, srcSize, srcSize,
            0, 0, outputSize, outputSize
        );

        // Convert to blob - qualidade 0.85 já otimizada
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    onCropComplete(blob);
                }
            },
            'image/webp',
            0.85
        );
    }, [imageDimensions, scale, position, containerSize, cropSize, onCropComplete]);

    return createPortal(
        <div className="fixed inset-0 bg-black z-[100] flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-base-900 shrink-0">
                <button
                    onClick={onCancel}
                    className="text-white px-4 py-2 rounded hover:bg-base-700 transition-colors"
                >
                    Cancelar
                </button>
                <span className="text-white font-medium">Ajustar Foto</span>
                <button
                    onClick={handleCrop}
                    className="bg-brand-primary text-white px-4 py-2 rounded hover:bg-brand-primary-light transition-colors flex items-center gap-2"
                >
                    <CheckIcon className="w-5 h-5" />
                    Aplicar
                </button>
            </div>

            {/* Crop Area */}
            <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden touch-none select-none min-h-0"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                {/* Image */}
                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt="Preview"
                        onLoad={handleImageLoad}
                        className="absolute pointer-events-none"
                        style={{
                            left: '50%',
                            top: '50%',
                            transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            transformOrigin: 'center',
                            maxWidth: 'none',
                            maxHeight: 'none'
                        }}
                        draggable={false}
                    />
                )}

                {/* Crop overlay */}
                {imageLoaded && (
                    <>
                        {/* Crop border with shadow overlay */}
                        <div
                            className="absolute border-2 border-white rounded-lg pointer-events-none"
                            style={{
                                width: cropSize,
                                height: cropSize,
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
                            }}
                        >
                            {/* Grid lines */}
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                                {[...Array(9)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="border border-white/20"
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Zoom controls */}
            <div className="p-4 bg-base-900 flex items-center justify-center gap-6 shrink-0">
                <button
                    onClick={handleZoomOut}
                    className="w-12 h-12 rounded-full bg-base-700 text-white text-2xl flex items-center justify-center hover:bg-base-600 transition-colors"
                    title="Diminuir zoom"
                >
                    −
                </button>

                <div className="flex items-center gap-2 text-white/70 text-sm min-w-24 justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {Math.round(scale * 100)}%
                </div>

                <button
                    onClick={handleZoomIn}
                    className="w-12 h-12 rounded-full bg-base-700 text-white text-2xl flex items-center justify-center hover:bg-base-600 transition-colors"
                    title="Aumentar zoom"
                >
                    +
                </button>
            </div>

            {/* Instructions */}
            <div className="p-3 bg-base-800 text-center text-white/60 text-sm shrink-0">
                Arraste para posicionar • Pinça ou scroll para zoom
            </div>
        </div>,
        document.body
    );
};

export default ImageCropEditor;
