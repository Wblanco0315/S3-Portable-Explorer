import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft } from "react-icons/hi";
import { useDroppable } from "@dnd-kit/core";

export interface BreadcrumbItem {
    label: string;
    path?: string;
    onClick?: () => void;
    active?: boolean;
    // DnD props (optional)
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent) => void;
    isDropTarget?: boolean;
    // For @dnd-kit:
    dndId?: string;
    dndDisabled?: boolean;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    showBackButton?: boolean;
    onBackClick?: () => void;
    className?: string;
    isDraggingActive?: boolean;
    moveHereLabel?: string;
}

interface BreadcrumbSegmentProps {
    item: BreadcrumbItem;
    idx: number;
    isDraggingActive?: boolean;
    moveHereLabel?: string;
}

const BreadcrumbSegment: React.FC<BreadcrumbSegmentProps> = ({ item, idx, isDraggingActive, moveHereLabel }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: item.dndId || `breadcrumb-dummy-${idx}`,
        disabled: !item.dndId || item.dndDisabled,
    });

    const isHighlight = item.isDropTarget || isOver;
    const showDropZoneCue = isDraggingActive && !item.dndDisabled;

    return (
        <span className="relative inline-block">
            <span
                ref={item.dndId ? setNodeRef : undefined}
                onClick={item.dndDisabled ? undefined : item.onClick}
                className={`cursor-pointer px-1.5 py-0.5 rounded border border-transparent transition-all duration-200 ease-in-out
                    ${item.active ? 'text-primary bg-surface-container-high border-outline-variant font-bold' : 'hover:bg-surface-container-highest/50 hover:text-on-surface'}
                    ${isHighlight ? 'bg-primary/20 text-primary border border-primary font-bold scale-[1.03]' : ''}
                    ${showDropZoneCue && !isHighlight ? 'border-dashed border-primary bg-primary/5' : ''}
                    ${isDraggingActive && item.dndDisabled ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}
                `}
            >
                {item.label}
            </span>
            {isOver && moveHereLabel && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 duration-100 z-50 pointer-events-none uppercase tracking-wider font-mono">
                    {moveHereLabel}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary" />
                </div>
            )}
        </span>
    );
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
    items, 
    showBackButton = true, 
    onBackClick,
    className = "",
    isDraggingActive,
    moveHereLabel
}) => {
    const navigate = useNavigate();

    const handleBackClick = () => {
        if (onBackClick) {
            onBackClick();
            return;
        }

        if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            const parentItem = items.length > 1 ? items[items.length - 2] : null;
            if (parentItem) {
                if (parentItem.path) {
                    navigate(parentItem.path);
                } else if (parentItem.onClick) {
                    parentItem.onClick();
                } else {
                    navigate("/");
                }
            } else {
                navigate("/");
            }
        }
    };

    return (
        <div className={`flex items-center gap-2 text-label-sm font-medium text-on-surface-variant mb-5 bg-surface-container-low p-2 rounded border border-outline-variant w-fit ${className}`}>
            {showBackButton && (
                <button 
                    onClick={handleBackClick} 
                    className="p-1 hover:bg-surface-container-highest rounded transition-colors text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                    <HiOutlineArrowLeft size={14} />
                </button>
            )}
            
            <div className="flex items-center gap-1.5 uppercase tracking-wider font-mono">
                {items.map((item, idx) => (
                    <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-outline select-none">/</span>}
                        
                        {item.path ? (
                            <Link
                                to={item.path}
                                className={`px-1.5 py-0.5 rounded border border-transparent transition-all hover:bg-surface-container-highest/50 hover:text-on-surface ${item.active ? 'text-primary bg-surface-container-high border-outline-variant font-bold' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ) : item.dndId ? (
                            <BreadcrumbSegment item={item} idx={idx} isDraggingActive={isDraggingActive} moveHereLabel={moveHereLabel} />
                        ) : (
                            <span
                                onClick={item.onClick}
                                onDragOver={item.onDragOver}
                                onDragLeave={item.onDragLeave}
                                onDrop={item.onDrop}
                                className={`cursor-pointer px-1.5 py-0.5 rounded border border-transparent transition-all 
                                    ${item.active ? 'text-primary bg-surface-container-high border-outline-variant font-bold' : 'hover:bg-surface-container-highest/50 hover:text-on-surface'}
                                    ${item.isDropTarget ? 'bg-primary text-on-primary scale-105' : ''}
                                `}
                            >
                                {item.label}
                            </span>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
