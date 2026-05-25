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
    <div className="flex-1 min-h-0">
      <table className="w-full  text-left text-sm whitespace-nowrap border-separate border-spacing-0">
        <thead className="sticky top-0 z-20 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
          <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">
            {onSelectAll && (
              <th className="px-5 py-3 w-10">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onSelectAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-5 py-3 ${col.sortable ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors select-none group" : ""} ${col.headerClassName || ""}`}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <div className="flex items-center gap-2">
                  {col.header}
                  {col.sortable && (
                    <HiOutlineArrowsUpDown
                      className={`w-3 h-3 transition-opacity ${sortConfig?.key === col.key ? "opacity-100" : "opacity-30 group-hover:opacity-100"}`}
                    />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length + (onSelectAll ? 1 : 0)}>
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 font-medium text-xs uppercase tracking-widest">
                    Loading...
                  </p>
                </div>
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onSelectAll ? 1 : 0)}>
                <div className="py-24 text-center">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-slate-800 text-gray-300 dark:text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-slate-700">
                    {emptyIcon || <HiOutlineFolder size={24} />}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {emptyMessage}
                  </h3>
                  <p className="text-gray-400 dark:text-slate-500 mt-1 text-xs font-medium">
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
                  className={`group cursor-pointer transition-all hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 border-l-4 border-l-transparent
                    ${isSelected ? "bg-indigo-50/60 dark:bg-indigo-500/10 border-l-indigo-300 dark:border-l-indigo-500" : ""}`}
                >
                  {onToggleSelection && (
                    <td
                      className="px-5 py-3 w-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelection(id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={`${id}-${col.key}`}
                      className={`px-5 py-3 text-gray-600 dark:text-slate-300 ${col.className || ""}`}
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
