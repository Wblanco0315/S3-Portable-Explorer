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
        <div className={`flex items-center gap-2 text-[11px] font-bold text-gray-400 dark:text-slate-500 mb-5 bg-white dark:bg-slate-900 p-2 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm w-fit ${className}`}>
            {showBackButton && (
                <button 
                    onClick={onBackClick || (() => navigate(-1))} 
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors text-gray-500 dark:text-slate-400"
                >
                    <HiOutlineArrowLeft size={14} />
                </button>
            )}
            
            <div className="flex items-center gap-1.5 uppercase tracking-wider">
                {items.map((item, idx) => (
                    <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-gray-300 select-none">/</span>}
                        
                        {item.path ? (
                            <Link
                                to={item.path}
                                className={`px-1.5 py-0.5 rounded transition-all hover:bg-gray-100 dark:hover:bg-slate-800 ${item.active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span
                                onClick={item.onClick}
                                onDragOver={item.onDragOver}
                                onDragLeave={item.onDragLeave}
                                onDrop={item.onDrop}
                                className={`cursor-pointer px-1.5 py-0.5 rounded transition-all 
                                    ${item.active ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}
                                    ${item.isDropTarget ? 'bg-indigo-600 text-white shadow-lg scale-110' : ''}
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
