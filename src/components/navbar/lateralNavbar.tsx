import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import NavItem from "./navItem";
import { HiChevronDown, HiChevronRight } from "react-icons/hi";

interface LateralNavbarProps {
  items: NavItem[];
  logo?: React.ReactNode;
  footer?: React.ReactNode;
}

export default function LateralNavbar({ items, logo, footer }: LateralNavbarProps) {
  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col h-full shadow-sm transition-colors duration-300">
      {/* Logo Section */}
      {logo && (
        <div className="p-6 border-b border-gray-100 dark:border-slate-800">
          {logo}
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => (
          <NavItemComponent key={item.name} item={item} />
        ))}
      </nav>

      {/* Footer Section */}
      {footer && (
        <div className="p-4 border-t border-gray-100 dark:border-slate-800">
          {footer}
        </div>
      )}
    </aside>
  );
}

function NavItemComponent({ item }: { item: NavItem }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if this specific item is active (handling both path and search params)
  const itemFullTarget = item.path;
  const currentFullUrl = location.pathname + location.search;

  // Exact match for the active state
  const isActive = currentFullUrl === itemFullTarget || (location.pathname === itemFullTarget && !location.search);

  // Auto-expand if a child is active
  useEffect(() => {
    const checkChildren = (children?: NavItem[]): boolean => {
      if (!children) return false;
      return children.some(child => {
        const isChildActive = (location.pathname + location.search) === child.path;
        return isChildActive || checkChildren(child.children);
      });
    };

    if (checkChildren(item.children)) {
      setIsExpanded(true);
    }
  }, [location.pathname, location.search, item.children]);

  if (!item.isLink) {
    return (
      <div className="px-4 py-2 mt-4 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
        {item.name}
      </div>
    );
  }

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center group">
        <NavLink
          to={item.path}
          className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
            ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-500/20"
            : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-100"
            }`}
        >
          {item.icon && (
            <span className="text-xl opacity-70">
              <item.icon />
            </span>
          )}
          <span className="truncate flex-1">{item.name}</span>
          {item.badge && (
            <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {item.badge}
            </span>
          )}
        </NavLink>

        {hasChildren && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={`p-1.5 mr-1 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 ${isExpanded ? 'rotate-0' : ''}`}
          >
            {isExpanded ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Recursive children rendering with collapse animation */}
      {hasChildren && isExpanded && (
        <div className="ml-6 space-y-1 border-l border-gray-100 dark:border-slate-800 pl-2 animate-in slide-in-from-top-1 duration-200">
          {item.children!.map((child) => (
            <NavItemComponent key={child.name + child.path} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}
