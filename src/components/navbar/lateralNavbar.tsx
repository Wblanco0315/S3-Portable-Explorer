import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import NavItem from "./navItem";
import { HiChevronDown, HiChevronRight } from "react-icons/hi";

interface LateralNavbarProps {
  items: NavItem[];
  logo?: React.ReactNode;
  footer?: React.ReactNode;
}

export default function LateralNavbar({ items, logo, footer }: LateralNavbarProps) {
  return (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant flex flex-col h-full transition-colors duration-300">
      {/* Logo Section */}
      {logo && (
        <div className="p-6 border-b border-outline-variant">
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
        <div className="p-4 border-t border-outline-variant">
          {footer}
        </div>
      )}
    </aside>
  );
}

function NavItemComponent({ item }: { item: NavItem }) {
  const location = useLocation();
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
      <div className="px-4 py-2 mt-4 text-label-sm text-on-surface-variant uppercase tracking-wider font-mono">
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
          className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-body-md rounded transition-all duration-200 border border-transparent ${isActive
            ? "bg-surface-container-high border-outline-variant text-primary"
            : "text-on-surface-variant hover:bg-surface-container-highest/50 hover:text-on-surface"
            }`}
        >
          {item.icon && (
            <span className="text-xl opacity-75">
              <item.icon />
            </span>
          )}
          <span className="truncate flex-1">{item.name}</span>
          {item.badge && (
            <span className="bg-primary-container text-on-primary-container text-label-sm px-1.5 py-0.5 rounded-sm font-medium">
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
            className="p-1.5 mr-1 rounded transition-colors hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            {isExpanded ? <HiChevronDown className="w-4 h-4" /> : <HiChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Recursive children rendering with collapse animation */}
      {hasChildren && isExpanded && (
        <div className="ml-6 space-y-1 border-l border-outline-variant pl-2 animate-in slide-in-from-top-1 duration-200">
          {item.children!.map((child) => (
            <NavItemComponent key={child.name + child.path} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}
