import { HiOutlineFolder } from "react-icons/hi";
import { HiOutlineArrowsUpDown } from "react-icons/hi2";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface GenericTableProps<T> {
  items: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  onRowDragStart?: (e: React.DragEvent, item: T) => void;
  onRowDragEnd?: (e: React.DragEvent, item: T) => void;
  onRowDragOver?: (e: React.DragEvent, item: T) => void;
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
}

export function GenericTable<T>({
  items,
  columns,
  isLoading,
  onRowClick,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
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
}: GenericTableProps<T>) {
  const onDropWithId = (e: React.DragEvent, item: T) => {
    e.preventDefault();
    onRowDrop?.(e, item);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <table className="w-full text-left text-body-md whitespace-nowrap border-separate border-spacing-0">
        <thead className="sticky top-0 z-20 bg-surface-container-low/95 backdrop-blur-sm">
          <tr className="bg-surface-container-low border-b border-outline-variant font-medium text-on-surface-variant uppercase tracking-wider text-label-sm font-mono">
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
                {onSelectAll && (
                  <td className="px-4 py-4.5 w-10">
                    <div className="flex items-center justify-center">
                      <div className="w-3.5 h-3.5 bg-surface-container-highest rounded-sm animate-pulse" />
                    </div>
                  </td>
                )}
                {columns.map((col, colIndex) => {
                  // Custom widths for different columns to simulate real content distribution
                  const widths = ["w-36 sm:w-56", "w-16", "w-28", "w-20", "w-24", "w-8"];
                  const widthClass = widths[colIndex % widths.length];
                  return (
                    <td
                      key={`skeleton-cell-${rowIndex}-${col.key}`}
                      className="px-4 py-4.5"
                    >
                      <div className="flex items-center gap-3">
                        {/* Mock icon on first column */}
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
              <td colSpan={columns.length + (onSelectAll ? 1 : 0)}>
                <div className="py-24 text-center">
                  <div className="w-12 h-12 bg-surface-container text-on-surface-variant rounded flex items-center justify-center mx-auto mb-4 border border-outline-variant">
                    {emptyIcon || <HiOutlineFolder size={22} />}
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
                <tr
                  key={id}
                  onClick={() => onRowClick?.(item)}
                  draggable={!!onRowDragStart}
                  onDragStart={
                    onRowDragStart ? (e) => onRowDragStart(e, item) : undefined
                  }
                  onDragEnd={
                    onRowDragEnd ? (e) => onRowDragEnd(e, item) : undefined
                  }
                  onDragOver={
                    onRowDragOver ? (e) => onRowDragOver(e, item) : undefined
                  }
                  onDrop={onRowDrop ? (e) => onDropWithId(e, item) : undefined}
                  className={`group cursor-pointer transition-all hover:bg-surface-container-highest/20 border-l-2 border-l-transparent
                    ${isSelected ? "bg-surface-container border-l-primary" : ""}`}
                >
                  {onToggleSelection && (
                    <td
                      className="px-4 py-3 w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelection(id)}
                          className="w-3.5 h-3.5 rounded-sm border-outline text-primary focus:ring-primary cursor-pointer"
                        />
                      </div>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={`${id}-${col.key}`}
                      className={`px-4 py-3 text-on-surface-variant text-body-md ${col.className || ""}`}
                    >
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
