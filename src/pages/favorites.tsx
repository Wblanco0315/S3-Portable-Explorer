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
import { getAwsAccountDisplayName } from "../features/aws/s3Client";

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
  const [, setMovingId] = useState<string | null>(null);

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
              className={`flex-shrink-0 transition-transform ${isFolder ? "text-primary" : "text-secondary"} ${isOver ? "scale-105" : "group-hover:scale-105"}`}
            >
              {isFolder ? (
                <HiOutlineFolder size={20} />
              ) : (
                <HiOutlineLink size={20} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              {isFolder ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentFolderId(item.id!);
                  }}
                  className={`font-semibold text-left hover:underline truncate transition-colors text-body-md ${isOver ? "text-primary font-bold" : "text-on-surface"}`}
                >
                  {item.name}
                </button>
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNavigate(item as Route);
                  }}
                  className="font-semibold text-primary hover:underline cursor-pointer truncate text-body-md"
                >
                  {item.name}
                </span>
              )}
              {isOver && isFolder && (
                <div className="flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
                  <span className="bg-primary text-on-primary text-label-sm px-1.5 py-0.5 rounded-sm font-semibold uppercase tracking-wider">
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
        "text-on-surface-variant font-medium text-label-sm uppercase tracking-wider",
      render: (item) => (item.type === "folder" ? "Folder" : "Route"),
    },
    {
      key: "profile",
      header: "Profile",
      render: (item) =>
        item.type === "route" ? (
          <span className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant rounded-sm text-label-sm font-mono border border-outline-variant uppercase tracking-wider">
            {(item as Route).profile}
          </span>
        ) : (
          <span className="text-on-surface-variant/30 font-mono text-label-sm">—</span>
        ),
    },
    {
      key: "path",
      header: "S3 Path",
      className: "font-mono text-label-sm text-on-surface-variant max-w-xs truncate",
      render: (item) =>
        item.type === "route" ? (
          `s3://${(item as Route).bucket}/${(item as Route).prefix}`
        ) : (
          <span className="text-on-surface-variant/30 font-mono text-label-sm">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (item) => (
        <div
          className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
                className="p-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer"
                title="Copy S3 URI"
              >
                {copiedId === item.id ? (
                  <HiOutlineCheck className="w-4 h-4 text-primary" />
                ) : (
                  <HiOutlineDuplicate className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => handleNavigate(item as Route)}
                className="p-1.5 bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors cursor-pointer"
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
            className="p-1.5 bg-surface-container border border-outline-variant text-error/80 hover:text-error hover:bg-error-container/20 rounded transition-colors cursor-pointer"
            title="Delete"
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="w-full flex flex-col gap-4">
        <Breadcrumb
          items={[
            {
              label: getAwsAccountDisplayName(),
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-container-high text-primary border border-outline-variant rounded flex items-center justify-center">
              <HiOutlineLink className="w-5 h-5" />
            </div>
            <h1 className="text-headline-lg font-bold text-on-surface">My Routes</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 bg-surface-container border border-outline-variant text-on-surface rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Refresh"
            >
              <HiOutlineRefresh className="w-4 h-4" />
            </button>
            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface text-body-md font-medium rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Import JSON Collection"
            >
              <HiOutlineUpload className="w-4 h-4 text-on-surface-variant" /> Import
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant text-on-surface text-body-md font-medium rounded hover:bg-surface-container-high transition-colors cursor-pointer"
              title="Export JSON Collection"
            >
              <HiOutlineDownload className="w-4 h-4 text-on-surface-variant" /> Export
            </button>
            <button
              onClick={() => setIsAddingFolder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-body-md font-medium rounded border border-transparent hover:bg-primary/95 transition-colors cursor-pointer"
            >
              <HiOutlineFolderAdd className="w-4 h-4" /> New Folder
            </button>
          </div>
        </div>

        {/* Main Explorer Container */}
        <div className="flex-1 min-h-0 bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="relative w-full max-w-md">
                <HiOutlineSearch
                  className="absolute left-3 top-2.5 text-on-surface-variant"
                  size={16}
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search routes and folders..."
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded focus:border-primary transition-all outline-none text-body-md text-on-surface"
                />
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                  <span className="text-label-sm font-semibold text-primary bg-primary-container/20 px-2 py-0.5 rounded-sm border border-primary-container/30 uppercase">
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
                    className="flex items-center gap-1.5 text-error text-label-sm font-semibold bg-error-container/20 px-3 py-1.5 rounded border border-error-container/30 hover:bg-error-container/30 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    <HiOutlineTrash size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
            <div className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
              {displayItems.length} items
            </div>
          </div>

          {isAddingFolder && (
            <div className="px-4 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-3 animate-in slide-in-from-top-4">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="flex-1 px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded outline-none focus:border-primary text-body-md text-on-surface"
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
                className="bg-primary text-on-primary px-4 py-1.5 rounded font-medium text-body-md hover:bg-primary/95 transition-colors cursor-pointer"
              >
                Create
              </button>
              <button
                onClick={() => setIsAddingFolder(false)}
                className="px-3 py-1.5 text-on-surface-variant font-medium hover:bg-surface-container-high rounded text-body-md transition-colors cursor-pointer"
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
