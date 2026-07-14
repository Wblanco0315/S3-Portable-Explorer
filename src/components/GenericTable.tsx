import { HiOutlineSelector } from "react-icons/hi";
import { FolderIcon } from "./FolderIcon";
import { HiOutlineArrowsUpDown } from "react-icons/hi2";
import { useDraggable, useDroppable } from "@dnd-kit/core";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface GenericTableRowProps<T> {
  item: T;
  id: string | number;
  isSelected?: boolean;
  onRowClick?: (item: T) => void;
  onToggleSelection?: (id: string | number) => void;
  columns: Column<T>[];
  rowClassName?: (item: T) => string;
  dndEnabled?: boolean;
  onRowDragStart?: (e: React.DragEvent, item: T) => void;
  onRowDragEnd?: (e: React.DragEvent, item: T) => void;
  onRowDragOver?: (e: React.DragEvent, item: T) => void;
  onRowDragLeave?: (e: React.DragEvent, item: T) => void;
  onRowDrop?: (e: React.DragEvent, item: T) => void;
  draggedItem?: any | null;
  isValidDropTarget?: (draggedItem: any, targetItem: T) => boolean;
  movingRowId?: string | number | null;
  moveHereLabel?: string;
}

function GenericTableRow<T>({
  item,
  id,
  isSelected,
  onRowClick,
  onToggleSelection,
  columns,
  rowClassName,
  dndEnabled,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  draggedItem,
  isValidDropTarget,
  movingRowId,
  moveHereLabel,
}: GenericTableRowProps<T>) {
  // @dnd-kit hooks
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `drag-${id}`,
    data: item as any,
  });

  const isFolder = (item as any).type === "folder";
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${id}`,
    data: item as any,
    disabled: !isFolder,
  });

  const onDropWithId = (e: React.DragEvent, item: T) => {
    e.preventDefault();
    onRowDrop?.(e, item);
  };

  const isDraggingActive = !!draggedItem;
  const isThisItemDragged = isDraggingActive && draggedItem.id === (item as any).id && draggedItem.type === (item as any).type;
  const isValidTarget = isDraggingActive && isValidDropTarget?.(draggedItem, item);
  const isMoving = id === movingRowId;

  let dndRowClass = "";
  if (isDraggingActive) {
    if (isThisItemDragged) {
      dndRowClass = "opacity-20 cursor-grabbing scale-[0.98]";
    } else if (isValidTarget) {
      if (isOver) {
        dndRowClass = "bg-primary/20 border-l-2 !border-l-primary border-l-solid scale-[1.02] shadow-lg shadow-primary/10 z-10 font-semibold";
      } else {
        dndRowClass = "bg-primary/5 border-l-2 border-l-dashed border-l-primary/40 opacity-90";
      }
    } else {
      dndRowClass = "opacity-25 cursor-not-allowed pointer-events-none";
    }
  }

  const customClass = rowClassName ? rowClassName(item) : "";
  const movingClass = isMoving
    ? "opacity-0 -translate-x-12 scale-y-95 pointer-events-none transition-all duration-300 ease-out"
    : "";

  return (
    <tr
      ref={dndEnabled ? setDropRef : undefined}
      onClick={() => onRowClick?.(item)}
      draggable={!dndEnabled && !!onRowDragStart}
      onDragStart={
        !dndEnabled && onRowDragStart ? (e) => onRowDragStart(e, item) : undefined
      }
      onDragEnd={
        !dndEnabled && onRowDragEnd ? (e) => onRowDragEnd(e, item) : undefined
      }
      onDragOver={
        !dndEnabled && onRowDragOver ? (e) => onRowDragOver(e, item) : undefined
      }
      onDragLeave={
        !dndEnabled && onRowDragLeave ? (e) => onRowDragLeave(e, item) : undefined
      }
      onDrop={!dndEnabled && onRowDrop ? (e) => onDropWithId(e, item) : undefined}
      className={`relative group cursor-pointer transition-all duration-200 ease-in-out hover:bg-surface-container-highest/20 border-l-2 border-l-transparent
        ${isSelected ? "bg-surface-container border-l-primary" : ""}
        ${isDragging ? "opacity-30 cursor-grabbing" : ""}
        ${customClass} ${dndRowClass} ${movingClass}`}
    >
      {dndEnabled && (
        <td
          ref={setDragRef}
          className={`px-2 py-3 w-8 text-on-surface-variant/30 hover:text-primary active:text-primary transition-all duration-300 cursor-grab active:cursor-grabbing
            ${isMoving ? "max-h-0 !py-0 line-height-0 text-[0px] border-b-0 overflow-hidden pointer-events-none" : ""}`}
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
        >
          {!isMoving && (
            <div className="flex items-center justify-center">
              <HiOutlineSelector className="w-4 h-4" />
            </div>
          )}
        </td>
      )}
      {onToggleSelection && (
        <td
          className={`px-4 py-3 w-10 transition-all duration-300
            ${isMoving ? "max-h-0 !py-0 line-height-0 text-[0px] border-b-0 overflow-hidden pointer-events-none" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          {!isMoving && (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelection(id)}
                className="w-3.5 h-3.5 rounded-sm border-outline text-primary focus:ring-primary cursor-pointer"
              />
            </div>
          )}
        </td>
      )}
      {columns.map((col) => (
        <td
          key={`${id}-${col.key}`}
          className={`px-4 py-3 text-on-surface-variant text-body-md transition-all duration-300 ${col.className || ""}
            ${isMoving ? "max-h-0 !py-0 line-height-0 text-[0px] border-b-0 overflow-hidden pointer-events-none" : ""}`}
        >
          {!isMoving && (
            col.key === "name" ? (
              <div className="flex items-center gap-3.5">
                {col.render ? col.render(item) : (item as any)[col.key]}
                {isOver && moveHereLabel && (
                  <span className="shrink-0 bg-primary text-on-primary text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm select-none pointer-events-none uppercase tracking-wider font-mono animate-in fade-in zoom-in-95 duration-150">
                    {moveHereLabel}
                  </span>
                )}
              </div>
            ) : (
              col.render ? col.render(item) : (item as any)[col.key]
            )
          )}
        </td>
      ))}
    </tr>
  );
}

