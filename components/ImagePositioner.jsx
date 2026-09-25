import React, { useRef, useState, useEffect } from 'react';
import { Upload, Move, ZoomIn, RotateCcw, Image as ImageIcon } from 'lucide-react';

const ImagePositioner = ({
    imageUrl,
    positionX = 50,
    positionY = 50,
    zoom = 100,
    onPositionChange,
    onZoomChange,
    onUpload,
    isUploading = false,
    type = 'banner', // 'banner' or 'profile'
    label = 'Image',
    aspectRatio = type === 'profile' ? '1/1' : '16/9',
    className = '',
    containerClassName = ''
}) => {
    const containerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    // Internal default classes matching the original design
    const defaultContainerClasses = type === 'profile'
        ? 'rounded-full w-36 h-36 mx-auto'
        : 'rounded-xl h-44 w-full';

    // Clamp values to valid ranges
    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

    const handleMouseDown = (e) => {
        if (!imageUrl) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setStartPos({ x: positionX, y: positionY });
    };

    const handleTouchStart = (e) => {
        if (!imageUrl) return;
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({ x: touch.clientX, y: touch.clientY });
        setStartPos({ x: positionX, y: positionY });
    };

    useEffect(() => {
        const handleMove = (clientX, clientY) => {
            if (!isDragging || !containerRef.current) return;

            const container = containerRef.current;
            const bounds = container.getBoundingClientRect();

            // Calculate movement as percentage of container size
            // We divide by zoom to make movement feel 1:1 with cursor
            const zoomFactor = zoom / 100;
            const deltaX = ((dragStart.x - clientX) / bounds.width) * 100 / zoomFactor;
            const deltaY = ((dragStart.y - clientY) / bounds.height) * 100 / zoomFactor;

            const newX = clamp(startPos.x + deltaX, 0, 100);
            const newY = clamp(startPos.y + deltaY, 0, 100);

            onPositionChange(newX, newY);
        };

        const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
        const handleTouchMove = (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY);

        const handleEnd = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleEnd);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, dragStart, startPos, zoom, onPositionChange]);

    const handleWheel = (e) => {
        if (!imageUrl) return;
        e.preventDefault();
        // Zoom in on wheel up (negative deltaY), out on wheel down
        const delta = e.deltaY < 0 ? 5 : -5;
        const newZoom = clamp(zoom + delta, 100, 200);
        onZoomChange(newZoom);
    };

    const handleReset = () => {
        onPositionChange(50, 50);
        onZoomChange(100);
    };

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                    {type === 'profile' ? <ImageIcon size={16} /> : <ImageIcon size={16} />}
                    {label}
                </label>
                {imageUrl && (
                    <button
                        onClick={handleReset}
                        className="text-xs text-primary-gold hover:text-yellow-300 flex items-center gap-1 transition-colors"
                        title="Reset position and zoom"
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                )}
            </div>

            <div
                className={`
                    relative overflow-hidden bg-[#0f1318] border border-white/10 group
                    ${defaultContainerClasses}
                    ${containerClassName}
                    ${imageUrl ? 'cursor-move' : 'cursor-default'}
                `}
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onWheel={handleWheel}
            >
                {imageUrl ? (
                    <>
                        <img
                            src={imageUrl}
                            alt={label}
                            className={`w-full h-full object-cover pointer-events-none select-none transition-transform duration-75 ease-out`}
                            style={{
                                objectPosition: `${positionX}% ${positionY}%`,
                                transform: `scale(${zoom / 100})`,
                            }}
                        />
                        {/* Overlay helpers */}
                        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDragging ? 'opacity-0' : ''}`}>
                            <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-2">
                                <Move size={12} />
                                Drag to reposition
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-2 p-4 text-center">
                        <ImageIcon size={32} className="opacity-50" />
                        <span className="text-sm">No image selected</span>
                    </div>
                )}

                {/* Loading State */}
                {isUploading && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-primary-gold z-10 backdrop-blur-sm">
                        <div className="w-8 h-8 border-2 border-primary-gold border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-xs font-medium animate-pulse">Uploading...</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="space-y-3">
                {imageUrl && (
                    <div className="flex items-center gap-3 px-2">
                        <ZoomIn size={14} className="text-gray-400" />
                        <input
                            type="range"
                            min="100"
                            max="200"
                            value={zoom}
                            onChange={(e) => onZoomChange(Number(e.target.value))}
                            className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary-gold"
                            title={`Zoom: ${zoom}%`}
                        />
                        <span className="text-xs text-gray-400 w-8 text-right">{zoom}%</span>
                    </div>
                )}

                <div className="flex gap-2">
                    <label className={`
                        flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 
                        rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 
                        cursor-pointer text-sm font-medium transition-all
                        ${isUploading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                    `}>
                        <Upload size={16} />
                        {imageUrl ? 'Change Image' : 'Upload Image'}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={onUpload}
                            disabled={isUploading}
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default ImagePositioner;
