import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineArrowLeft } from "react-icons/hi";

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
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    showBackButton?: boolean;
    onBackClick?: () => void;
    className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
    items, 
    showBackButton = true, 
    onBackClick,
    className = "" 
}) => {
    const navigate = useNavigate();

    return (
        <div className={`flex items-center gap-2 text-label-sm font-medium text-on-surface-variant mb-5 bg-surface-container-low p-2 rounded border border-outline-variant w-fit ${className}`}>
            {showBackButton && (
                <button 
                    onClick={onBackClick || (() => navigate(-1))} 
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