interface GenericTableProps<T> {
  items: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  onRowDragStart?: (e: React.DragEvent, item: T) => void;
  onRowDragEnd?: (e: React.DragEvent, item: T) => void;
  onRowDragOver?: (e: React.DragEvent, item: T) => void;
  onRowDragLeave?: (e: React.DragEvent, item: T) => void;
  onRowDrop?: (e: React.DragEvent, item: T) => void;
  selectedIds?: Set<string | number>;
  onToggleSelection?: (id: string | number) => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  sortConfig?: { key: string; direction: "asc" | "desc" };
  onSort?: (key: any) => void;
  rowKey: (item: T) => string | number;
  rowClassName?: (item: T) => string;
  dndEnabled?: boolean;
  draggedItem?: any | null;
  isValidDropTarget?: (draggedItem: any, targetItem: T) => boolean;
  movingRowId?: string | number | null;
  moveHereLabel?: string;
}

export function GenericTable<T>({
  items,
  columns,
  isLoading,
  onRowClick,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  isAllSelected,
  emptyMessage = "No items found",
  emptyIcon,
  sortConfig,
  onSort,
  rowKey,
  rowClassName,
  dndEnabled,
  draggedItem,
  isValidDropTarget,
  movingRowId,
  moveHereLabel,
}: GenericTableProps<T>) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <table className="w-full text-left text-body-md whitespace-nowrap border-separate border-spacing-0">
        <thead className="sticky top-0 z-20 bg-surface-container-low/95 backdrop-blur-sm">
          <tr className="bg-surface-container-low border-b border-outline-variant font-medium text-on-surface-variant uppercase tracking-wider text-label-sm font-mono">
            {dndEnabled && (
              <th className="px-2 py-3 w-8"></th>
            )}
            {onSelectAll && (
              <th className="px-4 py-3 w-10">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onSelectAll}
                    className="w-3.5 h-3.5 rounded-sm border-outline text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 ${col.sortable ? "cursor-pointer hover:text-primary transition-colors select-none group" : ""} ${col.headerClassName || ""}`}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.header}
                  {col.sortable && (
                    <HiOutlineArrowsUpDown
                      className={`w-3.5 h-3.5 transition-opacity ${sortConfig?.key === col.key ? "opacity-100" : "opacity-30 group-hover:opacity-100"}`}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, rowIndex) => (
              <tr key={`skeleton-row-${rowIndex}`} className="border-b border-outline-variant/10">
                {dndEnabled && (
                  <td className="px-2 py-4.5 w-8">
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 bg-surface-container-highest rounded animate-pulse" />
                    </div>
                  </td>
                )}
                {onSelectAll && (
                  <td className="px-4 py-4.5 w-10">
                    <div className="flex items-center justify-center">
                      <div className="w-3.5 h-3.5 bg-surface-container-highest rounded-sm animate-pulse" />
                    </div>
                  </td>
                )}
                {columns.map((col, colIndex) => {
                  const widths = ["w-36 sm:w-56", "w-16", "w-28", "w-20", "w-24", "w-8"];
                  const widthClass = widths[colIndex % widths.length];
                  return (
                    <td
                      key={`skeleton-cell-${rowIndex}-${col.key}`}
                      className="px-4 py-4.5"
                    >
                      <div className="flex items-center gap-3">
                        {colIndex === 0 && (
                          <div className="w-[22px] h-[22px] bg-surface-container-highest rounded-sm animate-pulse shrink-0" />
                        )}
                        <div className={`h-4 bg-surface-container-highest rounded animate-pulse ${widthClass}`} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectAll ? 1 : 0) + (dndEnabled ? 1 : 0)}>
                <div className="py-24 text-center">
                  <div className="w-12 h-12 bg-surface-container text-on-surface-variant rounded flex items-center justify-center mx-auto mb-4 border border-outline-variant">
                    {emptyIcon || <FolderIcon size={22} />}
                  </div>
                  <h3 className="text-headline-md text-on-surface font-semibold">
                    {emptyMessage}
                  </h3>
                  <p className="text-on-surface-variant mt-1 text-body-md">
                    Try refreshing or adjusting your search.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const id = rowKey(item);
              const isSelected = selectedIds?.has(id);

              return (
                <GenericTableRow
                  key={id}
                  item={item}
                  id={id}
                  isSelected={isSelected}
                  onRowClick={onRowClick}
                  onToggleSelection={onToggleSelection}
                  columns={columns}
                  rowClassName={rowClassName}
                  dndEnabled={dndEnabled}
                  onRowDragStart={onRowDragStart}
                  onRowDragEnd={onRowDragEnd}
                  onRowDragOver={onRowDragOver}
                  onRowDragLeave={onRowDragLeave}
                  onRowDrop={onRowDrop}
                  draggedItem={draggedItem}
                  isValidDropTarget={isValidDropTarget}
                  movingRowId={movingRowId}
                  moveHereLabel={moveHereLabel}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
