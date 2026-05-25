import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  HiOutlineFolder,
  HiOutlineLink,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineFolderAdd,
  HiOutlineDuplicate,
  HiOutlineCheck,
  HiOutlineExternalLink,
  HiOutlineArrowLeft,
  HiOutlineDownload,
  HiOutlineUpload,
} from "react-icons/hi";
import {
  listRoutes,
  listFolders,
  Route,
  FavoriteFolder,
  addFolder,
  removeRoute,
  removeFolder,
  updateRouteFolder,
  updateFolderParent,
  exportFavorites,
  importFavorites,
} from "../features/favorites/favoritesStore";
import { useRouteNavigator } from "../shared/hooks/useRouteNavigator";
import { GenericTable, Column } from "../components/GenericTable";
import { Breadcrumb } from "../components/Breadcrumb";

type Item = (Route | FavoriteFolder) & { type: "route" | "folder" };

export default function FavoritesPage() {
  const { navigateToRoute } = useRouteNavigator();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get("folder")
    ? parseInt(searchParams.get("folder")!)
    : null;

  const setCurrentFolderId = (id: number | null) => {
    if (id === null) {
      setSearchParams({});
    } else {
      setSearchParams({ folder: id.toString() });
    }
  };

  const [routes, setRoutes] = useState<Route[]>([]);
  const [folders, setFolders] = useState<FavoriteFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // DnD States
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [favs, flds] = await Promise.all([listRoutes(), listFolders()]);
      setRoutes(favs);
      setFolders(flds);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const displayItems = useMemo<Item[]>(() => {
    const fl = folders
      .filter(
        (f) =>
          f.parent_id === currentFolderId &&
          f.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .map((f) => ({ ...f, type: "folder" as const }));
    const rt = routes
      .filter(
        (r) =>
          r.folder_id === currentFolderId &&
          r.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .map((r) => ({ ...r, type: "route" as const }));
    return [...fl, ...rt];
  }, [folders, routes, currentFolderId, searchTerm]);

  const breadcrumbPath = useMemo(() => {
    const path: FavoriteFolder[] = [];
    let currId = currentFolderId;
    while (currId) {
      const f = folders.find((x) => x.id === currId);
      if (f) {
        path.unshift(f);
        currId = f.parent_id ?? null;
      } else break;
    }
    return path;
  }, [folders, currentFolderId]);

  // DnD Handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnd = () => {
    setDraggedId(null);
    setDropTargetId(null);
  };

  const onDragOver = (e: React.DragEvent, id: string, isFolder: boolean) => {
    e.preventDefault();
    if (draggedId === id) return;
    if (isFolder || id === "root" || id.startsWith("bc-")) {
      setDropTargetId(id);
      e.dataTransfer.dropEffect = "move";
    }
  };

  const onDragLeave = () => setDropTargetId(null);

  const onDrop = async (e: React.DragEvent, targetFolderId: number | null) => {
    e.preventDefault();
    const sourceCid = e.dataTransfer.getData("text/plain");
    if (!sourceCid) return;

    const [type, idStr] = sourceCid.split("-");
    const id = parseInt(idStr);

    if (type === "folder" && id === targetFolderId) return;

    setMovingId(sourceCid);
    try {
      if (type === "folder") await updateFolderParent(id, targetFolderId);
      else await updateRouteFolder(id, targetFolderId);
      await loadData();
    } catch (err) {
      console.error("Move failed", err);
    } finally {
      setMovingId(null);
      setDropTargetId(null);
    }
  };

  const toggleSelection = (cid: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(cid.toString())) next.delete(cid.toString());
    else next.add(cid.toString());
    setSelectedIds(next);
  };

  const handleNavigate = navigateToRoute;

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = async () => {
    try {
      const success = await exportFavorites();
      if (success) {
        alert("Favorites exported successfully!");
      }
    } catch (err: any) {
      console.error("Export failed", err);
      alert("Error exporting favorites: " + err.message);
    }
  };

  const handleImport = async () => {
    try {
      const success = await importFavorites();
      if (success) {
        alert("Favorites imported successfully!");
        await loadData();
      }
    } catch (err: any) {
      console.error("Import failed", err);
      alert("Error importing favorites: " + err.message);
    }
  };

  const columns: Column<Item>[] = [
    {
      key: "name",
      header: "Name",
      render: (item) => {
        const isFolder = item.type === "folder";
        const cid = `${item.type}-${item.id}`;
        const isOver = dropTargetId === cid;

        return (
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 transition-transform ${isFolder ? "text-amber-500 dark:text-amber-400/80" : "text-indigo-500 dark:text-indigo-400/80"} ${isOver ? "scale-110" : "group-hover:scale-110"}`}
            >
              {isFolder ? (
                <HiOutlineFolder size={22} />
              ) : (
                <HiOutlineLink size={22} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              {isFolder ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentFolderId(item.id!);
                  }}
                  className={`font-bold text-left hover:underline truncate transition-colors text-sm ${isOver ? "text-indigo-700 dark:text-indigo-400" : "text-gray-900 dark:text-slate-100"}`}
                >
                  {item.name}
                </button>
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate(item as Route);
                  }}
                  className="font-bold text-indigo-600 dark:text-indigo-400/80 hover:underline cursor-pointer truncate text-sm"
                >
                  {item.name}
                </span>
              )}
              {isOver && isFolder && (
                <div className="flex items-center gap-1 mt-0.5 animate-in slide-in-from-top-1">
                  <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider shadow-sm">
                    Drop to move
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      className:
        "text-gray-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest",
      render: (item) => (item.type === "folder" ? "Folder" : "Route"),
    },
    {
      key: "profile",
      header: "Profile",
      render: (item) =>
        item.type === "route" ? (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-md text-[9px] font-extrabold border border-gray-200 dark:border-slate-700 uppercase tracking-wider">
            {(item as Route).profile}
          </span>
        ) : (
          <span className="text-gray-200 dark:text-slate-800">—</span>
        ),
    },
    {
      key: "path",
      header: "S3 Path",
      className: "font-mono text-[10px] text-gray-400 dark:text-slate-500 max-w-xs truncate",
      render: (item) =>
        item.type === "route" ? (
          `s3://${(item as Route).bucket}/${(item as Route).prefix}`
        ) : (
          <span className="text-gray-200 dark:text-slate-800">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (item) => (
        <div
          className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {item.type === "route" && (
            <>
              <button
                onClick={() =>
                  handleCopy(
                    item.id!,
                    `s3://${(item as Route).bucket}/${(item as Route).prefix}`,
                  )
                }
                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all"
                title="Copy S3 URI"
              >
                {copiedId === item.id ? (
                  <HiOutlineCheck className="w-4 h-4 text-green-500" />
                ) : (
                  <HiOutlineDuplicate className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => handleNavigate(item as Route)}
                className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all"
                title="Go to path"
              >
                <HiOutlineExternalLink className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() =>
              item.type === "folder"
                ? removeFolder(item.id!).then(loadData)
                : removeRoute(item.id!).then(loadData)
            }
            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-slate-700 transition-all"
            title="Delete"
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-gray-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <div className="w-full mx-auto">
        <Breadcrumb
          items={[
            {
              label: "Amazon S3",
              onClick: () => setCurrentFolderId(null),
              active: !currentFolderId,
              onDragOver: (e) => onDragOver(e, "root", true),
              onDragLeave: onDragLeave,
              onDrop: (e) => onDrop(e, null),
              isDropTarget: dropTargetId === "root",
            },
            ...breadcrumbPath.map((f, idx) => ({
              label: f.name,
              onClick: () => setCurrentFolderId(f.id!),
              active: idx === breadcrumbPath.length - 1,
              onDragOver: (e: React.DragEvent) =>
                onDragOver(e, `bc-${f.id}`, true),
              onDragLeave: onDragLeave,
              onDrop: (e: React.DragEvent) => onDrop(e, f.id!),
              isDropTarget: dropTargetId === `bc-${f.id}`,
            })),
          ]}
        />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200/50 dark:border-indigo-500/20">
              <HiOutlineLink size={20} />
            </div>
            My Routes
          </h1>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
              title="Refresh"
            >
              <HiOutlineRefresh size={16} />
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Import JSON Collection"
            >
              <HiOutlineUpload size={18} className="text-gray-500 dark:text-slate-400" /> Import
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-300 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Export JSON Collection"
            >
              <HiOutlineDownload size={18} className="text-gray-500 dark:text-slate-400" /> Export
            </button>
            <button
              onClick={() => setIsAddingFolder(true)}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <HiOutlineFolderAdd size={18} /> New Folder
            </button>
          </div>
        </div>

        {/* Main Explorer Container */}
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-slate-950/40 overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="relative w-full max-w-md">
                <HiOutlineSearch
                  className="absolute left-3.5 top-2.5 text-gray-400 dark:text-slate-500"
                  size={18}
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search routes and folders..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all outline-none font-medium text-xs dark:text-slate-100"
                />
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-500/20 uppercase">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete ${selectedIds.size} items?`)) return;
                      for (const cid of selectedIds) {
                        const [type, id] = cid.split("-");
                        if (type === "folder") await removeFolder(parseInt(id));
                        else await removeRoute(parseInt(id));
                      }
                      setSelectedIds(new Set());
                      loadData();
                    }}
                    className="flex items-center gap-1.5 text-red-600 text-[10px] font-bold bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 hover:bg-red-100 transition-colors uppercase tracking-wider"
                  >
                    <HiOutlineTrash size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
            <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              {displayItems.length} items
            </div>
          </div>

          {isAddingFolder && (
            <div className="px-5 py-4 bg-indigo-50/50 dark:bg-indigo-500/5 border-b border-indigo-100 dark:border-indigo-500/20 flex items-center gap-3 animate-in slide-in-from-top-4">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-500/20 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-medium text-xs shadow-sm dark:text-slate-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    addFolder(newFolderName, currentFolderId).then(() => {
                      setNewFolderName("");
                      setIsAddingFolder(false);
                      loadData();
                    });
                  if (e.key === "Escape") setIsAddingFolder(false);
                }}
              />
              <button
                onClick={() =>
                  addFolder(newFolderName, currentFolderId).then(() => {
                    setNewFolderName("");
                    setIsAddingFolder(false);
                    loadData();
                  })
                }
                className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
              >
                Create
              </button>
              <button
                onClick={() => setIsAddingFolder(false)}
                className="px-4 py-2 text-gray-600 dark:text-slate-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-[11px] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <GenericTable
            items={displayItems}
            columns={columns}
            isLoading={isLoading}
            rowKey={(item) => `${item.type}-${item.id}`}
            onRowClick={(item) =>
              item.type === "folder"
                ? setCurrentFolderId(item.id!)
                : handleNavigate(item as Route)
            }
            onRowDragStart={(e, item) =>
              onDragStart(e, `${item.type}-${item.id}`)
            }
            onRowDragOver={(e, item) =>
              onDragOver(e, `${item.type}-${item.id}`, item.type === "folder")
            }
            onRowDragEnd={onDragEnd}
            onRowDrop={(e, item) =>
              item.type === "folder" ? onDrop(e, item.id!) : undefined
            }
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onSelectAll={() => {
              if (selectedIds.size === displayItems.length)
                setSelectedIds(new Set());
              else
                setSelectedIds(
                  new Set(displayItems.map((i) => `${i.type}-${i.id}`)),
                );
            }}
            isAllSelected={
              displayItems.length > 0 &&
              selectedIds.size === displayItems.length
            }
            emptyMessage="No routes found"
          />
        </div>
      </div>
    </div>
  );
}
