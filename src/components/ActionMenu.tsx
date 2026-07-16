import { ReactNode, useState } from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";

export interface ActionMenuItem {
  /** Icon rendered on the left of the item. */
  icon: ReactNode;
  /** Text label of the item. */
  label: ReactNode;
  /** Handler invoked when the item is clicked (menu closes automatically). */
  onClick: () => void;
  /** Use the destructive (error) styling. */
  danger?: boolean;
  /** Render a separator line above this item. */
  separatorBefore?: boolean;
  /** Hide this item from the menu. */
  hidden?: boolean;
}

interface ActionMenuProps {
  /** Items shown in the dropdown. */
  items: ActionMenuItem[];
  /** Tooltip for the trigger button. */
  tooltip?: string;
  /**
   * Controlled open state. When provided (together with `onOpenChange`) the
   * parent owns the open/close logic — useful to guarantee a single menu open
   * across a table. When omitted the menu manages its own state.
   */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Reusable "three dots" (kebab) menu: a trigger button that opens a dropdown
 * with a list of actions. Closes on outside click.
 */
export function ActionMenu({ items, tooltip, isOpen, onOpenChange }: ActionMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = isOpen !== undefined;
  const open = controlled ? isOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <div className="relative flex justify-end" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 hover:bg-surface-container-highest rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
        title={tooltip}
      >
        <HiOutlineDotsVertical className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-highest border border-outline-variant rounded-md shadow-2xl z-50 py-1 text-body-md text-left animate-in fade-in slide-in-from-top-1.5 duration-100 ease-out">
            {visibleItems.map((item, idx) => (
              <div key={idx}>
                {item.separatorBefore && (
                  <div className="border-t border-outline-variant/30 my-1" />
                )}
                <button
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={
                    item.danger
                      ? "w-full px-4 py-2 hover:bg-error-container/20 hover:text-error flex items-center gap-2.5 text-error/80 text-left transition-colors cursor-pointer"
                      : "w-full px-4 py-2 hover:bg-surface-container flex items-center gap-2.5 text-on-surface text-left transition-colors cursor-pointer"
                  }
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
